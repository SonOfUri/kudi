import { KUDI_CHAIN } from "@/lib/kudi-chain";

import { KUDI_DEFAULT_CHAIN_ID, LIFI_EARN_BASE, LIFI_QUEST_QUOTE } from "./constants";

function requireLifiApiKey() {
  const key = process.env.LIFI_API_KEY?.trim();
  if (!key) {
    throw new Error("LIFI_API_KEY is not set");
  }
  return key;
}

/** `chainId` omitted — always `KUDI_CHAIN.chainId` (Base only). `cursor` allowed for pagination. */
const VAULT_QUERY_ALLOWLIST = new Set(["sortBy", "limit", "cursor", "minTvlUsd", "asset", "protocol"]);

export async function fetchEarnVaultsFromSearchParams(searchParams: URLSearchParams) {
  const key = requireLifiApiKey();
  const outbound = new URLSearchParams();
  for (const [k, v] of searchParams.entries()) {
    if (VAULT_QUERY_ALLOWLIST.has(k)) {
      outbound.set(k, v);
    }
  }
  outbound.set("chainId", String(KUDI_CHAIN.chainId));
  const qs = outbound.toString();
  const url = qs ? `${LIFI_EARN_BASE}/v1/earn/vaults?${qs}` : `${LIFI_EARN_BASE}/v1/earn/vaults`;
  const res = await fetch(url, {
    headers: { "x-lifi-api-key": key },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Earn vaults failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<unknown>;
}

export async function fetchComposerQuote(params: Record<string, string>) {
  const key = requireLifiApiKey();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${LIFI_QUEST_QUOTE}?${qs}`, {
    headers: { "x-lifi-api-key": key },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Composer quote failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<LiFiQuoteResponse>;
}

export type LiFiQuoteResponse = {
  action?: {
    fromToken?: { address?: string };
    fromAmount?: string;
    fromChainId?: number;
    toChainId?: number;
    toToken?: { decimals?: number };
    toAmount?: string;
  };
  estimate?: { approvalAddress?: string };
  transactionRequest?: Record<string, string | number | undefined>;
};

export function defaultVaultsSearchParams() {
  const p = new URLSearchParams();
  p.set("chainId", String(KUDI_DEFAULT_CHAIN_ID));
  p.set("sortBy", "apy");
  p.set("limit", "12");
  p.set("minTvlUsd", "100000");
  return p;
}

/** Wider vault list for matching Li.fi portfolio rows (no TVL floor — small pools still need matches). */
export function portfolioVaultMatchingSearchParams() {
  const p = new URLSearchParams();
  p.set("sortBy", "apy");
  /** Li.fi Earn caps `limit` at 100 (400 if higher). */
  p.set("limit", "100");
  return p;
}

export type HighestApyMarketVault = {
  apy: number;
  name?: string;
};

function earnVaultsPage(raw: unknown): { rows: unknown[]; nextCursor: string | null } {
  if (!raw || typeof raw !== "object") return { rows: [], nextCursor: null };
  const d = raw as Record<string, unknown>;
  const rows = Array.isArray(d.data) ? d.data : [];
  const c = d.nextCursor;
  const nextCursor = typeof c === "string" && c.length > 0 ? c : null;
  return { rows, nextCursor };
}

/**
 * Highest `analytics.apy.total` among vaults shown on Markets (Base, transactional only).
 * Walks every list page so the max is global, not just the first page.
 */
export async function fetchHighestApyMarketVault(): Promise<HighestApyMarketVault | null> {
  const base = defaultVaultsSearchParams();
  base.set("limit", "100");

  let cursor: string | null = null;
  let best: HighestApyMarketVault | null = null;
  let bestApy = -Infinity;

  for (;;) {
    const p = new URLSearchParams(base);
    if (cursor) p.set("cursor", cursor);
    const raw = await fetchEarnVaultsFromSearchParams(p);
    const { rows, nextCursor } = earnVaultsPage(raw);

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const v = row as Record<string, unknown>;
      if (v.chainId !== KUDI_CHAIN.chainId) continue;
      if (v.isTransactional !== true) continue;
      const analytics = v.analytics as Record<string, unknown> | undefined;
      const apyBlock = analytics?.apy as Record<string, unknown> | undefined;
      const total = apyBlock?.total;
      if (typeof total !== "number" || !Number.isFinite(total)) continue;
      if (total > bestApy) {
        bestApy = total;
        const name = v.name;
        best = {
          apy: total,
          name: typeof name === "string" && name.trim() ? name.trim() : undefined,
        };
      }
    }

    cursor = nextCursor;
    if (!cursor) break;
  }

  return best && bestApy > -Infinity ? best : null;
}
