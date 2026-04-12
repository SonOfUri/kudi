import { fetchEarnVaultsFromSearchParams, portfolioVaultMatchingSearchParams } from "./server";

export type EarnVaultApySnapshot = {
  apyTotal: number;
  apyBase?: number;
  apyReward?: number;
};

function vaultListFromResponse(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  return Array.isArray(d.data) ? d.data : [];
}

function findVaultInList(list: unknown[], vaultAddress: string): unknown {
  const want = vaultAddress.toLowerCase();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const addr = (item as Record<string, unknown>).address;
    if (typeof addr === "string" && addr.toLowerCase() === want) return item;
  }
  return undefined;
}

function apyFromVault(v: unknown): EarnVaultApySnapshot | null {
  if (!v || typeof v !== "object") return null;
  const analytics = (v as Record<string, unknown>).analytics as Record<string, unknown> | undefined;
  const apy = analytics?.apy as Record<string, unknown> | undefined;
  const total = apy?.total;
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  const base = apy?.base;
  const reward = apy?.reward;
  return {
    apyTotal: total,
    apyBase: typeof base === "number" && Number.isFinite(base) ? base : undefined,
    apyReward: typeof reward === "number" && Number.isFinite(reward) ? reward : undefined,
  };
}

/**
 * Looks up the vault in Li.fi Earn vault lists (two sort orders) and returns APY at lookup time.
 * Used right after a successful deposit so the recorded APY matches the market snapshot.
 */
export async function fetchEarnVaultApySnapshot(
  vaultAddress: string,
): Promise<EarnVaultApySnapshot | null> {
  try {
    const j1 = await fetchEarnVaultsFromSearchParams(portfolioVaultMatchingSearchParams());
    let hit = findVaultInList(vaultListFromResponse(j1), vaultAddress);
    let snap = hit ? apyFromVault(hit) : null;
    if (snap) return snap;

    const p2 = new URLSearchParams();
    p2.set("sortBy", "tvl");
    p2.set("limit", "100");
    const j2 = await fetchEarnVaultsFromSearchParams(p2);
    hit = findVaultInList(vaultListFromResponse(j2), vaultAddress);
    snap = hit ? apyFromVault(hit) : null;
    return snap;
  } catch (e) {
    console.warn("[earn-vault-snapshot] APY lookup failed:", e);
    return null;
  }
}
