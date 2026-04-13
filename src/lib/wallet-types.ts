/** Shared shapes for `/api/wallet/portfolio` and TanStack Query cache. */

export type PortfolioVault = {
  vaultAddress: string;
  vaultName?: string;
  apyTotal?: number;
  shareBalance: string;
  isRedeemable: boolean;
};

export type PortfolioApiRow = {
  position: {
    chainId?: number;
    protocolName?: string;
    asset?: { symbol?: string; name?: string; address?: string };
    balanceUsd?: string;
    balanceNative?: string;
  };
  vault: PortfolioVault | null;
  /** Gross in-app deposits into this vault minus recorded Kudi vault withdrawals (USDC), min 0. */
  depositedFromAppUsd: number | null;
  /** Illustrative ~1-day accrual: balance x (APY / 365). */
  estimatedEarnedUsd: number | null;
  appDepositAttribution?: boolean;
};

export type PortfolioPayload = {
  address?: string;
  positions?: PortfolioApiRow[];
  totalValue?: number;
  positionCount?: number;
  summary?: {
    totalDepositedFromAppUsd?: number;
    estimatedEarnedUsd?: number | null;
    earnNote?: string;
  };
  error?: string;
};

export type WalletBalanceData = {
  balance: number;
  balanceBaseUnits: string;
  address?: string;
};

export type WalletActivityPayload = {
  items: unknown[];
};
