/**
 * Yield projection across multiple pools, each compounding at its own APY (daily rate).
 */

export type PoolSlice = {
  principal: number;
  /** Annual APY as percent, e.g. 9.5 for 9.5% */
  apyPercent: number;
};

function dailyFactor(apyPercent: number): number {
  return 1 + apyPercent / 100 / 365;
}

/** Balance after `day` full days, all pools compounded independently. */
export function multiPoolBalanceAtDay(pools: PoolSlice[], day: number): number {
  if (day <= 0) {
    return pools.reduce((s, p) => s + Math.max(0, p.principal), 0);
  }
  return pools.reduce((sum, p) => {
    const principal = Math.max(0, p.principal);
    if (principal <= 0) return sum;
    return sum + principal * Math.pow(dailyFactor(p.apyPercent), day);
  }, 0);
}

/** ~USD earned per day at current rates (simple interest day slice). */
export function estimatedDailyUsdEarn(pools: PoolSlice[]): number {
  return pools.reduce((s, p) => s + Math.max(0, p.principal) * (p.apyPercent / 100 / 365), 0);
}

export function weightedPortfolioApy(pools: PoolSlice[]): number | null {
  const w = pools.reduce((s, p) => s + Math.max(0, p.principal), 0);
  if (w <= 0) return null;
  const num = pools.reduce((s, p) => s + Math.max(0, p.principal) * p.apyPercent, 0);
  return num / w;
}

/** End-of-year balances: year 1 … `years`, each after 365 days of compounding at pool APYs. */
export type YearProjectionPoint = { year: number; balance: number };

const DAYS_PER_YEAR = 365;

export function yearlyMultiPoolProjection(pools: PoolSlice[], years: number): YearProjectionPoint[] {
  const n = Math.max(1, Math.floor(years));
  const out: YearProjectionPoint[] = [];
  for (let year = 1; year <= n; year++) {
    out.push({ year, balance: multiPoolBalanceAtDay(pools, DAYS_PER_YEAR * year) });
  }
  return out;
}

export type ProjectionPoint = { day: number; balance: number };

/** Evenly spaced samples from day 0 through maxDay (inclusive). */
export function sampleMultiPoolProjection(
  pools: PoolSlice[],
  maxDay: number,
  sampleCount: number,
): ProjectionPoint[] {
  const n = Math.max(2, Math.floor(sampleCount));
  const out: ProjectionPoint[] = [];
  for (let i = 0; i < n; i++) {
    const day = maxDay <= 0 ? 0 : Math.round((maxDay * i) / (n - 1));
    out.push({ day, balance: multiPoolBalanceAtDay(pools, day) });
  }
  return out;
}

