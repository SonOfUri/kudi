"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { walletKeys } from "@/lib/wallet-query-keys";

type VaultWithdrawModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: string;
  poolName?: string;
  /** Initial max from portfolio match; refreshed on open. */
  initialShareBalance?: string | null;
  /** Portfolio row value in USD (for estimates only). */
  positionUsd?: number;
  /** Pool APY % for context. */
  apyTotal?: number;
  /** e.g. USDC */
  assetSymbol?: string;
  onSuccess?: () => void;
};

const PRESETS = [
  { label: "25%", pct: 25 },
  { label: "50%", pct: 50 },
  { label: "Max", pct: 100 },
] as const;

function pctOfBalance(balance: bigint, pct: number): bigint {
  if (pct >= 100) return balance;
  const bps = Math.round(pct * 100);
  const out = (balance * BigInt(bps)) / BigInt(10000);
  const z = BigInt(0);
  return out > z ? out : z;
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function VaultWithdrawModal({
  open,
  onClose,
  vaultAddress,
  poolName,
  initialShareBalance,
  positionUsd,
  apyTotal,
  assetSymbol,
  onSuccess,
}: VaultWithdrawModalProps) {
  const queryClient = useQueryClient();
  const [shareBalance, setShareBalance] = useState<string | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [pct, setPct] = useState<number>(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const loadBalance = useCallback(async () => {
    setLoadingBal(true);
    try {
      const res = await fetch(
        `/api/wallet/vault-share-balance?vaultAddress=${encodeURIComponent(vaultAddress)}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = (await res.json()) as { balance?: string };
        if (typeof data.balance === "string" && /^[0-9]+$/.test(data.balance)) {
          setShareBalance(data.balance);
          return;
        }
      }
      setShareBalance(null);
    } finally {
      setLoadingBal(false);
    }
  }, [vaultAddress]);

  useEffect(() => {
    if (!open) {
      setShareBalance(null);
      setLoadingBal(false);
      setPct(100);
      setSubmitting(false);
      setError(null);
      setExplorerUrl(null);
      setWithdrawSuccess(false);
      return;
    }
    if (initialShareBalance && /^[1-9][0-9]*$/.test(initialShareBalance)) {
      setShareBalance(initialShareBalance);
    }
    void loadBalance();
  }, [open, loadBalance, initialShareBalance]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const balanceBn = useMemo(() => {
    if (!shareBalance || !/^[0-9]+$/.test(shareBalance)) return null;
    try {
      return BigInt(shareBalance);
    } catch {
      return null;
    }
  }, [shareBalance]);

  const fromAmount = useMemo(() => {
    const z = BigInt(0);
    if (!balanceBn || balanceBn === z) return null;
    const raw = pctOfBalance(balanceBn, pct);
    return raw > z ? raw.toString() : null;
  }, [balanceBn, pct]);

  const positionUsdOk = positionUsd != null && Number.isFinite(positionUsd) && positionUsd > 0;
  const estimatedReceiveUsd = useMemo(() => {
    if (!positionUsdOk) return null;
    return (positionUsd! * pct) / 100;
  }, [positionUsdOk, positionUsd, pct]);

  const canSubmit = fromAmount !== null && !submitting && !loadingBal && !withdrawSuccess;

  async function handleSubmit() {
    if (!fromAmount) return;
    setSubmitting(true);
    setError(null);
    setExplorerUrl(null);
    setWithdrawSuccess(false);
    try {
      const res = await fetch("/api/lifi/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultAddress,
          fromAmount,
          vaultLabel: poolName?.trim() || undefined,
        }),
      });
      const text = await res.text();
      let data: unknown = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : res.status >= 500
              ? "Something went wrong. Please try again."
              : "Could not withdraw from this pool.";
        throw new Error(msg);
      }
      const url =
        typeof data === "object" &&
        data !== null &&
        "explorerUrl" in data &&
        typeof (data as { explorerUrl: unknown }).explorerUrl === "string"
          ? (data as { explorerUrl: string }).explorerUrl
          : null;
      setExplorerUrl(url);
      setWithdrawSuccess(true);
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      onSuccess?.();
      void loadBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const showSuccess = withdrawSuccess;
  const symLabel = assetSymbol?.trim() || "USDC";

  function closeAll() {
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-labelledby={showSuccess ? "vault-withdraw-success-title" : "vault-withdraw-title"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={closeAll}
      />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-[min(100%,var(--app-max-width))] flex-col overflow-y-auto rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-xl">
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-neutral-200" aria-hidden />

        {showSuccess ? (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeAll}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted active:bg-neutral-100"
                aria-label="Close"
              >
                <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="flex flex-col items-center px-1 pb-2 pt-1 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="size-8 text-emerald-600" strokeWidth={2} aria-hidden />
              </div>
              <h2 id="vault-withdraw-success-title" className="mt-4 text-xl font-bold text-foreground">
                Withdrawal submitted
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                {symLabel} will land in your Kudi wallet on {KUDI_CHAIN.name} after the network confirms the
                transaction. Pull to refresh on Home if your balance doesn&apos;t update right away.
              </p>
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex min-h-11 w-full max-w-sm items-center justify-center gap-2 rounded-xl border-2 border-border bg-white px-4 text-sm font-semibold text-foreground shadow-sm active:bg-neutral-50"
                >
                  View on explorer
                  <ArrowUpRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                </a>
              ) : null}
              <button
                type="button"
                onClick={closeAll}
                className="mt-3 flex min-h-12 w-full max-w-sm items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm active:bg-primary-hover"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="min-w-0">
                <h2 id="vault-withdraw-title" className="text-lg font-bold text-foreground">
                  Withdraw to wallet
                </h2>
                {poolName ? (
                  <p className="mt-1 text-sm font-medium text-foreground/90 line-clamp-2">{poolName}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  Redeem vault shares → {symLabel} on {KUDI_CHAIN.name}
                </p>
                {apyTotal != null && Number.isFinite(apyTotal) ? (
                  <p className="mt-1.5 text-xs font-semibold text-[#15803d]">{apyTotal.toFixed(2)}% APY</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted active:bg-neutral-100"
                aria-label="Close"
              >
                <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              We route the redemption through the protocol; proceeds settle in your in-app wallet. Keep a little
              ETH in the same wallet for gas.
            </p>

            <div className="mt-4 rounded-xl border border-border/80 bg-neutral-50/90 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted">Position value (est.)</span>
                {loadingBal ? (
                  <div className="h-5 w-24 animate-pulse rounded bg-neutral-200" />
                ) : (
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {positionUsdOk ? formatUsd(positionUsd!) : "—"}
                  </span>
                )}
              </div>
              {!positionUsdOk && !loadingBal ? (
                <p className="mt-1.5 text-[11px] leading-snug text-muted">
                  USD estimate unavailable; withdrawal still uses your on-chain share balance.
                </p>
              ) : null}
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-muted">How much to withdraw</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map(({ label, pct: p }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={loadingBal || !balanceBn || balanceBn === BigInt(0)}
                    onClick={() => {
                      setPct(p);
                      setError(null);
                    }}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      pct === p
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-white text-foreground active:bg-neutral-50"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loadingBal ? (
              <div className="mt-4 h-14 animate-pulse rounded-xl bg-neutral-100" />
            ) : balanceBn === null || balanceBn === BigInt(0) ? (
              <p className="mt-4 text-sm text-muted">No vault shares to withdraw from this wallet.</p>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-3 py-3">
                <p className="text-xs font-semibold text-muted">You&apos;re redeeming</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {pct === 100 ? "Your full position" : `${pct}% of this position`}
                </p>
                {estimatedReceiveUsd != null ? (
                  <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">
                    ~{formatUsd(estimatedReceiveUsd)}{" "}
                    <span className="text-sm font-semibold text-muted">{symLabel}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    Share amount scales with your balance; exact {symLabel} depends on the live vault rate.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2.5 rounded-xl border border-border/60 bg-neutral-50 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">
                Withdrawals are on-chain and may take a minute. Slippage or protocol limits can affect the
                final amount.
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-950"
              >
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" strokeWidth={2} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Couldn&apos;t withdraw</p>
                  <p className="mt-1 text-sm leading-relaxed text-red-900/90">{error}</p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-40 active:bg-primary-hover"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                "Confirm withdrawal"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
