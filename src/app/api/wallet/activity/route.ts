import { formatUnits } from "ethers";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const MAX_LIMIT = 50;

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function metaString(v: unknown): string | undefined {
  if (v && typeof v === "object" && "vaultLabel" in v && typeof (v as { vaultLabel: unknown }).vaultLabel === "string") {
    const s = (v as { vaultLabel: string }).vaultLabel.trim();
    return s.length > 0 ? s : undefined;
  }
  return undefined;
}

function metaToAddress(v: unknown): string | undefined {
  if (v && typeof v === "object" && "toAddress" in v && typeof (v as { toAddress: unknown }).toAddress === "string") {
    return (v as { toAddress: string }).toAddress;
  }
  return undefined;
}

function metaApyAtDeposit(meta: unknown): number | null | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const raw = m.apyTotalAtDeposit;
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return undefined;
}

function metaApySnapshotSource(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const s = m.apySnapshotSource;
  return typeof s === "string" ? s : undefined;
}

/**
 * Recent wallet actions we recorded server-side (invest, withdraw, gas support).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, rawLimit ? Number.parseInt(rawLimit, 10) || 20 : 20),
  );

  const rows = await db.walletActivity.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amountUsdcBaseUnits: true,
      explorerUrl: true,
      meta: true,
      createdAt: true,
    },
  });

  const items = rows.map((row) => {
    const meta = row.meta;
    let title = "";
    let detail: string | undefined;
    let amountLabel = "";
    let tone: "positive" | "neutral" | "out" = "neutral";

    if (row.type === "VAULT_INVEST") {
      title = "Invested in pool";
      detail = metaString(meta);
      const apyStored = metaApyAtDeposit(meta);
      if (apyStored != null && Number.isFinite(apyStored)) {
        const src = metaApySnapshotSource(meta);
        const srcNote =
          src === "earn_api" ? "Earn snapshot" : src === "client" ? "Markets UI" : "Recorded";
        detail = detail ? `${detail} · ${apyStored.toFixed(2)}% APY (${srcNote})` : `${apyStored.toFixed(2)}% APY (${srcNote})`;
      }
      tone = "out";
      if (row.amountUsdcBaseUnits) {
        try {
          const usd = formatUnits(BigInt(row.amountUsdcBaseUnits), 6);
          amountLabel = `−$${Number(usd).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        } catch {
          amountLabel = "USDC";
        }
      }
    } else if (row.type === "VAULT_WITHDRAW") {
      title = "Withdrew from pool";
      detail = metaString(meta);
      tone = "positive";
      if (row.amountUsdcBaseUnits) {
        try {
          const usd = formatUnits(BigInt(row.amountUsdcBaseUnits), 6);
          amountLabel = `+$${Number(usd).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        } catch {
          amountLabel = "USDC";
        }
      }
    } else if (row.type === "USDC_WITHDRAW") {
      title = "Sent USDC";
      const to = metaToAddress(meta);
      detail = to ? `To ${shortAddr(to)}` : undefined;
      tone = "out";
      if (row.amountUsdcBaseUnits) {
        try {
          const usd = formatUnits(BigInt(row.amountUsdcBaseUnits), 6);
          amountLabel = `−$${Number(usd).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        } catch {
          amountLabel = "USDC";
        }
      }
    } else if (row.type === "GAS_SUBSIDY") {
      title = "Network fee support";
      detail = "ETH added for transactions on Base";
      tone = "positive";
      amountLabel = "ETH";
    }

    const base = {
      id: row.id,
      type: row.type,
      title,
      detail,
      amountLabel,
      tone,
      explorerUrl: row.explorerUrl,
      createdAt: row.createdAt.toISOString(),
    };

    if (row.type === "VAULT_INVEST") {
      const apyAtDeposit = metaApyAtDeposit(meta);
      return {
        ...base,
        depositedAt: row.createdAt.toISOString(),
        apyTotalAtDeposit: apyAtDeposit === undefined ? undefined : apyAtDeposit,
        apySnapshotSource: metaApySnapshotSource(meta),
      };
    }

    return base;
  });

  return NextResponse.json({ items });
}
