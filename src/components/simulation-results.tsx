"use client";

import { Clock, X } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import {
  calculateCompoundGrowth,
  formatCurrency,
  formatCurrencyFull,
} from "@/lib/compound-calculator";

export type SimulationResultsTopBar =
  | { variant: "modal"; onClose: () => void }
  | { variant: "page" };

export type SimulationResultsViewProps = {
  apy: number;
  amount: number;
  isMonthly: boolean;
  vaultName?: string;
  onEdit: () => void;
  topBar: SimulationResultsTopBar;
};

/** Core simulation UI — use inside a page or inside a modal shell. */
export function SimulationResultsView({
  apy,
  amount,
  isMonthly,
  vaultName,
  onEdit,
  topBar,
}: SimulationResultsViewProps) {
  const gradientId = `simBarGrad-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [years, setYears] = useState(30);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [tooltipYear, setTooltipYear] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const projections = useMemo(
    () =>
      calculateCompoundGrowth({
        apy,
        principal: isMonthly ? 0 : amount,
        monthlyContribution: isMonthly ? amount : 0,
        years,
      }),
    [apy, amount, isMonthly, years],
  );

  const final = projections[projections.length - 1];
  const displayData = selectedYear
    ? projections.find((p) => p.year === selectedYear) ?? final
    : final;

  const tooltipData = tooltipYear ? projections.find((p) => p.year === tooltipYear) : null;

  const maxBalance = Math.max(...projections.map((p) => p.balance));
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((pct) => maxBalance * pct);

  const handleReset = () => {
    setYears(30);
    setSelectedYear(null);
    setTooltipYear(null);
    setTooltipPosition(null);
    if (topBar.variant === "modal") {
      topBar.onClose();
    }
  };

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-medium text-muted active:bg-neutral-200"
        >
          Reset
        </button>
        {topBar.variant === "modal" ? (
          <button
            type="button"
            onClick={topBar.onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-foreground active:bg-neutral-200"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <Link
            href="/markets"
            className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Markets
          </Link>
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm font-medium text-muted">{apy.toFixed(2)}% APY</p>
        {vaultName ? (
          <p className="mt-1 text-xs text-muted">{vaultName}</p>
        ) : null}
        <p
          id="sim-results-title"
          className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-primary"
        >
          {formatCurrencyFull(displayData?.balance ?? 0)}
        </p>
        <p className="mt-2 text-base font-medium text-foreground">
          {formatCurrencyFull(displayData?.totalEarned ?? 0)} Earned{" "}
          <span className="text-muted">in {displayData?.year ?? years} Years</span>
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-neutral-50 p-4">
        <div
          className="relative h-64"
          onMouseLeave={() => {
            setSelectedYear(null);
            setTooltipYear(null);
            setTooltipPosition(null);
          }}
        >
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#095342" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {projections.map((p) => {
              const height = (p.balance / maxBalance) * 100;
              const y = 100 - height;

              return (
                <line
                  key={`line-${p.year}`}
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

            {projections.map((p, i) => {
              const x = (i / (projections.length - 1)) * 100;
              const height = (p.balance / maxBalance) * 100;
              const y = 100 - height;
              const width = (100 / projections.length) * 0.6;
              const isSelected = selectedYear === p.year;

              return (
                <rect
                  key={p.year}
                  x={x - width / 2}
                  y={y}
                  width={width}
                  height={height}
                  fill={isSelected ? "#095342" : `url(#${gradientId})`}
                  rx="0.5"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedYear(p.year)}
                  onMouseEnter={(e) => {
                    setSelectedYear(p.year);
                    setTooltipYear(p.year);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const container = e.currentTarget.closest(".relative");
                    if (container) {
                      const containerRect = container.getBoundingClientRect();
                      setTooltipPosition({
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
            {[...yTicks].reverse().map((tick, i) => (
              <span key={i}>{formatCurrency(tick)}</span>
            ))}
          </div>

          {tooltipData && tooltipPosition ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-border bg-white px-3 py-2 shadow-lg"
              style={{
                left: `${tooltipPosition.x}px`,
                top: `${Math.max(0, tooltipPosition.y - 80)}px`,
              }}
            >
              <p className="text-xs font-semibold text-foreground">Year {tooltipData.year}</p>
              <p className="mt-1 text-[11px] text-muted">
                Added: {formatCurrencyFull(tooltipData.totalDeposited)}
              </p>
              <p className="text-[11px] text-green-600">
                Earned: {formatCurrencyFull(tooltipData.totalEarned)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-medium text-muted">
          <span>1Y</span>
          <span className="text-foreground">Future Projection</span>
          <span>{years}Y</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-neutral-50 px-5 py-4">
        <div className="min-w-0">
          <p className="text-lg font-bold text-foreground">
            {formatCurrencyFull(amount)} {isMonthly ? "Every Month" : "One-Off"}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            For {years} Years
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:bg-primary-hover"
        >
          Edit Simulation
        </button>
      </div>
    </div>
  );
}

type SimulationResultsModalProps = {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  apy: number;
  amount: number;
  isMonthly: boolean;
  vaultName?: string;
};

/** Full-screen bottom sheet — used from vault detail. */
export function SimulationResults({
  open,
  onClose,
  onEdit,
  apy,
  amount,
  isMonthly,
  vaultName,
}: SimulationResultsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-labelledby="sim-results-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-[min(100%,var(--app-max-width))] flex-col overflow-y-auto rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl">
        <SimulationResultsView
          apy={apy}
          amount={amount}
          isMonthly={isMonthly}
          vaultName={vaultName}
          onEdit={onEdit}
          topBar={{ variant: "modal", onClose }}
        />
      </div>
    </div>
  );
}
