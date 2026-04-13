"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDot,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Info,
  Rocket,
  Wallet,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AddFundsSheet } from "@/components/add-funds-sheet";
import { CashOutSheet } from "@/components/cash-out-sheet";
import { MobileSheetNotch } from "@/components/mobile-bottom-sheet";
import { ProjectionChartSkeleton } from "@/components/projection-chart-skeleton";
import { hasSeePossibleModalDismissed, SeePossibleModal } from "@/components/see-possible-modal";
import { formatCurrency, formatCurrencyFull } from "@/lib/compound-calculator";
import {
  estimatedDailyUsdEarn,
  multiPoolBalanceAtDay,
  type PoolSlice,
  weightedPortfolioApy,
  yearlyMultiPoolProjection,
} from "@/lib/portfolio-projection";
import { fetchWalletActivity, fetchWalletBalance, fetchWalletPortfolio } from "@/lib/wallet-fetch";
import { walletKeys } from "@/lib/wallet-query-keys";

const HOME_ACTIVITY_LIMIT = 15;

/** Display stablecoin / USD wallet amounts (en-US). */
function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Daily yield can be under $0.01; avoid rounding to $0. */
function formatUsdDailyEarn(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return formatUsd(0);
  if (amount < 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const GROWTH_PROJECTION_YEARS = 30;

function formatActivityWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "Just now";
  const diffM = Math.floor(diffMs / 60_000);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

type HomePortfolioRow = {
  position: { balanceUsd?: string };
  vault: { apyTotal?: number } | null;
};

function poolsFromPortfolioRows(rows: HomePortfolioRow[] | undefined): PoolSlice[] {
  if (!rows?.length) return [];
  return rows
    .map((row) => {
      const usd = Number(row.position?.balanceUsd);
      const principal = Number.isFinite(usd) && usd > 0 ? usd : 0;
      const apy = row.vault?.apyTotal;
      const apyPercent = typeof apy === "number" && Number.isFinite(apy) ? apy : 0;
      return { principal, apyPercent };
    })
    .filter((p) => p.principal > 0);
}

type ActivityItem = {
  id: string;
  title: string;
  detail?: string;
  amountLabel: string;
  tone: "positive" | "neutral" | "out";
  explorerUrl: string | null;
  createdAt: string;
  /** Present for pool deposits: same instant as `createdAt` (server time when the row was written). */
  depositedAt?: string;
  apyTotalAtDeposit?: number | null;
  apySnapshotSource?: string;
};

export function HomeContent({
  firstName,
  email,
}: {
  firstName: string | null;
  email: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [balanceBlurred, setBalanceBlurred] = useState(false);
  const [growthSelectedYear, setGrowthSelectedYear] = useState<number | null>(null);
  const [growthTooltipYear, setGrowthTooltipYear] = useState<number | null>(null);
  const [growthTooltipPosition, setGrowthTooltipPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [growthInfoOpen, setGrowthInfoOpen] = useState(false);
  const [seePossibleOpen, setSeePossibleOpen] = useState(false);

  const balanceQ = useQuery({
    queryKey: walletKeys.balance(),
    queryFn: fetchWalletBalance,
  });
  const portfolioQ = useQuery({
    queryKey: walletKeys.portfolio(),
    queryFn: fetchWalletPortfolio,
  });
  const activityQ = useQuery({
    queryKey: walletKeys.activity(HOME_ACTIVITY_LIMIT),
    queryFn: () => fetchWalletActivity(HOME_ACTIVITY_LIMIT),
  });

  const loadingBalances = balanceQ.isPending || portfolioQ.isPending || activityQ.isPending;
  const usdcBalance = balanceQ.isSuccess ? balanceQ.data.balance : null;
  const portfolioValue = portfolioQ.isSuccess ? (portfolioQ.data.totalValue ?? 0) : null;
  const portfolioRows = useMemo((): HomePortfolioRow[] | undefined => {
    if (!portfolioQ.isSuccess) return undefined;
    return Array.isArray(portfolioQ.data.positions)
      ? (portfolioQ.data.positions as HomePortfolioRow[])
      : [];
  }, [portfolioQ.isSuccess, portfolioQ.data]);
  const activities: ActivityItem[] = activityQ.isSuccess
    ? ((activityQ.data.items as ActivityItem[]) ?? [])
    : [];

  const greetName = (firstName?.trim() || email.split("@")[0] || "there").split(" ")[0];

  const yieldPools = useMemo(() => poolsFromPortfolioRows(portfolioRows), [portfolioRows]);

  const growthModelPools = useMemo<PoolSlice[]>(
    () => (yieldPools.length > 0 ? yieldPools : []),
    [yieldPools],
  );

  const growthYearly = useMemo(
    () => yearlyMultiPoolProjection(growthModelPools, GROWTH_PROJECTION_YEARS),
    [growthModelPools],
  );

  const growthInitialBalance = useMemo(
    () => multiPoolBalanceAtDay(growthModelPools, 0),
    [growthModelPools],
  );

  const maxGrowthBalance = useMemo(() => {
    const m = Math.max(...growthYearly.map((p) => p.balance), 0);
    return m > 0 ? m : 1;
  }, [growthYearly]);

  const growthYTicks = useMemo(() => {
    if (yieldPools.length === 0) {
      return [0, 0, 0, 0, 0, 0];
    }
    return [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((pct) => maxGrowthBalance * pct);
  }, [yieldPools.length, maxGrowthBalance]);

  const growthTooltipPoint = useMemo(
    () =>
      growthTooltipYear != null ? growthYearly.find((p) => p.year === growthTooltipYear) : null,
    [growthYearly, growthTooltipYear],
  );

  const blendedApy = useMemo(() => weightedPortfolioApy(yieldPools), [yieldPools]);

  const todayEarnEstimate = useMemo(() => estimatedDailyUsdEarn(yieldPools), [yieldPools]);

  /** For the info modal: illustrative totals at end of chart horizon (real pools only). */
  const growthInfoSummary = useMemo(() => {
    if (yieldPools.length === 0) return null;
    const last = growthYearly[growthYearly.length - 1]?.balance ?? 0;
    const earned = Math.max(0, last - growthInitialBalance);
    const apy = blendedApy;
    return {
      deposited: growthInitialBalance,
      apy,
      earned,
      endBalance: last,
      hasRates: apy != null && apy > 0 && earned >= 0.01,
    };
  }, [yieldPools.length, growthYearly, growthInitialBalance, blendedApy]);

  useEffect(() => {
    if (loadingBalances) return;
    if (hasSeePossibleModalDismissed()) return;
    const walletEmpty = usdcBalance !== null && usdcBalance === 0;
    const poolsEmpty = portfolioValue !== null && portfolioValue === 0;
    if (walletEmpty && poolsEmpty) {
      queueMicrotask(() => setSeePossibleOpen(true));
    }
  }, [loadingBalances, usdcBalance, portfolioValue]);

  const balanceMain = (usdcBalance || 0) + (portfolioValue || 0);

  return (
    <>
      <SeePossibleModal open={seePossibleOpen} onOpenChange={setSeePossibleOpen} />
      <section
        className="-mx-4 rounded-b-[1.75rem] bg-gradient-to-b from-primary via-[#084c3e] to-primary-hover px-4 pb-8 pt-2 text-primary-foreground shadow-[0_12px_40px_rgba(9,83,66,0.4)]"
        aria-labelledby="home-hero-heading"
      >
        <div className="pt-1">
          <h1
            id="home-hero-heading"
            className="text-[1.0625rem] font-semibold leading-snug tracking-tight text-primary-foreground"
          >
            Hello, {greetName}{" "}
            <span
              className="inline-block align-text-bottom text-[1.125rem] leading-none"
              aria-hidden
            >
              <span className="inline-block origin-bottom-right animate-[kudi-face-happy-idle_2.2s_ease-in-out_infinite]">
                👋
              </span>
            </span>
          </h1>
        </div>

        <div className="mt-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-primary-muted">Balance</p>
          <div className="mt-1 flex items-center gap-2">
            <div
              className={
                balanceBlurred
                  ? "min-w-0 flex-1 select-none blur-[11px] transition-[filter] duration-200"
                  : "min-w-0 flex-1 transition-[filter] duration-200"
              }
              aria-hidden={balanceBlurred}
            >
              <p
                className={`text-[2rem] font-semibold leading-none tracking-tight text-primary-foreground tabular-nums sm:text-[2.125rem] ${
                  balanceBlurred ? "" : "kudi-balance-live"
                }`}
                aria-live="polite"
              >
                {formatUsd(balanceMain)}
              </p>
              <p className="mt-2 text-[15px] font-semibold text-[#b6ffdd] tabular-nums">
                {yieldPools.length > 0 && todayEarnEstimate > 0
                  ? `~${formatUsdDailyEarn(todayEarnEstimate)} / day est.`
                  : "Earn more by depositing on Markets"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBalanceBlurred((v) => !v)}
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-all active:scale-95 ${
                balanceBlurred
                  ? "bg-primary-foreground text-primary shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.55)] ring-2 ring-primary-foreground/90"
                  : "bg-primary-foreground/14 text-primary-foreground ring-1 ring-primary-foreground/35"
              }`}
              aria-label={balanceBlurred ? "Show balance" : "Hide balance"}
              aria-pressed={balanceBlurred}
              title={balanceBlurred ? "Balance hidden" : "Balance visible"}
            >
              {balanceBlurred ? (
                <Eye className="size-[1.05rem] shrink-0" strokeWidth={2.25} aria-hidden />
              ) : (
                <EyeOff className="size-[1.05rem] shrink-0" strokeWidth={2.25} aria-hidden />
              )}
            </button>
          </div>
          {balanceBlurred ? (
            <p className="sr-only">
              Balance hidden. Use &quot;Show balance&quot; to reveal.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* <p className="text-sm font-medium text-primary-muted">Your kudi is earning</p> */}
            {blendedApy != null && blendedApy > 0 ? (
              <span className="rounded-full bg-[#04251f]/45 px-2.5 py-0.5 text-xs font-semibold text-primary-foreground ring-1 ring-primary-foreground/30 backdrop-blur-[2px]">
                {blendedApy.toFixed(2)}%  APY
              </span>
            ) : (
              <span className="rounded-full bg-[#04251f]/45 px-2.5 py-0.5 text-xs font-semibold text-primary-foreground ring-1 ring-primary-foreground/30 backdrop-blur-[2px]">
                Pools on Markets
              </span>
            )}
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="min-h-12 min-w-0 flex-1 rounded-xl bg-primary-foreground px-4 text-base font-semibold text-primary shadow-sm active:scale-[0.98] active:bg-white"
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setCashOutOpen(true)}
            className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-primary-foreground/85 bg-transparent px-4 text-base font-semibold text-primary-foreground active:scale-[0.98] active:bg-primary-foreground/10"
          >
            Withdraw
          </button>
        </div>
      </section>

      <section className="mt-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_12px_rgba(13,24,21,0.045)]">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary-muted text-primary">
                <Wallet className="size-5" strokeWidth={2} aria-hidden />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">USDC Balance</p>
            </div>
            <div
              className={
                balanceBlurred
                  ? "mt-3 select-none blur-[8px] transition-[filter] duration-200"
                  : "mt-3 transition-[filter] duration-200"
              }
            >
              {loadingBalances ? (
                <div className="h-7 w-24 animate-pulse rounded bg-neutral-200" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatUsd(usdcBalance || 0)}
                </p>
              )}
            </div>
          </div>

          <Link
            href="/portfolio"
            className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_12px_rgba(13,24,21,0.045)] transition-colors active:bg-neutral-50/90"
          >
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <TrendingUp className="size-5" strokeWidth={2} aria-hidden />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Portfolio</p>
            </div>
            <div
              className={
                balanceBlurred
                  ? "mt-3 select-none blur-[8px] transition-[filter] duration-200"
                  : "mt-3 transition-[filter] duration-200"
              }
            >
              {loadingBalances ? (
                <div className="h-7 w-24 animate-pulse rounded bg-neutral-200" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatUsd(portfolioValue || 0)}
                </p>
              )}
            </div>
          </Link>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="growth-heading">
        <h2 id="growth-heading" className="sr-only">
          Projected growth
        </h2>

        <div
          className="rounded-2xl border border-border/80 bg-white p-4 shadow-[0_2px_20px_rgba(13,24,21,0.06)]"
          role="region"
          aria-label="Projected balance from your pool deposits and current APYs"
        >
          <div className="rounded-2xl border border-border bg-neutral-50 p-4">
            <div
              className="relative h-64"
              onMouseLeave={() => {
                if (loadingBalances) return;
                setGrowthSelectedYear(null);
                setGrowthTooltipYear(null);
                setGrowthTooltipPosition(null);
              }}
            >
              {loadingBalances ? (
                <ProjectionChartSkeleton />
              ) : (
                <>
              <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="homeKudiGrowthBarGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#095342" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {growthYearly.map((p) => {
                  const height = (p.balance / maxGrowthBalance) * 100;
                  const y = 100 - height;
                  return (
                    <line
                      key={`grid-${p.year}`}
                      x1="0"
                      y1={y}
                      x2="100"
                      y2={y}
                      stroke="#d1d5db"
                      strokeWidth="0.2"
                      strokeDasharray="1,1"
                      opacity="0.5"
                    />
                  );
                })}

                {growthYearly.map((p, i) => {
                  const x = (i / (growthYearly.length - 1)) * 100;
                  const height = (p.balance / maxGrowthBalance) * 100;
                  const y = 100 - height;
                  const width = (100 / growthYearly.length) * 0.6;
                  const isSelected = growthSelectedYear === p.year;

                  return (
                    <rect
                      key={`bar-${p.year}`}
                      x={x - width / 2}
                      y={y}
                      width={width}
                      height={height}
                      fill={isSelected ? "#095342" : "url(#homeKudiGrowthBarGradient)"}
                      rx="0.5"
                      className="cursor-pointer transition-colors"
                      onClick={() => setGrowthSelectedYear(p.year)}
                      onMouseEnter={(e) => {
                        setGrowthSelectedYear(p.year);
                        setGrowthTooltipYear(p.year);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const container = e.currentTarget.closest(".relative");
                        if (container) {
                          const containerRect = container.getBoundingClientRect();
                          setGrowthTooltipPosition({
                            x: rect.left - containerRect.left + rect.width / 2,
                            y: rect.top - containerRect.top,
                          });
                        }
                      }}
                    />
                  );
                })}
              </svg>

              <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between text-[10px] font-medium text-muted">
                {growthYTicks
                  .slice()
                  .reverse()
                  .map((tick, i) => (
                    <span key={i}>{formatCurrency(tick)}</span>
                  ))}
              </div>

              {growthTooltipPoint && growthTooltipPosition ? (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-border bg-white px-3 py-2 shadow-lg"
                  style={{
                    left: `${growthTooltipPosition.x}px`,
                    top: `${Math.max(0, growthTooltipPosition.y - 80)}px`,
                  }}
                >
                  <p className="text-xs font-semibold text-foreground">Year {growthTooltipPoint.year}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    Added: {formatCurrencyFull(growthInitialBalance)}
                  </p>
                  <p className="text-[11px] text-green-600">
                    Earned:{" "}
                    {formatCurrencyFull(Math.max(0, growthTooltipPoint.balance - growthInitialBalance))}
                  </p>
                </div>
              ) : null}
                </>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-muted">
              <span>1Y</span>
              <span className="flex items-center gap-1 text-foreground">
                Future Projection
                <button
                  type="button"
                  onClick={() => setGrowthInfoOpen(true)}
                  disabled={loadingBalances}
                  className="inline-flex size-6 items-center justify-center rounded-full text-muted ring-1 ring-border/80 transition-colors hover:bg-white hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="What is this projection?"
                  aria-haspopup="dialog"
                  aria-expanded={growthInfoOpen}
                >
                  <Info className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                </button>
              </span>
              <span>{GROWTH_PROJECTION_YEARS}Y</span>
            </div>
          </div>
        </div>
      </section>

      {growthInfoOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          role="dialog"
          aria-modal
          aria-labelledby="growth-info-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setGrowthInfoOpen(false)}
          />
          <div className="relative z-10 flex w-full max-w-[min(100%,var(--app-max-width))] flex-col items-center rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0 text-center shadow-xl">
            <div className="flex w-full justify-center pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
              <MobileSheetNotch />
            </div>
            <div className="flex w-full justify-end">
              <button
                type="button"
                onClick={() => setGrowthInfoOpen(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-foreground active:bg-neutral-200"
                aria-label="Close"
              >
                <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </div>

            {growthInfoSummary ? (
              growthInfoSummary.hasRates ? (
                <div className="flex w-full max-w-sm flex-col items-center">
                  <span id="growth-info-title" className="sr-only">
                    Earning {growthInfoSummary.apy!.toFixed(2)} percent blended APY. Projected total{" "}
                    {formatUsd(growthInfoSummary.endBalance)} in {GROWTH_PROJECTION_YEARS} years, estimated
                    yield {formatUsd(growthInfoSummary.earned)}.
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <Rocket className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-medium text-muted">
                      Earning {growthInfoSummary.apy!.toFixed(2)}%
                    </span>
                    {/* <span
                      className="inline-flex size-5 items-center justify-center rounded-full bg-neutral-100 text-muted"
                      title="Blended across your pools, using rates shown today."
                      aria-label="Blended across your pools, using rates shown today."
                    >
                      <Info className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
                    </span> */}
                  </div>
                  <p className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-foreground tabular-nums sm:text-[2.125rem]">
                    {formatUsd(growthInfoSummary.endBalance)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-green-600" aria-hidden />
                      <span className="text-sm font-semibold tabular-nums text-green-600">
                        {formatUsd(growthInfoSummary.earned)} Projected in {GROWTH_PROJECTION_YEARS}y
                      </span>
                    </span>
                    {/* <span className="text-sm text-muted"></span> */}
                  </div>
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    {formatUsd(growthInfoSummary.deposited)} in pools now · 
                  </p>
                </div>
              ) : (
                <div className="flex w-full max-w-sm flex-col items-center">
                  <span id="growth-info-title" className="sr-only">
                    Pool balance {formatUsd(growthInfoSummary.deposited)}, APY data loading.
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <Rocket className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-medium text-muted">Earning —</span>
                  </div>
                  <p className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-foreground tabular-nums sm:text-[2.125rem]">
                    {formatUsd(growthInfoSummary.deposited)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-neutral-300" aria-hidden />
                      <span className="text-sm font-medium text-muted">Yield once APYs load</span>
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="flex w-full max-w-sm flex-col items-center">
                <span id="growth-info-title" className="sr-only">
                  Growth chart: deposit on Markets to see your projection.
                </span>
                <div className="flex items-center justify-center gap-2">
                  <Rocket className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                  <span className="text-sm font-medium text-muted">Not in pools yet</span>
                </div>
                <p className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-muted tabular-nums sm:text-[2.125rem]">
                  —
                </p>
                <div className="mt-3 text-sm text-muted">Deposit on Markets to see your numbers here.</div>
              </div>
            )}

            <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted">
              Bars are year-by-year estimates from today&apos;s APYs, compounded daily. Tap a bar
              for detail.
            </p>
            <Link
              href="/simulation"
              onClick={() => setGrowthInfoOpen(false)}
              className="mt-6 w-full max-w-sm inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm active:scale-[0.98] active:bg-primary-hover"
            >
              Try the full simulator
            </Link>
          </div>
        </div>
      ) : null}

      <section className="mt-10" aria-labelledby="activity-heading">
        <div>
          <h2 id="activity-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Recent activity
          </h2>
          <p className="mt-0.5 text-xs text-muted">Deposits, withdrawals, and fee support</p>
        </div>
        {loadingBalances ? (
          <ul className="mt-4 flex flex-col gap-2.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-[0_1px_14px_rgba(13,24,21,0.04)]"
              >
                <div className="size-11 shrink-0 animate-pulse rounded-2xl bg-neutral-100" />
                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                  <div className="h-4 w-[min(100%,14rem)] animate-pulse rounded-md bg-neutral-100" />
                  <div className="h-3 w-24 animate-pulse rounded bg-neutral-100/80" />
                </div>
                <div className="h-5 w-16 shrink-0 animate-pulse rounded-md bg-neutral-100" />
              </li>
            ))}
          </ul>
        ) : activities.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-neutral-50/50 px-5 py-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white shadow-[0_1px_8px_rgba(13,24,21,0.06)] ring-1 ring-border/60">
              <History className="size-6 text-muted" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Nothing here yet</p>
            <p className="mx-auto mt-1.5 max-w-[18rem] text-xs leading-relaxed text-muted">
              Pool deposits, cash outs, and network fee support will appear in this feed.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {activities.map((item) => {
              const when = formatActivityWhen(item.createdAt);
              const Icon =
                item.tone === "positive"
                  ? ArrowDownLeft
                  : item.tone === "out"
                    ? ArrowUpRight
                    : CircleDot;
              const iconWrap =
                item.tone === "positive"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                  : item.tone === "out"
                    ? "bg-neutral-100 text-neutral-700 ring-black/[0.06]"
                    : "bg-amber-50/80 text-amber-800/90 ring-amber-700/10";
              const amountClass =
                item.tone === "positive"
                  ? "text-emerald-700"
                  : item.tone === "out"
                    ? "text-foreground"
                    : "text-muted";

              return (
                <li key={item.id}>
                  <div className="flex gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-[0_1px_14px_rgba(13,24,21,0.04)] transition-colors active:bg-neutral-50/90">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconWrap}`}
                      aria-hidden
                    >
                      <Icon className="size-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[15px] font-semibold leading-snug text-foreground">{item.title}</p>
                        <span className={`shrink-0 text-[15px] font-semibold tabular-nums tracking-tight ${amountClass}`}>
                          {item.amountLabel}
                        </span>
                      </div>
                      {item.detail ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted line-clamp-2">{item.detail}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {when ? (
                          <time
                            className="text-[11px] font-medium tabular-nums text-muted"
                            dateTime={item.createdAt}
                          >
                            {when}
                          </time>
                        ) : null}
                        {item.explorerUrl ? (
                          <>
                            {when ? <span className="text-[11px] text-neutral-300" aria-hidden>·</span> : null}
                            <a
                              href={item.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline"
                            >
                              Explorer
                              <ExternalLink className="size-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* <p className="mt-8 text-center text-xs text-muted">
        Signed in as <span className="font-medium text-foreground">{email}</span>
      </p> */}

      <AddFundsSheet open={addOpen} onOpenChange={setAddOpen} />
      <CashOutSheet open={cashOutOpen} onOpenChange={setCashOutOpen} />
    </>
  );
}
