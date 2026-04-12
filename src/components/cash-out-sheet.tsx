"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, Loader2 } from "lucide-react";
import { formatUnits, isAddress, parseUnits } from "ethers";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { fetchWalletBalance } from "@/lib/wallet-fetch";
import { walletKeys } from "@/lib/wallet-query-keys";

type Flow = "choose" | "usdc" | "usdc-done";

/** Match “Add Money From” bank strip (see `add-funds-sheet.tsx`). */
const CASH_OUT_BANK_ICONS = [
  "/banks/first-city-monument-bank.png",
  "/banks/guaranty-trust-bank.png",
  "/banks/polaris-bank.png",
  "/banks/stanbic-ibtc-bank.png",
] as const;

const CASH_OUT_CRYPTO_ICONS = ["/crypto/usdt.svg", "/crypto/usdc.svg"] as const;

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Human-friendly USDC string from base units (trim trailing zeros). */
function usdcBaseUnitsToInput(baseUnits: string) {
  const raw = formatUnits(BigInt(baseUnits), 6);
  if (!raw.includes(".")) return raw;
  return raw.replace(/\.?0+$/, "") || "0";
}

export function CashOutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<Flow>("choose");
  const [toAddress, setToAddress] = useState("");
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneExplorerUrl, setDoneExplorerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFlow("choose");
      setToAddress("");
      setAmountText("");
      setSubmitting(false);
      setError(null);
      setDoneExplorerUrl(null);
    }
  }, [open]);

  const balanceEnabled = open && flow === "usdc";
  const {
    data: balanceData,
    isFetching: loadingBalance,
  } = useQuery({
    queryKey: walletKeys.balance(),
    queryFn: fetchWalletBalance,
    enabled: balanceEnabled,
  });

  const availableUsdc = balanceData?.balance ?? 0;
  const balanceBaseUnits =
    balanceData && /^[0-9]+$/.test(balanceData.balanceBaseUnits) ? balanceData.balanceBaseUnits : null;

  const goBack = useCallback(() => {
    if (flow === "usdc") setFlow("choose");
    else if (flow === "usdc-done") {
      setDoneExplorerUrl(null);
      setFlow("usdc");
    }
  }, [flow]);

  const addressOk = isAddress(toAddress.trim());

  let amountBaseUnits: string | null = null;
  const t = amountText.trim();
  if (t.length > 0 && /^[0-9]*\.?[0-9]*$/.test(t) && Number(t) > 0) {
    try {
      amountBaseUnits = parseUnits(t, 6).toString();
    } catch {
      amountBaseUnits = null;
    }
  }

  const canSubmit =
    addressOk &&
    amountBaseUnits !== null &&
    !submitting &&
    amountText.trim().length > 0 &&
    Number(amountText) > 0;

  const sheetTitle =
    flow === "choose" ? "Cash Out To" : flow === "usdc" ? "Send USDC" : "Sent";

  const showBack = flow !== "choose";

  async function handleSend() {
    if (!canSubmit || !amountBaseUnits) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/withdraw-usdc", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: toAddress.trim(),
          amount: amountBaseUnits,
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Could not send USDC.";
        throw new Error(msg);
      }
      const explorer =
        typeof data === "object" &&
        data !== null &&
        "explorerUrl" in data &&
        typeof (data as { explorerUrl: unknown }).explorerUrl === "string"
          ? (data as { explorerUrl: string }).explorerUrl
          : null;
      setDoneExplorerUrl(explorer);
      setFlow("usdc-done");
      setAmountText("");
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={sheetTitle}
      showClose
      stackClassName="z-[56]"
    >
      <div className="flex flex-col gap-4 pb-2">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            className="-mt-1 flex w-fit items-center gap-1 text-sm font-semibold text-primary active:opacity-80"
          >
            <ChevronLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            Back
          </button>
        ) : null}

        {flow === "choose" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Choose how you want to move funds out of Kudi.
            </p>
            <button
              type="button"
              onClick={() => setFlow("usdc")}
              className="relative w-full rounded-2xl border border-border bg-white p-4 text-left shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04] transition-colors active:bg-neutral-50/90"
            >
              <div className="flex items-start justify-between gap-3 pr-1">
                <div className="min-w-0">
                  <p className="text-base font-bold tracking-tight text-foreground">Crypto wallet</p>
                  <p className="mt-0.5 text-sm text-muted">USDC on {KUDI_CHAIN.name} · any address</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  Suggested
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center pl-0.5">
                  {CASH_OUT_CRYPTO_ICONS.map((src, i) => (
                    <div
                      key={src}
                      className={`relative size-9 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                      style={{ zIndex: CASH_OUT_CRYPTO_ICONS.length - i }}
                    >
                      <Image
                        src={src}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 object-contain p-1"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium text-muted">Stablecoins</p>
              </div>
            </button>

            <div
              className="relative w-full rounded-2xl border border-border bg-white p-4 opacity-[0.72] shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04]"
              aria-disabled="true"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold tracking-tight text-foreground">Bank account</p>
                    <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-700">
                      Coming soon
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">Local currency to your bank</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center pl-0.5">
                  {CASH_OUT_BANK_ICONS.map((src, i) => (
                    <div
                      key={src}
                      className={`relative size-9 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                      style={{ zIndex: CASH_OUT_BANK_ICONS.length - i }}
                    >
                      <Image
                        src={src}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 object-cover"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium text-muted">+12,000 banks</p>
              </div>
            </div>
          </div>
        ) : null}

        {flow === "usdc" ? (
          <>
            <p className="text-sm text-muted">
              Enter a {KUDI_CHAIN.name} address and amount. Your Kudi wallet also needs a small amount of
              ETH on Base for network fees.
            </p>
            <div className="flex items-center justify-between rounded-xl border border-border bg-neutral-50/80 px-3 py-2.5">
              <span className="text-xs font-semibold text-muted">Available USDC</span>
              {loadingBalance ? (
                <div className="h-5 w-20 animate-pulse rounded bg-neutral-200" />
              ) : (
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {formatUsd(availableUsdc ?? 0)}
                </span>
              )}
            </div>
            <div>
              <label htmlFor="cashout-to" className="text-xs font-semibold text-muted">
                Destination address
              </label>
              <input
                id="cashout-to"
                autoComplete="off"
                spellCheck={false}
                placeholder="0x…"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value.trim())}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-3 font-mono text-sm text-foreground outline-none ring-primary/20 focus:ring-2"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="cashout-amt" className="text-xs font-semibold text-muted">
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
                id="cashout-amt"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value.replace(/[^\d.]/g, ""));
                }}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-3 text-lg font-semibold tabular-nums text-foreground outline-none ring-primary/20 focus:ring-2"
              />
            </div>
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSend}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-40 active:bg-primary-hover"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send USDC"
              )}
            </button>
          </>
        ) : null}

        {flow === "usdc-done" && doneExplorerUrl ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04]">
              <p className="text-sm leading-relaxed text-muted">
                Your USDC transfer was submitted. It may take a short time to confirm on{" "}
                {KUDI_CHAIN.name}.
              </p>
            </div>
            <a
              href={doneExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-primary shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04] active:bg-neutral-50/90"
            >
              View on block explorer
              <ArrowUpRight className="size-4 shrink-0" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-12 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm active:bg-primary-hover"
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
