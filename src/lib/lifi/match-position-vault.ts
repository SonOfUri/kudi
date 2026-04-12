import { Contract, JsonRpcProvider } from "ethers";

import { rpcUrlForChain } from "@/lib/custodial-signer";

const BALANCE_ABI = ["function balanceOf(address owner) view returns (uint256)"] as const;

export type MinimalEarnVault = {
  address: string;
  chainId: number;
  isTransactional?: boolean;
  name?: string;
  protocol?: { name?: string };
  underlyingTokens?: Array<{ symbol?: string }>;
  analytics?: { apy?: { total?: number }; tvl?: { usd?: string } };
  isRedeemable?: boolean;
};

function positionBalanceUsd(pos: unknown): number {
  if (!pos || typeof pos !== "object") return 0;
  const p = pos as Record<string, unknown>;
  const n = Number(p.balanceUsd);
  return Number.isFinite(n) ? n : 0;
}

export function protocolMatch(
  vaultProtocol: string | undefined,
  positionProtocol: string | undefined,
): boolean {
  if (!vaultProtocol || !positionProtocol) return false;
  const a = vaultProtocol.toLowerCase();
  const b = positionProtocol.toLowerCase();
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const strip = (s: string) => s.replace(/-v\d+$/i, "").replace(/-/g, "");
  const sa = strip(a);
  const sb = strip(b);
  return sa === sb || a.includes(sb) || b.includes(sa);
}

/** Collapse common stable variants so Li.fi position symbols align with vault underlying tickers. */
function canonicalSymbol(sym: string | undefined): string | undefined {
  if (!sym) return undefined;
  const u = sym.toUpperCase().trim();
  const compact = u.replace(/[^A-Z0-9]/g, "");
  if (compact === "USDBC" || compact === "USDCE") return "USDC";
  if (u === "USDBC" || u === "USDC.E" || u === "USDC-E") return "USDC";
  return u;
}

function symbolMatch(vault: MinimalEarnVault, assetSymbol: string | undefined): boolean {
  const assetCanon = canonicalSymbol(assetSymbol);
  if (!assetCanon) return false;
  const tokens = vault.underlyingTokens;
  if (!tokens?.length) return false;
  for (const t of tokens) {
    const vs = canonicalSymbol(t.symbol);
    if (vs && vs === assetCanon) return true;
  }
  return false;
}

/**
 * Used when attaching vaults from in-app deposit history: allow pairing when Li.fi metadata is wrong.
 * If Earn metadata is missing, only stablecoin-like symbols are accepted.
 */
export function earnVaultMatchesAssetSymbol(
  vault: MinimalEarnVault | undefined,
  assetSymbol: string | undefined,
): boolean {
  if (vault) return symbolMatch(vault, assetSymbol);
  const c = canonicalSymbol(assetSymbol);
  if (c === "USDC" || c === "USDT" || c === "DAI" || c === "EURC") return true;
  return assetSymbol === undefined;
}

function tvlNumber(vault: MinimalEarnVault): number {
  const raw = vault.analytics?.tvl?.usd;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export type PositionVaultMatch = {
  vaultAddress: string;
  vaultName?: string;
  apyTotal?: number;
  shareBalance: string;
  isRedeemable: boolean;
};

/**
 * Matches Li.fi portfolio positions to Earn vaults by protocol + underlying symbol,
 * then disambiguates with on-chain vault share balances (one vault per position).
 */
export async function matchPositionsToVaults(
  walletAddress: string,
  positions: unknown[],
  vaults: MinimalEarnVault[],
  chainId: number,
): Promise<(PositionVaultMatch | null)[]> {
  const provider = new JsonRpcProvider(rpcUrlForChain(chainId), chainId);
  const eligible = vaults.filter(
    (v) => v.chainId === chainId && v.isTransactional !== false,
  );

  const usedVaults = new Set<string>();
  const n = positions.length;
  const matches: (PositionVaultMatch | null)[] = new Array(n).fill(null);

  const order = positions
    .map((p, i) => ({ i, usd: positionBalanceUsd(p) }))
    .sort((a, b) => b.usd - a.usd);

  for (const { i } of order) {
    const pos = positions[i];
    if (!pos || typeof pos !== "object") continue;
    const p = pos as Record<string, unknown>;
    const protocolName = typeof p.protocolName === "string" ? p.protocolName : "";
    const asset = p.asset as Record<string, unknown> | undefined;
    const assetSym = typeof asset?.symbol === "string" ? asset.symbol : undefined;

    const candidates = eligible
      .filter(
        (v) =>
          !usedVaults.has(v.address.toLowerCase()) &&
          protocolMatch(v.protocol?.name, protocolName) &&
          symbolMatch(v, assetSym),
      )
      .sort((a, b) => tvlNumber(b) - tvlNumber(a));

    if (candidates.length === 0) continue;

    const balances = await Promise.all(
      candidates.map(async (v) => {
        const c = new Contract(v.address, BALANCE_ABI, provider);
        const bal = await c.balanceOf(walletAddress);
        const n = BigInt(bal.toString());
        return { v, bal: n };
      }),
    );

    const zero = BigInt(0);
    const positive = balances.filter((x) => x.bal > zero);
    if (positive.length === 0) continue;

    positive.sort((a, b) => (a.bal < b.bal ? 1 : a.bal > b.bal ? -1 : 0));
    const best = positive[0];
    usedVaults.add(best.v.address.toLowerCase());

    const apy = best.v.analytics?.apy?.total;
    matches[i] = {
      vaultAddress: best.v.address,
      vaultName: best.v.name,
      apyTotal: typeof apy === "number" && Number.isFinite(apy) ? apy : undefined,
      shareBalance: best.bal.toString(),
      isRedeemable: best.v.isRedeemable !== false,
    };
  }

  return matches;
}
