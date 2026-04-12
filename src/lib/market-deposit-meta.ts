/**
 * `WalletActivity.meta` for `VAULT_INVEST` — written by POST /api/lifi/deposit.
 * `createdAt` on the activity row is the deposit timestamp (server clock at insert).
 */
export type MarketDepositActivityMeta = {
  vaultAddress: string;
  vaultLabel?: string | null;
  protocolName?: string | null;
  vaultSlug?: string | null;
  chainId?: number;
  /** Total APY % from Li.fi Earn at deposit time when available. */
  apyTotalAtDeposit?: number | null;
  apyBaseAtDeposit?: number | null;
  apyRewardAtDeposit?: number | null;
  /** Where `apyTotalAtDeposit` came from. */
  apySnapshotSource?: "earn_api" | "client" | "unknown";
  /** ISO time when the Earn APY snapshot was read (≈ deposit time for earn_api). */
  apySnapshotAt?: string | null;
};
