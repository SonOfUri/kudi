import { formatUnits } from "ethers";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { KUDI_DEFAULT_CHAIN_ID, LIFI_EARN_BASE } from "@/lib/lifi/constants";
import { augmentPortfolioWithAppInvestVaults } from "@/lib/lifi/portfolio-app-vaults";
import type { MinimalEarnVault } from "@/lib/lifi/match-position-vault";
import { matchPositionsToVaults } from "@/lib/lifi/match-position-vault";
import { fetchEarnVaultsFromSearchParams, portfolioVaultMatchingSearchParams } from "@/lib/lifi/server";
import { db } from "@/lib/db";
import { ensureUserWallet } from "@/lib/wallet-provision";
import { WalletActivityType } from "@/generated/prisma/enums";

/** Li.fi returns `balanceUsd` (string) on current API; older docs used `currentValue`. */
function positionUsd(pos: unknown): number {
  if (!pos || typeof pos !== "object") return 0;
  const p = pos as Record<string, unknown>;
  if (p.balanceUsd != null) {
    const n = Number(p.balanceUsd);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof p.currentValue === "number" && Number.isFinite(p.currentValue)) {
    return p.currentValue;
  }
  if (typeof p.currentValue === "string") {
    const n = Number(p.currentValue);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function metaVaultAddress(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const v = m.vaultAddress;
  return typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v) ? v.toLowerCase() : undefined;
}

function metaVaultLabel(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const v = m.vaultLabel;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function metaProtocolName(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const v = m.protocolName;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function buildVaultByAddress(vaults: unknown[]): Map<string, MinimalEarnVault> {
  const m = new Map<string, MinimalEarnVault>();
  for (const v of vaults) {
    if (!v || typeof v !== "object") continue;
    const vo = v as MinimalEarnVault;
    if (typeof vo.address !== "string") continue;
    m.set(vo.address.toLowerCase(), vo);
  }
  return m;
}

/**
 * Returns the authenticated user's Li.fi portfolio positions, matched Earn vaults,
 * and deposit/earn estimates from in-app activity.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const wallet = await ensureUserWallet(user.id);
    const apiKey = process.env.LIFI_API_KEY?.trim();

    const url = `${LIFI_EARN_BASE}/v1/earn/portfolio/${wallet.address}/positions`;
    const headers: HeadersInit = {
      accept: "application/json",
    };
    if (apiKey) {
      headers["x-lifi-api-key"] = apiKey;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[api/wallet/portfolio] Li.fi error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to fetch portfolio", details: text },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { positions?: unknown[] };
    const rawPositions = Array.isArray(data.positions) ? data.positions : [];

    const totalValue = rawPositions.reduce(
      (sum: number, pos: unknown) => sum + positionUsd(pos),
      0,
    );

    const depositRows = await db.walletActivity.findMany({
      where: { userId: user.id, type: WalletActivityType.VAULT_INVEST },
      select: { amountUsdcBaseUnits: true, meta: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const depositedByVault = new Map<string, number>();
    const vaultLabelByAddress = new Map<string, string>();
    const protocolNameByVault = new Map<string, string>();
    const investedVaultAddresses: string[] = [];
    const seenInvestVault = new Set<string>();
    let totalDepositedFromAppUsd = 0;
    for (const row of depositRows) {
      if (row.amountUsdcBaseUnits) {
        let usd = 0;
        try {
          usd = Number(formatUnits(BigInt(row.amountUsdcBaseUnits), 6));
        } catch {
          usd = 0;
        }
        if (usd > 0) {
          totalDepositedFromAppUsd += usd;
          const va = metaVaultAddress(row.meta);
          if (va) {
            depositedByVault.set(va, (depositedByVault.get(va) ?? 0) + usd);
          }
        }
      }
      const va = metaVaultAddress(row.meta);
      if (va) {
        if (!vaultLabelByAddress.has(va)) {
          const lab = metaVaultLabel(row.meta);
          if (lab) vaultLabelByAddress.set(va, lab);
        }
        if (!protocolNameByVault.has(va)) {
          const pn = metaProtocolName(row.meta);
          if (pn) protocolNameByVault.set(va, pn);
        }
        if (!seenInvestVault.has(va)) {
          seenInvestVault.add(va);
          investedVaultAddresses.push(va);
        }
      }
    }

    let vaultsPayload: unknown[] = [];
    try {
      const earned = await fetchEarnVaultsFromSearchParams(portfolioVaultMatchingSearchParams());
      if (
        earned &&
        typeof earned === "object" &&
        "data" in earned &&
        Array.isArray((earned as { data: unknown }).data)
      ) {
        vaultsPayload = (earned as { data: unknown[] }).data;
      }
    } catch (e) {
      console.warn("[api/wallet/portfolio] vault list for matching failed:", e);
    }

    const vaultByAddress = buildVaultByAddress(vaultsPayload);

    const lifiMatches = await matchPositionsToVaults(
      wallet.address,
      rawPositions,
      vaultsPayload as Parameters<typeof matchPositionsToVaults>[2],
      KUDI_DEFAULT_CHAIN_ID,
    );

    const augmented = await augmentPortfolioWithAppInvestVaults(
      wallet.address,
      rawPositions,
      lifiMatches,
      investedVaultAddresses,
      vaultByAddress,
      depositedByVault,
      vaultLabelByAddress,
      protocolNameByVault,
      KUDI_DEFAULT_CHAIN_ID,
    );

    const displayPositions = augmented.displayPositions;
    const vaultMatches = augmented.matches;

    const rowFromIndex = (pos: unknown, i: number) => {
      const currentUsd = positionUsd(pos);
      const match = vaultMatches[i];
      const vaultAddr = match?.vaultAddress?.toLowerCase();
      const depositedUsd =
        vaultAddr != null ? (depositedByVault.get(vaultAddr) ?? null) : null;
      const estimatedEarnedUsd =
        depositedUsd != null && depositedUsd > 0
          ? Math.max(0, currentUsd - depositedUsd)
          : null;

      return {
        position: pos,
        vault: match,
        depositedFromAppUsd: depositedUsd,
        estimatedEarnedUsd,
        appDepositAttribution: augmented.appDepositAttribution[i] === true,
      };
    };

    const positions = displayPositions.map((pos, i) => rowFromIndex(pos, i));

    for (const extra of augmented.appended) {
      const currentUsd = positionUsd(extra.position);
      const match = extra.vault;
      const vaultAddr = match.vaultAddress.toLowerCase();
      const depositedUsd = depositedByVault.get(vaultAddr) ?? null;
      const estimatedEarnedUsd =
        depositedUsd != null && depositedUsd > 0
          ? Math.max(0, currentUsd - depositedUsd)
          : null;
      positions.push({
        position: extra.position,
        vault: match,
        depositedFromAppUsd: depositedUsd,
        estimatedEarnedUsd,
        appDepositAttribution: extra.appDepositAttribution,
      });
    }

    let totalValueOut = totalValue;
    for (const extra of augmented.appended) {
      totalValueOut += positionUsd(extra.position);
    }

    const estimatedEarnedAggregateUsd =
      totalDepositedFromAppUsd > 0
        ? Math.max(0, totalValueOut - Math.min(totalDepositedFromAppUsd, totalValueOut))
        : null;

    return NextResponse.json({
      address: wallet.address,
      positions,
      totalValue: totalValueOut,
      positionCount: positions.length,
      summary: {
        totalDepositedFromAppUsd,
        estimatedEarnedUsd: estimatedEarnedAggregateUsd,
        earnNote:
          "Earned is estimated from deposits made in Kudi vs. current balance. It excludes funds added outside the app and is not tax advice.",
      },
    });
  } catch (err) {
    console.error("[api/wallet/portfolio]", err);
    const message = err instanceof Error ? err.message : "Could not fetch portfolio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
