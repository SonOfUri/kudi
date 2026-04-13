"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProtocolLogo } from "@/components/protocol-logo";
import { VaultInvestModal } from "@/components/vault-invest-modal";
import { VaultWithdrawModal } from "@/components/vault-withdraw-modal";
import { calculateCompoundGrowth, formatCurrency, formatCurrencyFull } from "@/lib/compound-calculator";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { fetchWalletPortfolio } from "@/lib/wallet-fetch";
import { walletKeys } from "@/lib/wallet-query-keys";

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Est. earned (illustrative daily) — extra decimals for small amounts. */
function formatUsdEarned(amount: number) {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(amount);
}

function protocolDisplayName(protocolName: string | undefined): string {
  if (!protocolName) return "Unknown";
  if (protocolName === "morpho-v1") return "Morpho V1";
  if (protocolName === "aave-v3") return "Aave V3";
  if (protocolName === "yo-protocol") return "Yo Protocol";
  if (protocolName === "pendle") return "Pendle";
  if (protocolName.toLowerCase().startsWith("euler")) return "Euler";
  return protocolName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function tokenLogoPath(symbol: string | undefined): string | null {
  if (!symbol) return null;
  const s = symbol.toLowerCase();
  if (s === "usdc") return "/crypto/usdc.svg";
  if (s === "usdt") return "/crypto/usdt.svg";
  if (s === "eurc") return "/crypto/eurc.svg";
  return null;
}

export function PortfolioContent() {
  const {
    data,
    isPending,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: walletKeys.portfolio(),
    queryFn: fetchWalletPortfolio,
  });

  const loading = isPending;
  const error = isError ? (queryError instanceof Error ? queryError.message : "Could not load portfolio") : null;

  const [investVault, setInvestVault] = useState<{
    address: string;
    name: string;
    apyTotal?: number;
  } | null>(null);
  const [withdrawVault, setWithdrawVault] = useState<{
    address: string;
    name: string;
    shareBalance: string;
    positionUsd: number;
    apyTotal?: number;
    assetSymbol?: string;
  } | null>(null);
  const [illustrativeGrowthOpen, setIllustrativeGrowthOpen] = useState(false);

  const rows = useMemo(() => data?.positions ?? [], [data?.positions]);
  const totalValue = data?.totalValue ?? 0;
  const summary = data?.summary;

  const weightedApy = useMemo(() => {
    let num = 0;
    let den = 0;
    for (const row of rows) {
      const apy = row.vault?.apyTotal;
      const usd = Number(row.position?.balanceUsd);
      if (apy == null || !Number.isFinite(apy) || !Number.isFinite(usd) || usd <= 0) continue;
      num += usd * apy;
      den += usd;
    }
    if (den <= 0) return null;
    return num / den;
  }, [rows]);

  const projection = useMemo(() => {
    const apy = weightedApy ?? 4;
    if (totalValue <= 0) return null;
    const curve = calculateCompoundGrowth({
      apy,
      principal: totalValue,
      monthlyContribution: 0,
      years: 5,
    });
    const y1 = curve[0];
    const y5 = curve[curve.length - 1];
    return { apy, y1, y5 };
  }, [totalValue, weightedApy]);

  return (
    <div className="flex flex-col pb-6 pt-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Portfolio</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Yield on <span className="font-medium text-foreground/90">{KUDI_CHAIN.name}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-foreground ring-1 ring-black/[0.04] transition-colors active:bg-neutral-200 disabled:opacity-50"
          aria-label="Refresh portfolio"
        >
          <RefreshCw className={`size-[1.15rem] ${isFetching ? "animate-spin" : ""}`} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {loading && !data ? (
        <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading portfolio">
          <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-[0_1px_14px_rgba(13,24,21,0.04)]">
            <div className="grid gap-5 sm:grid-cols-3 sm:gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2 sm:border-l sm:border-border/50 sm:pl-5 first:sm:border-l-0 first:sm:pl-0">
                  <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
                  <div className="h-9 w-[min(100%,9rem)] animate-pulse rounded-lg bg-neutral-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-36 animate-pulse rounded-2xl bg-neutral-100/90" />
        </div>
      ) : null}

      {error ? (
        <div
          className="mt-6 flex gap-3 rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3.5 text-sm text-red-950 shadow-[0_1px_12px_rgba(127,29,29,0.06)]"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" strokeWidth={2} aria-hidden />
          <p className="min-w-0 leading-relaxed">{error}</p>
        </div>
      ) : null}

      {!loading || data ? (
        <>
          <section className="mt-6">
            <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-[0_1px_14px_rgba(13,24,21,0.04)]">
              <div className="grid gap-6 sm:grid-cols-2 sm:gap-0">
                <div className="sm:border-r sm:border-border/60 sm:pr-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">In pools</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                    {formatUsd(totalValue)}
                  </p>
                  <p className="mt-1 text-xs text-muted">Current balance</p>
                </div>
                {/* <div className="sm:border-r sm:border-border/60 sm:px-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Deposited
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                    {formatUsd(summary?.totalDepositedFromAppUsd ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-muted">In-app deposits</p>
                </div> */}
                <div className="sm:pl-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Est. earned</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[#15803d]">
                    {summary?.estimatedEarnedUsd != null
                      ? formatUsdEarned(summary.estimatedEarnedUsd)
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">~1 day at APY</p>
                </div>
              </div>
            </div>
          </section>

          {summary?.earnNote ? (
            <p className="mt-3 rounded-xl bg-neutral-50/90 px-3.5 py-2.5 text-xs leading-relaxed text-muted ring-1 ring-border/50">
              {summary.earnNote}
            </p>
          ) : null}

          {projection && totalValue > 0 ? (
            <section className="mt-6 overflow-hidden rounded-2xl border border-border/80 bg-white shadow-[0_1px_14px_rgba(13,24,21,0.04)]">
              <button
                type="button"
                onClick={() => setIllustrativeGrowthOpen((o) => !o)}
                aria-expanded={illustrativeGrowthOpen}
                className={`flex w-full items-start gap-3 bg-gradient-to-b from-primary-muted/35 to-transparent px-5 py-4 text-left transition-colors hover:bg-primary-muted/25 active:bg-primary-muted/30 ${illustrativeGrowthOpen ? "border-b border-border/60" : ""}`}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-[0_1px_8px_rgba(13,24,21,0.06)] ring-1 ring-primary/15">
                  <TrendingUp className="size-5" strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Illustrative growth</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    If today&apos;s blended rate held, compound growth on your pool balance
                    {weightedApy != null ? ` (~${weightedApy.toFixed(2)}% APY)` : " (~4% placeholder)"}. Not a
                    forecast.
                  </p>
                </div>
                <ChevronDown
                  className={`mt-2 size-5 shrink-0 text-muted transition-transform duration-200 ${illustrativeGrowthOpen ? "rotate-180" : ""}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
              {illustrativeGrowthOpen ? (
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-neutral-50/90 px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">1 year</p>
                    <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-foreground">
                      {formatCurrencyFull(projection.y1.balance)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#15803d]">
                      +{formatCurrency(projection.y1.totalEarned)} est. yield
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-neutral-50/90 px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">5 years</p>
                    <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-foreground">
                      {formatCurrencyFull(projection.y5.balance)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#15803d]">
                      +{formatCurrency(projection.y5.totalEarned)} est. yield
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="mt-8">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Active positions</h2>
              <Link
                href="/markets"
                className="flex items-center gap-0.5 text-sm font-semibold text-primary active:opacity-80"
              >
                Browse pools
                <ChevronRight className="size-4" strokeWidth={2.5} aria-hidden />
              </Link>
            </div>

            {rows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-neutral-50/80 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No active yield positions yet</p>
                <p className="mt-2 text-sm text-muted">
                  Choose a pool on Markets to put your USDC to work.
                </p>
                <Link
                  href="/markets"
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm active:bg-primary-hover"
                >
                  Go to Markets
                </Link>
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {rows.map((row, idx) => {
                  const pos = row.position;
                  const sym = pos.asset?.symbol;
                  const protocol = protocolDisplayName(pos.protocolName);
                  const current = Number(pos.balanceUsd);
                  const currentUsd = Number.isFinite(current) ? current : 0;
                  const logo = tokenLogoPath(sym);
                  const v = row.vault;

                  return (
                    <li
                      key={`${pos.chainId}-${pos.protocolName}-${sym}-${idx}`}
                      className="rounded-2xl border border-border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex size-12 shrink-0 items-center justify-center">
                          {logo ? (
                            <Image
                              src={logo}
                              alt={sym || ""}
                              width={48}
                              height={48}
                              className="size-12 rounded-full"
                            />
                          ) : (
                            <div className="flex size-12 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-700">
                              {(sym || "?").slice(0, 2)}
                            </div>
                          )}
                          <Image
                            src="/chain/base.jpeg"
                            alt="Base"
                            width={18}
                            height={18}
                            className="absolute -bottom-0.5 -right-0.5 size-[18px] rounded-full border-2 border-white"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">
                            {v?.vaultName || pos.asset?.name || `${sym || "Asset"} pool`}
                          </p>
                          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <ProtocolLogo protocolName={pos.protocolName} size={14} />
                              {protocol}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{sym || "—"}</span>
                          </p>
                          {row.appDepositAttribution ? (
                            <p className="mt-1 text-[11px] leading-snug text-muted">
                              Pool verified from your Kudi deposit (Li.fi position details can be inaccurate).
                            </p>
                          ) : null}
                          {v?.apyTotal != null ? (
                            <p className="mt-1 text-xs font-semibold text-[#15803d]">
                              {v.apyTotal.toFixed(2)}% APY
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold tabular-nums text-foreground">
                            {formatUsd(currentUsd)}
                          </p>
                          <p className="text-xs text-muted">now</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-neutral-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            Net from app
                          </p>
                          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                            {row.depositedFromAppUsd != null ? formatUsd(row.depositedFromAppUsd) : "—"}
                          </p>
                          <p className="mt-1 text-[10px] leading-snug text-muted">
                            Deposits minus Kudi withdrawals
                          </p>
                        </div>
                        <div className="rounded-xl bg-neutral-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            Est. earned
                          </p>
                          <p className="mt-0.5 font-semibold tabular-nums text-[#15803d]">
                            {row.estimatedEarnedUsd != null
                              ? formatUsdEarned(row.estimatedEarnedUsd)
                              : "—"}
                          </p>
                          <p className="mt-1 text-[10px] leading-snug text-muted">Balance x APY / 365</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {v ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setInvestVault({
                                  address: v.vaultAddress,
                                  name: v.vaultName || `${sym || "Pool"} · ${protocol}`,
                                  apyTotal:
                                    v.apyTotal != null && Number.isFinite(v.apyTotal)
                                      ? v.apyTotal
                                      : undefined,
                                })
                              }
                              className="min-h-11 flex-1 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm active:bg-primary-hover"
                            >
                              Deposit
                            </button>
                            <button
                              type="button"
                              disabled={!v.isRedeemable}
                              onClick={() =>
                                setWithdrawVault({
                                  address: v.vaultAddress,
                                  name: v.vaultName || `${sym || "Pool"} · ${protocol}`,
                                  shareBalance: v.shareBalance,
                                  positionUsd: currentUsd,
                                  apyTotal:
                                    v.apyTotal != null && Number.isFinite(v.apyTotal)
                                      ? v.apyTotal
                                      : undefined,
                                  assetSymbol: sym ?? undefined,
                                })
                              }
                              className="min-h-11 flex-1 rounded-xl border-2 border-border bg-white px-3 text-sm font-semibold text-foreground active:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Withdraw
                            </button>
                          </>
                        ) : (
                          <Link
                            href="/markets"
                            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary-muted/20 px-3 text-sm font-semibold text-primary active:bg-primary-muted/40"
                          >
                            Match pool on Markets
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {investVault ? (
        <VaultInvestModal
          open
          onClose={() => setInvestVault(null)}
          vaultAddress={investVault.address}
          poolName={investVault.name}
          apyTotal={investVault.apyTotal}
        />
      ) : null}

      {withdrawVault ? (
        <VaultWithdrawModal
          open
          onClose={() => setWithdrawVault(null)}
          vaultAddress={withdrawVault.address}
          poolName={withdrawVault.name}
          initialShareBalance={withdrawVault.shareBalance}
          positionUsd={withdrawVault.positionUsd}
          apyTotal={withdrawVault.apyTotal}
          assetSymbol={withdrawVault.assetSymbol}
        />
      ) : null}
    </div>
  );
}
