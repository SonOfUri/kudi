"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits } from "ethers";
import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { DepositSuccessCelebration } from "@/components/deposit-success-celebration";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { fetchWalletBalance } from "@/lib/wallet-fetch";
import { walletKeys } from "@/lib/wallet-query-keys";

type VaultInvestModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: string;
  poolName?: string;
  protocolName?: string;
  vaultSlug?: string;
  /** Shown APY % (total); sent as fallback if the server Earn snapshot misses this vault. */
  apyTotal?: number;
};

function usdcBaseUnitsToInput(baseUnits: string) {
  const raw = formatUnits(BigInt(baseUnits), 6);
  if (!raw.includes(".")) return raw;
  return raw.replace(/\.?0+$/, "") || "0";
}

export function VaultInvestModal({
  open,
  onClose,
  vaultAddress,
  poolName,
  protocolName,
  vaultSlug,
  apyTotal,
}: VaultInvestModalProps) {
  const queryClient = useQueryClient();
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    explorerUrl: string | null;
    amountLabel: string;
  } | null>(null);

  const { data: balanceData, isFetching: loadingBalance } = useQuery({
    queryKey: walletKeys.balance(),
    queryFn: fetchWalletBalance,
    enabled: open,
  });

  const balanceBaseUnits =
    balanceData && /^[0-9]+$/.test(balanceData.balanceBaseUnits) ? balanceData.balanceBaseUnits : null;

  useEffect(() => {
    if (!open) {
      setAmountText("");
      setSubmitting(false);
      setError(null);
      setSuccessInfo(null);
    }
  }, [open]);

  let fromAmount: string | null = null;
  const t = amountText.trim();
  if (t.length > 0 && /^[0-9]*\.?[0-9]*$/.test(t) && Number(t) > 0) {
    try {
      fromAmount = parseUnits(t, 6).toString();
    } catch {
      fromAmount = null;
    }
  }

  const canSubmit =
    fromAmount !== null && !submitting && amountText.trim().length > 0 && Number(amountText) > 0;

  async function handleSubmit() {
    if (!fromAmount) return;
    setSubmitting(true);
    setError(null);
    setSuccessInfo(null);
    try {
      const res = await fetch("/api/lifi/deposit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultAddress,
          fromAmount,
          vaultLabel: poolName?.trim() || undefined,
          protocolName: protocolName?.trim() || undefined,
          vaultSlug: vaultSlug?.trim() || undefined,
          apyTotalAtDeposit:
            apyTotal != null && Number.isFinite(apyTotal) ? apyTotal : undefined,
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
              : "Could not add to this pool.";
        throw new Error(msg);
      }
      const url =
        typeof data === "object" &&
        data !== null &&
        "explorerUrl" in data &&
        typeof (data as { explorerUrl: unknown }).explorerUrl === "string"
          ? (data as { explorerUrl: string }).explorerUrl
          : null;
      const amt = Number(amountText.trim());
      const amountLabel = Number.isFinite(amt)
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(amt)
        : "Your deposit";
      setSuccessInfo({ explorerUrl: url, amountLabel });
      setAmountText("");
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const showSuccess = successInfo !== null;

  function closeAll() {
    setSuccessInfo(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-labelledby={showSuccess ? "deposit-success-title" : "vault-invest-title"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={closeAll}
      />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-[min(100%,var(--app-max-width))] flex-col overflow-y-auto rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl">
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
            <DepositSuccessCelebration
              active
              poolName={poolName}
              amountLabel={successInfo.amountLabel}
              explorerUrl={successInfo.explorerUrl}
              onDone={closeAll}
            />
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="vault-invest-title" className="text-lg font-bold text-foreground">
                  Add to this pool
                </h2>
                {poolName ? (
                  <p className="mt-1 text-sm text-muted line-clamp-2">{poolName}</p>
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
              Move USDC from your Kudi wallet into this yield pool on {KUDI_CHAIN.name}. You need a little ETH
              in the same wallet for network fees.
            </p>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5">
              <span className="text-xs font-semibold text-muted">Available in wallet</span>
              {loadingBalance ? (
                <div className="h-5 w-20 animate-pulse rounded bg-neutral-200" />
              ) : (
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {balanceBaseUnits != null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      }).format(Number(formatUnits(BigInt(balanceBaseUnits), 6)))
                    : "—"}
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="vault-invest-amt" className="text-xs font-semibold text-muted">
                  Amount (USDC)
                </label>
                <button
                  type="button"
                  disabled={loadingBalance || !balanceBaseUnits || balanceBaseUnits === "0"}
                  onClick={() => {
                    if (!balanceBaseUnits || balanceBaseUnits === "0") return;
                    setAmountText(usdcBaseUnitsToInput(balanceBaseUnits));
                    setError(null);
                  }}
                  className="text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40 active:opacity-80"
                >
                  Max
                </button>
              </div>
              <input
                id="vault-invest-amt"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ""))}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-3 text-lg font-semibold tabular-nums text-foreground outline-none ring-primary/20 focus:ring-2"
              />
            </div>

            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-950"
              >
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" strokeWidth={2} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Couldn&apos;t add to this pool</p>
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
                  Working…
                </>
              ) : (
                "Confirm"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
