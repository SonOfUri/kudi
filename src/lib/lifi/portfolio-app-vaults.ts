import { Contract, JsonRpcProvider } from "ethers";

import { rpcUrlForChain } from "@/lib/custodial-signer";

import {
  earnVaultMatchesAssetSymbol,
  type MinimalEarnVault,
  type PositionVaultMatch,
} from "./match-position-vault";

const BALANCE_ABI = ["function balanceOf(address owner) view returns (uint256)"] as const;

function positionUsd(pos: unknown): number {
  if (!pos || typeof pos !== "object") return 0;
  const p = pos as Record<string, unknown>;
  const n = Number(p.balanceUsd);
  return Number.isFinite(n) ? n : 0;
}

function positionAssetSymbol(pos: unknown): string | undefined {
  if (!pos || typeof pos !== "object") return undefined;
  const p = pos as Record<string, unknown>;
  const asset = p.asset as Record<string, unknown> | undefined;
  return typeof asset?.symbol === "string" ? asset.symbol : undefined;
}

function overlayEarnOnLiFiPosition(
  pos: unknown,
  earn: MinimalEarnVault | undefined,
  fallbackProtocolName?: string,
): unknown {
  if (!pos || typeof pos !== "object") return pos;
  const orig = pos as Record<string, unknown>;
  const p: Record<string, unknown> = { ...orig };
  if (earn?.protocol?.name) {
    p.protocolName = earn.protocol.name;
  } else if (fallbackProtocolName) {
    p.protocolName = fallbackProtocolName;
  }
  const u = earn?.underlyingTokens?.[0];
  if (u && typeof u === "object") {
    const uo = u as Record<string, unknown>;
    const prev =
      typeof orig.asset === "object" && orig.asset !== null
        ? (orig.asset as Record<string, unknown>)
        : {};
    p.asset = {
      ...prev,
      symbol: typeof uo.symbol === "string" ? uo.symbol : prev.symbol,
      address: typeof uo.address === "string" ? uo.address : prev.address,
      decimals: typeof uo.decimals === "number" ? uo.decimals : prev.decimals,
      name: typeof uo.name === "string" ? uo.name : prev.name,
    };
  }
  return p;
}

function matchFromEarnAndBalance(
  earn: MinimalEarnVault | undefined,
  vaultAddress: string,
  shareBalance: bigint,
  vaultLabel: string | undefined,
): PositionVaultMatch {
  const apy = earn?.analytics?.apy?.total;
  return {
    vaultAddress,
    vaultName: earn?.name ?? vaultLabel ?? `Vault ${vaultAddress.slice(0, 6)}…${vaultAddress.slice(-4)}`,
    apyTotal: typeof apy === "number" && Number.isFinite(apy) ? apy : undefined,
    shareBalance: shareBalance.toString(),
    /** Li.fi often marks pools non-redeemable while Composer still exits; deposits via Kudi always allow trying withdraw. */
    isRedeemable: true,
  };
}

export type AppVaultPortfolioAugment = {
  matches: (PositionVaultMatch | null)[];
  displayPositions: unknown[];
  /** True when pool/protocol display was taken from your in-app deposit + Earn metadata (Li.fi line was ambiguous). */
  appDepositAttribution: boolean[];
  appended: Array<{
    position: unknown;
    vault: PositionVaultMatch;
    appDepositAttribution: boolean;
  }>;
};

/**
 * Uses vault addresses from in-app VAULT_INVEST rows + on-chain share balances to fix rows where
 * Li.fi returns the wrong protocol/pool, and appends rows when the user still holds shares but Li.fi
 * lists no matching line.
 */
export async function augmentPortfolioWithAppInvestVaults(
  walletAddress: string,
  rawPositions: unknown[],
  lifiMatches: (PositionVaultMatch | null)[],
  investedVaultAddresses: string[],
  vaultsByAddress: Map<string, MinimalEarnVault>,
  depositedByVault: Map<string, number>,
  vaultLabelByAddress: Map<string, string>,
  /** From deposit `meta.protocolName` when user invested via Kudi (covers vaults missing from Earn list). */
  protocolNameByVault: Map<string, string>,
  chainId: number,
): Promise<AppVaultPortfolioAugment> {
  const provider = new JsonRpcProvider(rpcUrlForChain(chainId), chainId);
  const matches = [...lifiMatches];
  const displayPositions = rawPositions.map((p) => p);
  const appDepositAttribution = rawPositions.map(() => false);

  const usedByLifi = new Set<string>();
  for (const m of lifiMatches) {
    if (m?.vaultAddress) usedByLifi.add(m.vaultAddress.toLowerCase());
  }

  const uniqueAddrs = [...new Set(investedVaultAddresses.map((a) => a.toLowerCase()))];

  type Cand = {
    addr: string;
    bal: bigint;
    earn: MinimalEarnVault | undefined;
    deposited: number;
    label: string | undefined;
  };

  const candidates: Cand[] = [];
  for (const addr of uniqueAddrs) {
    if (usedByLifi.has(addr)) continue;
    let bal: bigint;
    try {
      const c = new Contract(addr, BALANCE_ABI, provider);
      bal = BigInt((await c.balanceOf(walletAddress)).toString());
    } catch {
      continue;
    }
    if (bal <= BigInt(0)) continue;

    const earn = vaultsByAddress.get(addr);
    candidates.push({
      addr,
      bal,
      earn,
      deposited: depositedByVault.get(addr) ?? 0,
      label: vaultLabelByAddress.get(addr),
    });
  }

  candidates.sort((a, b) => b.deposited - a.deposited);

  const unmatchedIdx = rawPositions
    .map((pos, i) => ({ i, usd: positionUsd(pos) }))
    .filter(({ i, usd }) => matches[i] == null && usd > 1e-9)
    .sort((a, b) => b.usd - a.usd)
    .map(({ i }) => i);

  const usedCandAddr = new Set<string>();

  for (const idx of unmatchedIdx) {
    const pos = rawPositions[idx];
    const sym = positionAssetSymbol(pos);
    const usd = positionUsd(pos);
    const cand = candidates.find((c) => {
      if (usedCandAddr.has(c.addr) || !earnVaultMatchesAssetSymbol(c.earn, sym)) return false;
      if (c.deposited > 0) {
        const tol = Math.max(0.5, c.deposited * 0.25);
        return Math.abs(usd - c.deposited) <= tol;
      }
      /** No in-app deposit row: avoid pairing liquid wallet USDC (~$3) to a vault that only matches on symbol. */
      return usd >= Math.max(10, 0.5);
    });
    if (!cand) continue;

    usedCandAddr.add(cand.addr);
    matches[idx] = matchFromEarnAndBalance(cand.earn, cand.addr, cand.bal, cand.label);
    displayPositions[idx] = overlayEarnOnLiFiPosition(
      pos,
      cand.earn,
      protocolNameByVault.get(cand.addr),
    );
    appDepositAttribution[idx] = true;
  }

  /**
   * Symbol-based pairing often fails (Li.fi asset label vs Earn metadata). Without this pass we would
   * leave the Li.fi line unmatched (vault null → counted as “wallet” in totals) and also append a
   * synthetic pool row → double-count in portfolio aggregate.
   */
  const usedOrphanIdx = new Set<number>();
  const orphanLines = displayPositions
    .map((pos, i) => ({ i, usd: positionUsd(pos) }))
    .filter(({ i, usd }) => matches[i] == null && usd > 1e-9);

  const candsForAmount = candidates
    .filter((c) => !usedCandAddr.has(c.addr))
    .sort((a, b) => b.deposited - a.deposited);

  for (const cand of candsForAmount) {
    if (cand.deposited <= 0) continue;
    const tol = Math.max(0.5, cand.deposited * 0.15);
    let best: { i: number; diff: number } | null = null;
    for (const { i, usd } of orphanLines) {
      if (usedOrphanIdx.has(i)) continue;
      const diff = Math.abs(usd - cand.deposited);
      if (diff <= tol && (best == null || diff < best.diff)) {
        best = { i, diff };
      }
    }
    if (best != null) {
      usedOrphanIdx.add(best.i);
      usedCandAddr.add(cand.addr);
      const pos = rawPositions[best.i];
      matches[best.i] = matchFromEarnAndBalance(cand.earn, cand.addr, cand.bal, cand.label);
      displayPositions[best.i] = overlayEarnOnLiFiPosition(
        pos,
        cand.earn,
        protocolNameByVault.get(cand.addr),
      );
      appDepositAttribution[best.i] = true;
    }
  }

  const appended: AppVaultPortfolioAugment["appended"] = [];
  for (const cand of candidates) {
    if (usedCandAddr.has(cand.addr)) continue;
    const m = matchFromEarnAndBalance(cand.earn, cand.addr, cand.bal, cand.label);
    const dep = cand.deposited;
    const u = cand.earn?.underlyingTokens?.[0] as Record<string, unknown> | undefined;
    const position = {
      chainId,
      protocolName:
        typeof cand.earn?.protocol?.name === "string"
          ? cand.earn.protocol.name
          : protocolNameByVault.get(cand.addr) ?? "app-deposit",
      asset: {
        symbol: typeof u?.symbol === "string" ? u.symbol : "USDC",
        address: typeof u?.address === "string" ? u.address : undefined,
        decimals: typeof u?.decimals === "number" ? u.decimals : 6,
        name: typeof u?.name === "string" ? u.name : undefined,
      },
      balanceUsd: dep > 0 ? String(dep) : "0",
      balanceNative: undefined,
    };
    appended.push({ position, vault: m, appDepositAttribution: true });
  }

  return { matches, displayPositions, appDepositAttribution, appended };
}
