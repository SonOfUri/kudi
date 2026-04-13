"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Landmark,
  Loader2,
  Search,
} from "lucide-react";
import { formatUnits, isAddress, parseUnits } from "ethers";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";
import {
  BANK_TRANSFER_DIRECTORY,
  bankTransferDirectoryFlagEmoji,
  getBankTransferEnabledFiat,
  type BankTransferDirectoryRow,
  type BankTransferEnabledFiat,
} from "@/lib/bank-transfer-directory";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { MIN_OFFRAMP_USDC } from "@/lib/paycrest/client";
import type { InstitutionOption } from "@/lib/paycrest/normalize-institutions";
import { fetchWalletBalance } from "@/lib/wallet-fetch";
import { walletKeys } from "@/lib/wallet-query-keys";

type Flow = "choose" | "usdc" | "usdc-done" | "bank-currency" | "bank" | "bank-done";

/** Flag asset under `public/` when present; otherwise the directory row uses a regional emoji. */
const OFFRAMP_FIAT_FLAG_SRC: Partial<Record<BankTransferEnabledFiat, string>> = {
  NGN: "/flags/ng.svg",
};

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
  const [bankInstitution, setBankInstitution] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAmountText, setBankAmountText] = useState("");
  const [bankInstitutionOptions, setBankInstitutionOptions] = useState<InstitutionOption[]>([]);
  const [bankInstitutionsLoading, setBankInstitutionsLoading] = useState(false);
  const [bankInstitutionsError, setBankInstitutionsError] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState("");
  const [bankRate, setBankRate] = useState<string | null>(null);
  const [bankReceiveEstimate, setBankReceiveEstimate] = useState<string | null>(null);
  const [bankRateLoading, setBankRateLoading] = useState(false);
  const [bankRateError, setBankRateError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankDoneOrderId, setBankDoneOrderId] = useState<string | null>(null);
  const [bankDoneExplorerUrl, setBankDoneExplorerUrl] = useState<string | null>(null);
  const [bankOfframpFiat, setBankOfframpFiat] = useState<BankTransferEnabledFiat | null>(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const bankPickerRef = useRef<HTMLDivElement>(null);
  const [fiatDirectoryFilter, setFiatDirectoryFilter] = useState("");
  const [fiatDirectoryExpanded, setFiatDirectoryExpanded] = useState(false);

  useEffect(() => {
    if (!open) {
      setFlow("choose");
      setToAddress("");
      setAmountText("");
      setSubmitting(false);
      setError(null);
      setDoneExplorerUrl(null);
      setBankInstitution("");
      setBankAccountId("");
      setBankAccountName("");
      setBankAmountText("");
      setBankInstitutionOptions([]);
      setBankInstitutionsLoading(false);
      setBankInstitutionsError(null);
      setBankFilter("");
      setBankRate(null);
      setBankReceiveEstimate(null);
      setBankRateLoading(false);
      setBankRateError(null);
      setVerifyLoading(false);
      setBankSubmitting(false);
      setBankError(null);
      setBankDoneOrderId(null);
      setBankDoneExplorerUrl(null);
      setBankOfframpFiat(null);
      setBankPickerOpen(false);
      setFiatDirectoryFilter("");
      setFiatDirectoryExpanded(false);
    }
  }, [open]);

  const balanceEnabled = open && (flow === "usdc" || flow === "bank");
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
    } else if (flow === "bank-currency") {
      setBankOfframpFiat(null);
      setFiatDirectoryFilter("");
      setFiatDirectoryExpanded(false);
      setFlow("choose");
    } else if (flow === "bank") {
      setBankError(null);
      setBankPickerOpen(false);
      setBankOfframpFiat(null);
      setFlow("bank-currency");
    } else if (flow === "bank-done") {
      setBankDoneOrderId(null);
      setBankDoneExplorerUrl(null);
      setFlow("bank");
    }
  }, [flow]);

  useEffect(() => {
    if (!open || flow !== "bank" || !bankOfframpFiat) return;
    let cancelled = false;
    setBankInstitutionsLoading(true);
    setBankInstitutionsError(null);
    setBankInstitutionOptions([]);
    void (async () => {
      try {
        const res = await fetch(
          `/api/paycrest/institutions?currency=${encodeURIComponent(bankOfframpFiat)}`,
          { credentials: "include" },
        );
        const data: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 503) {
          setBankInstitutionOptions([]);
          setBankInstitutionsError("Bank cash-out isn’t available right now.");
          return;
        }
        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Could not load banks.";
          setBankInstitutionsError(msg);
          return;
        }
        const items =
          typeof data === "object" &&
          data !== null &&
          "items" in data &&
          Array.isArray((data as { items: unknown }).items)
            ? (data as { items: InstitutionOption[] }).items
            : [];
        setBankInstitutionOptions(
          items.filter(
            (i) =>
              i &&
              typeof i.value === "string" &&
              i.value.trim().length > 0 &&
              typeof i.label === "string",
          ),
        );
      } catch {
        if (!cancelled) setBankInstitutionsError("Could not load banks.");
      } finally {
        if (!cancelled) setBankInstitutionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, flow, bankOfframpFiat]);

  const bankAmountNum = Number.parseFloat(bankAmountText.replace(/,/g, ""));
  const bankAmountOk =
    Number.isFinite(bankAmountNum) && bankAmountNum >= MIN_OFFRAMP_USDC;

  useEffect(() => {
    if (!open || flow !== "bank" || !bankOfframpFiat || !bankAmountOk) {
      if (flow !== "bank") return;
      setBankRate(null);
      setBankReceiveEstimate(null);
      setBankRateError(null);
      setBankRateLoading(false);
      return;
    }
    const amountStr = bankAmountNum.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setBankRateLoading(true);
      setBankRateError(null);
      setBankRate(null);
      setBankReceiveEstimate(null);
      try {
        const res = await fetch(
          `/api/paycrest/offramp/rate?amount=${encodeURIComponent(amountStr)}&currency=${encodeURIComponent(bankOfframpFiat)}`,
          { credentials: "include" },
        );
        const data: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Could not load quote.";
          setBankRateError(msg);
          return;
        }
        const rate =
          typeof data === "object" &&
          data !== null &&
          "rate" in data &&
          typeof (data as { rate: unknown }).rate === "string"
            ? (data as { rate: string }).rate
            : null;
        const receive =
          typeof data === "object" &&
          data !== null &&
          "receiveAmount" in data &&
          typeof (data as { receiveAmount: unknown }).receiveAmount === "string"
            ? (data as { receiveAmount: string }).receiveAmount
            : typeof data === "object" &&
                data !== null &&
                "ngnReceive" in data &&
                typeof (data as { ngnReceive: unknown }).ngnReceive === "string"
              ? (data as { ngnReceive: string }).ngnReceive
              : null;
        if (rate?.trim()) {
          setBankRate(rate.trim());
          setBankReceiveEstimate(receive?.trim() ?? null);
        } else {
          setBankRateError("No quote for this amount.");
        }
      } catch {
        if (!cancelled) setBankRateError("Could not load quote.");
      } finally {
        if (!cancelled) setBankRateLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, flow, bankOfframpFiat, bankAmountOk, bankAmountNum, bankAmountText]);

  const filteredBanks = useMemo(() => {
    const q = bankFilter.trim().toLowerCase();
    if (!q) return bankInstitutionOptions;
    return bankInstitutionOptions.filter(
      (b) =>
        b.label.toLowerCase().includes(q) || b.value.toLowerCase().includes(q),
    );
  }, [bankInstitutionOptions, bankFilter]);

  const selectedBankLabel = useMemo(() => {
    if (!bankInstitution.trim()) return null;
    const hit = bankInstitutionOptions.find((o) => o.value === bankInstitution);
    return hit?.label?.trim() || bankInstitution;
  }, [bankInstitution, bankInstitutionOptions]);

  const fiatDirectorySearchActive = fiatDirectoryFilter.trim().length > 0;

  const fiatDirectoryRows = useMemo(() => {
    const q = fiatDirectoryFilter.trim().toLowerCase();
    const copy = [...BANK_TRANSFER_DIRECTORY];
    copy.sort((a, b) => {
      const ea = getBankTransferEnabledFiat(a) ? 0 : 1;
      const eb = getBankTransferEnabledFiat(b) ? 0 : 1;
      if (ea !== eb) return ea - eb;
      return a.country.localeCompare(b.country);
    });
    const filtered = q
      ? copy.filter(
          (r) =>
            r.country.toLowerCase().includes(q) ||
            r.currency.toLowerCase().includes(q) ||
            r.currencyName.toLowerCase().includes(q),
        )
      : copy;
    if (fiatDirectoryExpanded || q.length > 0) return filtered;
    return filtered.filter((r) => getBankTransferEnabledFiat(r) !== null);
  }, [fiatDirectoryFilter, fiatDirectoryExpanded]);

  const bankFiatRow = useMemo((): BankTransferDirectoryRow | null => {
    if (!bankOfframpFiat) return null;
    for (const r of BANK_TRANSFER_DIRECTORY) {
      if (getBankTransferEnabledFiat(r) === bankOfframpFiat) return r;
    }
    return null;
  }, [bankOfframpFiat]);

  const bankAccountIdMinLen = bankOfframpFiat === "NGN" ? 10 : 8;
  const bankAccountIdMaxLen = bankOfframpFiat === "NGN" ? 10 : 18;

  useEffect(() => {
    if (flow !== "bank") setBankPickerOpen(false);
  }, [flow]);

  useEffect(() => {
    if (!open || flow !== "bank") return;
    if (!bankOfframpFiat) setFlow("bank-currency");
  }, [open, flow, bankOfframpFiat]);

  useEffect(() => {
    if (!bankPickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = bankPickerRef.current;
      if (el && !el.contains(e.target as Node)) setBankPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [bankPickerOpen]);

  useEffect(() => {
    if (!bankPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBankPickerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bankPickerOpen]);

  async function handleVerifyBankAccount() {
    if (!bankInstitution.trim() || !bankAccountId.trim()) return;
    setVerifyLoading(true);
    setBankError(null);
    try {
      const res = await fetch("/api/paycrest/verify-account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: bankInstitution.trim(),
          accountIdentifier: bankAccountId.trim(),
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
            : "Verification failed.";
        throw new Error(msg);
      }
      const name =
        typeof data === "object" &&
        data !== null &&
        "accountName" in data &&
        typeof (data as { accountName: unknown }).accountName === "string"
          ? (data as { accountName: string }).accountName
          : "";
      if (!name.trim()) throw new Error("Could not resolve account name.");
      setBankAccountName(name.trim());
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifyLoading(false);
    }
  }

  const canSubmitBank =
    bankInstitution.trim().length > 0 &&
    bankAccountId.trim().length >= bankAccountIdMinLen &&
    bankAccountName.trim().length > 0 &&
    bankAmountOk &&
    Boolean(bankRate?.trim()) &&
    !bankRateLoading &&
    !bankSubmitting &&
    !bankInstitutionsLoading &&
    balanceBaseUnits !== null &&
    balanceBaseUnits !== "0";

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
    flow === "choose"
      ? "Cash Out To"
      : flow === "usdc"
        ? "Send USDC"
        : flow === "usdc-done"
          ? "Sent"
          : flow === "bank-currency"
            ? "Bank transfer"
            : flow === "bank"
              ? "Bank details"
              : "Submitted";

  const showBack = flow !== "choose";

  async function handleBankOfframp() {
    if (!canSubmitBank || !bankRate?.trim()) return;
    setBankSubmitting(true);
    setBankError(null);
    const amountStr = bankAmountNum.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
    try {
      const res = await fetch("/api/paycrest/offramp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountStr,
          rate: bankRate.trim(),
          recipient: {
            institution: bankInstitution.trim(),
            accountIdentifier: bankAccountId.trim(),
            accountName: bankAccountName.trim(),
          },
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
            : "Cash-out failed.";
        throw new Error(msg);
      }
      const orderId =
        typeof data === "object" &&
        data !== null &&
        "orderId" in data &&
        typeof (data as { orderId: unknown }).orderId === "string"
          ? (data as { orderId: string }).orderId
          : null;
      const explorer =
        typeof data === "object" &&
        data !== null &&
        "explorerUrl" in data &&
        typeof (data as { explorerUrl: unknown }).explorerUrl === "string"
          ? (data as { explorerUrl: string }).explorerUrl
          : null;
      setBankDoneOrderId(orderId);
      setBankDoneExplorerUrl(explorer);
      setFlow("bank-done");
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBankSubmitting(false);
    }
  }

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

            <button
              type="button"
              onClick={() => setFlow("bank-currency")}
              className="relative w-full rounded-2xl border border-border bg-white p-4 text-left shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04] transition-colors active:bg-neutral-50/90"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold tracking-tight text-foreground">Bank transfer</p>
                  <p className="mt-0.5 text-sm text-muted">
                    USDC to your bank · pick country &amp; currency
                  </p>
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
                <p className="text-xs font-medium text-muted">Local bank payout</p>
              </div>
            </button>
          </div>
        ) : null}

        {flow === "bank-currency" ? (
          <>
            <p className="text-sm text-muted">
              Pick the currency you want credited to your bank. You&apos;re selling{" "}
              <strong className="text-foreground">USDC</strong> from your Kudi wallet for that payout (same
              flow as Add Money — bank transfer — in reverse).
            </p>
            <div className="rounded-2xl border border-border/90 bg-gradient-to-b from-neutral-50 to-white p-2.5 shadow-sm ring-1 ring-black/[0.04]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="Search country or currency…"
                  value={fiatDirectoryFilter}
                  onChange={(e) => setFiatDirectoryFilter(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-white py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-primary/15 focus:ring-2"
                  aria-label="Search countries and currencies"
                />
              </div>
            </div>
            <div className="max-h-[min(52vh,28rem)] touch-pan-y overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {fiatDirectoryRows.length === 0 ? (
                  <p className="col-span-full py-8 text-center text-sm text-muted">
                    No countries match that search.
                  </p>
                ) : (
                  fiatDirectoryRows.map((row) => {
                    const enabledFiat = getBankTransferEnabledFiat(row);
                    const flagSrc = enabledFiat ? OFFRAMP_FIAT_FLAG_SRC[enabledFiat] : undefined;
                    const inner = (
                      <>
                        {flagSrc ? (
                          <Image
                            src={flagSrc}
                            alt={`${row.country} flag`}
                            width={40}
                            height={28}
                            className="h-7 w-10 rounded object-cover shadow-sm ring-1 ring-black/10"
                          />
                        ) : (
                          <span
                            className="flex h-7 w-10 items-center justify-center rounded bg-neutral-100 text-lg leading-none shadow-sm ring-1 ring-black/10"
                            aria-hidden
                          >
                            {bankTransferDirectoryFlagEmoji(row.iso2)}
                          </span>
                        )}
                        <span
                          className={`text-sm font-bold ${enabledFiat ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {row.currency}
                        </span>
                        <span className="line-clamp-2 text-[10px] font-medium leading-tight text-muted">
                          {row.country}
                        </span>
                        {!enabledFiat ? (
                          <span className="mt-0.5 rounded-full bg-neutral-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-700">
                            Coming soon
                          </span>
                        ) : null}
                      </>
                    );
                    if (enabledFiat) {
                      return (
                        <button
                          key={row.iso2}
                          type="button"
                          onClick={() => {
                            setBankOfframpFiat(enabledFiat);
                            setFlow("bank");
                          }}
                          className="min-w-0 rounded-2xl border border-transparent text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="flex min-h-[6.25rem] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-white px-2 py-3 text-center shadow-sm ring-1 ring-black/[0.04] active:bg-primary-muted/35">
                            {inner}
                          </div>
                        </button>
                      );
                    }
                    return (
                      <div
                        key={row.iso2}
                        className="min-w-0 rounded-2xl border border-transparent outline-none"
                        aria-disabled="true"
                      >
                        <div className="flex min-h-[6.25rem] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-neutral-50/90 px-2 py-2.5 text-center opacity-[0.52] shadow-sm ring-1 ring-black/[0.04] grayscale">
                          {inner}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {!fiatDirectoryExpanded && !fiatDirectorySearchActive ? (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-px min-w-0 flex-1 bg-border" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setFiatDirectoryExpanded(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground active:text-foreground"
                  >
                    <span className="text-[11px] font-bold tracking-wide">Show more</span>
                    <ChevronDown className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                  <div className="h-px min-w-0 flex-1 bg-border" aria-hidden />
                </div>
              ) : null}
              {fiatDirectoryExpanded && !fiatDirectorySearchActive ? (
                <div className="mt-4 flex items-center gap-3 pb-1">
                  <div className="h-px min-w-0 flex-1 bg-border" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setFiatDirectoryExpanded(false)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground active:text-foreground"
                  >
                    <span className="text-[11px] font-bold tracking-wide">Show less</span>
                    <ChevronUp className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                  <div className="h-px min-w-0 flex-1 bg-border" aria-hidden />
                </div>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              You need a little ETH on {KUDI_CHAIN.name} for gas. Minimum sale {MIN_OFFRAMP_USDC} USDC.
            </p>
          </>
        ) : null}

        {flow === "bank" ? (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-neutral-50/80 px-3 py-2.5">
              {bankFiatRow && bankOfframpFiat ? (
                OFFRAMP_FIAT_FLAG_SRC[bankOfframpFiat] ? (
                  <Image
                    src={OFFRAMP_FIAT_FLAG_SRC[bankOfframpFiat]!}
                    alt={`${bankFiatRow.country} flag`}
                    width={44}
                    height={30}
                    className="h-[30px] w-11 shrink-0 rounded-md object-cover ring-1 ring-black/10"
                  />
                ) : (
                  <span
                    className="flex h-[30px] w-11 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-base leading-none ring-1 ring-black/10"
                    aria-hidden
                  >
                    {bankTransferDirectoryFlagEmoji(bankFiatRow.iso2)}
                  </span>
                )
              ) : null}
              <p className="text-sm text-foreground">
                {bankFiatRow && bankOfframpFiat ? (
                  <>
                    <span className="font-semibold">{bankFiatRow.country}</span>
                    <span className="text-muted">
                      {" "}
                      · {bankFiatRow.currencyName}{" "}
                      <span className="font-medium tabular-nums">({bankFiatRow.currency})</span>
                    </span>
                  </>
                ) : (
                  <span className="text-muted">Select currency to continue</span>
                )}
              </p>
            </div>
            <p className="text-sm text-muted">
              Select your bank and enter your account number. We&apos;ll verify the account name before you
              confirm the USDC amount. Minimum {MIN_OFFRAMP_USDC} USDC.
            </p>
            {bankInstitutionsError ? (
              <p className="text-sm font-medium text-red-600">{bankInstitutionsError}</p>
            ) : null}
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
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Landmark className="size-4" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-muted">Bank</span>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    Search banks supported for {bankFiatRow?.country ?? "your country"}.
                  </p>
                </div>
              </div>
              {bankInstitutionsLoading ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/80 bg-neutral-50/80 px-3 py-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Landmark className="size-5 text-muted" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="h-4 flex-1 animate-pulse rounded-md bg-neutral-200/80" aria-hidden />
                </div>
              ) : bankInstitutionOptions.length > 0 ? (
                <div ref={bankPickerRef} className="mt-3 flex flex-col gap-0">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={bankPickerOpen}
                    onClick={() => setBankPickerOpen((v) => !v)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/90 bg-white px-3 py-3 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.99]"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/18 to-primary/6 text-primary shadow-inner">
                      <Landmark className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-foreground">
                        {selectedBankLabel ?? "Select your bank"}
                      </span>
                      {!bankInstitution.trim() ? (
                        <span className="mt-0.5 block text-xs text-muted">Tap to search and choose</span>
                      ) : null}
                    </span>
                    <ChevronDown
                      className={`size-5 shrink-0 text-muted transition-transform duration-200 ${
                        bankPickerOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                  {bankPickerOpen ? (
                    <div
                      className="mt-2 overflow-hidden rounded-2xl border border-border/90 bg-white shadow-lg ring-1 ring-black/[0.06]"
                      role="presentation"
                    >
                      <div className="border-b border-border/70 bg-gradient-to-b from-neutral-50 to-white px-2.5 pb-2.5 pt-2.5">
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <input
                            type="search"
                            autoComplete="off"
                            placeholder="Search banks…"
                            value={bankFilter}
                            onChange={(e) => setBankFilter(e.target.value)}
                            className="w-full rounded-xl border border-border/80 bg-white py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-primary/15 focus:ring-2"
                            aria-label="Search banks"
                          />
                        </div>
                      </div>
                      <ul
                        role="listbox"
                        aria-label="Supported banks"
                        className="max-h-[min(14rem,42vh)] overflow-y-auto overscroll-contain py-1.5"
                      >
                        {filteredBanks.length === 0 ? (
                          <li className="px-4 py-6 text-center text-sm text-muted">
                            No banks match that search.
                          </li>
                        ) : (
                          filteredBanks.map((o) => {
                            const selected = bankInstitution === o.value;
                            return (
                              <li key={o.value} role="presentation">
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => {
                                    setBankInstitution(o.value);
                                    setBankAccountName("");
                                    setBankError(null);
                                    setBankPickerOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                                    selected
                                      ? "bg-primary/10 font-semibold text-foreground"
                                      : "text-foreground hover:bg-neutral-50 active:bg-neutral-100/80"
                                  }`}
                                >
                                  <span
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                                      selected
                                        ? "bg-primary/15 text-primary"
                                        : "bg-neutral-100 text-neutral-500"
                                    }`}
                                  >
                                    <Landmark className="size-4" strokeWidth={2} aria-hidden />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                  {selected ? (
                                    <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                                  ) : null}
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">No banks available for this currency.</p>
              )}
            </div>

            <div>
              <label htmlFor="bank-acct" className="text-xs font-semibold text-muted">
                Account number
              </label>
              <input
                id="bank-acct"
                inputMode="numeric"
                autoComplete="off"
                placeholder={
                  bankOfframpFiat === "NGN" ? "10-digit account number" : "Bank account number"
                }
                value={bankAccountId}
                onChange={(e) => {
                  setBankAccountId(
                    e.target.value.replace(/\D/g, "").slice(0, bankAccountIdMaxLen),
                  );
                  setBankAccountName("");
                  setBankError(null);
                }}
                className="mt-1.5 w-full rounded-2xl border border-border bg-white px-4 py-3.5 font-mono text-base text-foreground shadow-sm outline-none ring-primary/20 transition focus:ring-2"
              />
            </div>
            <button
              type="button"
                disabled={
                verifyLoading ||
                !bankInstitution.trim() ||
                bankAccountId.trim().length < bankAccountIdMinLen
              }
              onClick={() => void handleVerifyBankAccount()}
              className="min-h-11 w-full rounded-xl border-2 border-border bg-white text-sm font-semibold text-foreground active:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {verifyLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Verifying…
                </span>
              ) : (
                "Verify account name"
              )}
            </button>
            <div>
              <label htmlFor="bank-name" className="text-xs font-semibold text-muted">
                Account name
              </label>
              <input
                id="bank-name"
                readOnly
                placeholder="Verify to fill"
                value={bankAccountName}
                className="mt-1.5 w-full rounded-xl border border-border bg-neutral-50 px-3 py-3 text-sm text-foreground outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="bank-amt" className="text-xs font-semibold text-muted">
                  Amount (USDC)
                </label>
                <button
                  type="button"
                  disabled={loadingBalance || !balanceBaseUnits || balanceBaseUnits === "0"}
                  onClick={() => {
                    if (!balanceBaseUnits || balanceBaseUnits === "0") return;
                    setBankAmountText(usdcBaseUnitsToInput(balanceBaseUnits));
                    setBankError(null);
                  }}
                  className="text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40 active:opacity-80"
                >
                  Max
                </button>
              </div>
              <input
                id="bank-amt"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={bankAmountText}
                onChange={(e) => {
                  setBankAmountText(e.target.value.replace(/[^\d.]/g, ""));
                  setBankError(null);
                }}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-3 text-lg font-semibold tabular-nums text-foreground outline-none ring-primary/20 focus:ring-2"
              />
            </div>
            <div className="rounded-xl border border-border bg-neutral-50/80 px-3 py-2.5">
              <span className="text-xs font-semibold text-muted">Estimated receive</span>
              {bankRateLoading ? (
                <div className="mt-2 h-5 w-32 animate-pulse rounded bg-neutral-200" />
              ) : bankRateError ? (
                <p className="mt-1 text-sm text-red-600">{bankRateError}</p>
              ) : bankReceiveEstimate && bankOfframpFiat ? (
                <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
                  {bankReceiveEstimate}{" "}
                  <span className="text-xs font-medium text-muted">
                    {bankOfframpFiat} (estimate)
                  </span>
                </p>
              ) : bankAmountOk ? (
                <p className="mt-1 text-sm text-muted">Quote loading…</p>
              ) : (
                <p className="mt-1 text-sm text-muted">Enter amount (min {MIN_OFFRAMP_USDC} USDC)</p>
              )}
            </div>
            {bankError ? <p className="text-sm font-medium text-red-600">{bankError}</p> : null}
            <button
              type="button"
              disabled={!canSubmitBank}
              onClick={() => void handleBankOfframp()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-40 active:bg-primary-hover"
            >
              {bankSubmitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Processing…
                </>
              ) : (
                "Cash out to bank"
              )}
            </button>
          </>
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

        {flow === "bank-done" ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04]">
              <p className="text-sm leading-relaxed text-muted">
                Your USDC was sent to our payment partner. Your bank should credit you in the currency you
                chose once the order settles. You&apos;ll see updates as the transfer progresses.
              </p>
              {bankDoneOrderId ? (
                <p className="mt-2 font-mono text-xs font-medium text-foreground">Order {bankDoneOrderId}</p>
              ) : null}
            </div>
            {bankDoneExplorerUrl ? (
              <a
                href={bankDoneExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-primary shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04] active:bg-neutral-50/90"
              >
                View deposit transaction
                <ArrowUpRight className="size-4 shrink-0" aria-hidden />
              </a>
            ) : null}
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
