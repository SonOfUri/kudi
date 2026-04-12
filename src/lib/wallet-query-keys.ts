import type { QueryClient } from "@tanstack/react-query";

/** Stable keys for wallet / portfolio server state (TanStack Query). */
export const walletKeys = {
  all: ["wallet"] as const,
  balance: () => [...walletKeys.all, "balance"] as const,
  portfolio: () => [...walletKeys.all, "portfolio"] as const,
  activity: (limit: number) => [...walletKeys.all, "activity", limit] as const,
};

export function invalidateWalletQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: walletKeys.all });
}
