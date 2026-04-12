/**
 * Compound interest calculation for yield projections.
 */

type ProjectionInput = {
  /** Vault APY as decimal (e.g., 4.05 for 4.05%) */
  apy: number;
  /** Initial deposit amount (USD) */
  principal: number;
  /** Monthly contribution (USD) — 0 for one-off */
  monthlyContribution: number;
  /** Years to project */
  years: number;
};

export type YearProjection = {
  year: number;
  balance: number;
  totalDeposited: number;
  totalEarned: number;
};

/**
 * Calculate compound growth with optional monthly contributions.
 * Uses daily compounding for accuracy (APY → daily rate).
 */
export function calculateCompoundGrowth({
  apy,
  principal,
  monthlyContribution,
  years,
}: ProjectionInput): YearProjection[] {
  const projections: YearProjection[] = [];
  const dailyRate = apy / 100 / 365;
  const daysPerMonth = 30;
  const monthsPerYear = 12;

  let balance = principal;
  let totalDeposited = principal;

  for (let year = 1; year <= years; year++) {
    for (let month = 0; month < monthsPerYear; month++) {
      for (let day = 0; day < daysPerMonth; day++) {
        balance *= 1 + dailyRate;
      }
      if (month < monthsPerYear - 1) {
        balance += monthlyContribution;
        totalDeposited += monthlyContribution;
      }
    }

    projections.push({
      year,
      balance,
      totalDeposited,
      totalEarned: balance - totalDeposited,
    });
  }

  return projections;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 1 : 2)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(amount >= 10_000 ? 1 : 2)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
