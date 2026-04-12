import type { PortfolioPayload, WalletActivityPayload, WalletBalanceData } from "@/lib/wallet-types";

export async function fetchWalletBalance(): Promise<WalletBalanceData> {
  const res = await fetch("/api/wallet/balance", { credentials: "include" });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Could not load balance";
    throw new Error(msg);
  }
  if (typeof data !== "object" || data === null || !("balance" in data)) {
    throw new Error("Invalid balance response");
  }
  const balance = (data as { balance: unknown }).balance;
  const balanceNum = typeof balance === "number" && Number.isFinite(balance) ? balance : 0;
  const rawUnits = (data as { balanceBaseUnits?: unknown }).balanceBaseUnits;
  const balanceBaseUnits =
    typeof rawUnits === "string" && /^[0-9]+$/.test(rawUnits) ? rawUnits : "0";
  const address = (data as { address?: unknown }).address;
  return {
    balance: balanceNum,
    balanceBaseUnits,
    address: typeof address === "string" ? address : undefined,
  };
}

export async function fetchWalletPortfolio(): Promise<PortfolioPayload> {
  const res = await fetch("/api/wallet/portfolio", { credentials: "include", cache: "no-store" });
  const json = (await res.json()) as PortfolioPayload;
  if (!res.ok) {
    throw new Error(json.error || "Could not load portfolio");
  }
  return json;
}

export async function fetchWalletActivity(limit: number): Promise<WalletActivityPayload> {
  const res = await fetch(`/api/wallet/activity?limit=${limit}`, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Could not load activity");
  }
  const data: unknown = await res.json();
  const items =
    typeof data === "object" &&
    data !== null &&
    "items" in data &&
    Array.isArray((data as { items: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  return { items };
}
