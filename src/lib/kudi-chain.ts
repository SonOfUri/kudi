/**
 * Kudi live deployment: Base only. Custodial wallets, stablecoin deposits, and Li.Fi Earn/Composer
 * routes are restricted to this chain.
 */
export const KUDI_CHAIN = {
  name: "Base",
  chainId: 8453,
  networkCaip: "eip155:8453",
} as const;

export type KudiChainId = (typeof KUDI_CHAIN)["chainId"];
