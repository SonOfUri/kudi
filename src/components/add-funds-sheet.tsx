"use client";

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Landmark,
  Loader2,
  QrCode,
  Search,
} from "lucide-react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";
import { DepositAddressSkeleton } from "@/components/deposit-address-skeleton";
import {
  BANK_TRANSFER_DIRECTORY,
  bankTransferDirectoryFlagEmoji,
  getBankTransferEnabledFiat,
} from "@/lib/bank-transfer-directory";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { estimatedUsdcNumber, MAX_ONRAMP_USDC, MIN_ONRAMP_USDC } from "@/lib/paycrest/client";

/** UI metadata + demo fallback when Paycrest env is not configured. */
const BANK_TRANSFER_FIATS = {
  NGN: {
    flag: "/flags/ng.svg",
    label: "Nigerian naira",
    country: "Nigeria",
    symbol: "₦",
    locale: "en-NG",
    fallback: {
      bankName: "Providus Bank",
      accountNumber: "8800123456789",
      accountName: "KUDI VIRTUAL COLLECTION",
    },
  },
  KES: {
    flag: "/flags/ke.svg",
    label: "Kenyan shilling",
    country: "Kenya",
    symbol: "KSh",
    locale: "en-KE",
    fallback: {
      bankName: "Co-operative Bank of Kenya",
      accountNumber: "0112345678901",
      accountName: "KUDI COLLECTIONS KES",
    },
  },
  UGX: {
    flag: "/flags/ug.svg",
    label: "Ugandan shilling",
    country: "Uganda",
    symbol: "USh",
    locale: "en-UG",
    fallback: {
      bankName: "Centenary Bank",
      accountNumber: "3204768890123",
      accountName: "KUDI COLLECTIONS UGX",
    },
  },
  TZS: {
    flag: "/flags/tz.svg",
    label: "Tanzanian shilling",
    country: "Tanzania",
    symbol: "TSh",
    locale: "en-TZ",
    fallback: {
      bankName: "CRDB Bank",
      accountNumber: "0151234567890",
      accountName: "KUDI COLLECTIONS TZS",
    },
  },
  MWK: {
    flag: "/flags/mw.svg",
    label: "Malawian kwacha",
    country: "Malawi",
    symbol: "MK",
    locale: "en-MW",
    fallback: {
      bankName: "National Bank of Malawi",
      accountNumber: "1001234567890",
      accountName: "KUDI COLLECTIONS MWK",
    },
  },
  BRL: {
    flag: "/flags/br.svg",
    label: "Brazilian real",
    country: "Brazil",
    symbol: "R$",
    locale: "pt-BR",
    fallback: {
      bankName: "Banco do Brasil",
      accountNumber: "12345-6 / 0001-9",
      accountName: "KUDI PAGAMENTOS LTDA",
    },
  },
} as const;

/** Sender/refund account for NGN Paycrest orders — fixed; not collected in UI. Label: Zenith Bank · ZEIBNGLA */
const NGN_PAYCREST_REFUND_ACCOUNT = {
  institution: "ZEIBNGLA",
  accountIdentifier: "2208707402",
  accountName: "Alo Timothy",
} as const;

type FiatCurrency = keyof typeof BANK_TRANSFER_FIATS;
type StableToken = "USDT" | "USDC";

type Flow =
  | "choose"
  | "fiat-currencies"
  | "fiat-amount"
  | "fiat-refund"
  | "fiat-account"
  | "crypto-tokens"
  | "crypto-address";

type LiveProvider = {
  institution: string;
  accountIdentifier: string;
  accountName: string;
  amountToTransfer?: string;
  currency?: string;
  validUntil?: string;
};

type InstitutionOption = { value: string; label: string };

const COMING_SOON_TOKENS = new Set<StableToken>(["USDT"]);

/** Shown on “Add Money From” bank option (place files under `public/banks/`). */
const ADD_FUNDS_BANK_ICONS = [
  "/banks/first-city-monument-bank.png",
  "/banks/guaranty-trust-bank.png",
  "/banks/polaris-bank.png",
  "/banks/stanbic-ibtc-bank.png",
] as const;

const ADD_FUNDS_STABLE_ICONS = ["/crypto/usdt.svg", "/crypto/usdc.svg"] as const;
const ADD_FUNDS_CARD_BRAND_ICONS = ["/cards/visa.png", "/cards/mastercard.svg"] as const;

function formatFiatAmount(code: FiatCurrency, amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const { locale } = BANK_TRANSFER_FIATS[code];
  try {
    return amount.toLocaleString(locale, { maximumFractionDigits: code === "BRL" ? 2 : 0 });
  } catch {
    return amount.toLocaleString("en-US", { maximumFractionDigits: code === "BRL" ? 2 : 0 });
  }
}

function sanitizeFiatAmountInput(raw: string, code: FiatCurrency): string {
  if (code === "BRL") {
    const digits = raw.replace(/[^\d.]/g, "");
    const i = digits.indexOf(".");
    if (i === -1) return digits;
    return `${digits.slice(0, i + 1)}${digits.slice(i + 1).replace(/\./g, "").slice(0, 2)}`;
  }
  return raw.replace(/[^\d]/g, "");
}

/** Amount string for Paycrest rate + create order. */
function formatAmountForPaycrest(num: number, fiat: FiatCurrency): string {
  if (fiat === "BRL") {
    return num.toFixed(2);
  }
  return String(Math.floor(num));
}

/** Paycrest may return sub-millisecond ISO timestamps; trim so `Date` parses reliably. */
function formatValidUntilDisplay(raw: string): string {
  const trimmed = raw.trim();
  const normalized = /\.\d{4,}/.test(trimmed)
    ? trimmed.replace(/(\.\d{3})\d+(?=[Zz]|[+-])/, "$1")
    : trimmed;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return trimmed;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return trimmed;
  }
}

function bankDisplay(fiat: FiatCurrency, live: LiveProvider | null, usedFallback: boolean) {
  const fb = BANK_TRANSFER_FIATS[fiat].fallback;
  if (live && !usedFallback) {
    return {
      bankName: live.institution || fb.bankName,
      accountNumber: live.accountIdentifier || fb.accountNumber,
      accountName: live.accountName || fb.accountName,
      amountToTransfer: live.amountToTransfer,
      transferCurrency: live.currency,
      validUntil: live.validUntil,
    };
  }
  return {
    bankName: fb.bankName,
    accountNumber: fb.accountNumber,
    accountName: fb.accountName,
    amountToTransfer: undefined as string | undefined,
    transferCurrency: undefined as string | undefined,
    validUntil: undefined as string | undefined,
  };
}

function CopyField({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [value]);

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1.5 flex items-start justify-between gap-2">
        <p
          className={`min-w-0 flex-1 font-medium text-foreground ${compact ? "font-mono text-[13px] leading-snug break-all" : "text-base"}`}
        >
          {value}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary-muted px-2.5 py-1.5 text-xs font-semibold text-primary active:bg-primary-subtle"
        >
          <Copy className="size-3.5" strokeWidth={2} aria-hidden />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function AddFundsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [flow, setFlow] = useState<Flow>("choose");
  const [fiat, setFiat] = useState<FiatCurrency | null>(null);
  const [token, setToken] = useState<StableToken | null>(null);
  const [fiatAmountRaw, setFiatAmountRaw] = useState("");
  const [refundInstitution, setRefundInstitution] = useState("");
  const [refundAccountId, setRefundAccountId] = useState("");
  const [refundAccountName, setRefundAccountName] = useState("");
  const [institutionOptions, setInstitutionOptions] = useState<InstitutionOption[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionsError, setInstitutionsError] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState("");
  const [institutionManual, setInstitutionManual] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const bankPickerRef = useRef<HTMLDivElement>(null);
  const [rateQuote, setRateQuote] = useState<string | null>(null);
  /** Estimated USDC for this quote (from API or derived from rate). */
  const [rateUsdcReceive, setRateUsdcReceive] = useState<string | null>(null);
  /** Fingerprint `${fiat}:${amount}` this quote belongs to; must match to continue. */
  const [rateKey, setRateKey] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [liveProvider, setLiveProvider] = useState<LiveProvider | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [paycrestOrderId, setPaycrestOrderId] = useState<string | null>(null);
  /** Paycrest accepted order but returned no providerAccount. */
  const [instructionsIncomplete, setInstructionsIncomplete] = useState(false);

  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositRetry, setDepositRetry] = useState(0);
  const [transferAckOpen, setTransferAckOpen] = useState(false);
  const [fiatDirectoryFilter, setFiatDirectoryFilter] = useState("");
  const [fiatDirectoryExpanded, setFiatDirectoryExpanded] = useState(false);

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

  useEffect(() => {
    if (!open) {
      setFlow("choose");
      setFiat(null);
      setToken(null);
      setFiatAmountRaw("");
      setRefundInstitution("");
      setRefundAccountId("");
      setRefundAccountName("");
      setInstitutionOptions([]);
      setInstitutionsLoading(false);
      setInstitutionsError(null);
      setBankFilter("");
      setInstitutionManual(false);
      setBankPickerOpen(false);
      setRateQuote(null);
      setRateUsdcReceive(null);
      setRateKey("");
      setRateLoading(false);
      setRateError(null);
      setSubmitLoading(false);
      setSubmitError(null);
      setLiveProvider(null);
      setUsedFallback(false);
      setPaycrestOrderId(null);
      setInstructionsIncomplete(false);
      setDepositAddress(null);
      setDepositLoading(false);
      setDepositError(null);
      setDepositRetry(0);
      setTransferAckOpen(false);
      setFiatDirectoryFilter("");
      setFiatDirectoryExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    if (flow !== "fiat-account") setTransferAckOpen(false);
  }, [flow]);

  useEffect(() => {
    if (!open || flow !== "crypto-address" || !token) {
      return;
    }

    let cancelled = false;

    async function loadAddress() {
      setDepositLoading(true);
      setDepositError(null);
      setDepositAddress(null);
      try {
        const res = await fetch("/api/wallet/deposit-address", { credentials: "include" });
        const data: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Could not load wallet address.";
          throw new Error(msg);
        }
        if (
          typeof data !== "object" ||
          data === null ||
          !("address" in data) ||
          typeof (data as { address: unknown }).address !== "string" ||
          (data as { address: string }).address.length === 0
        ) {
          throw new Error("Invalid response from server.");
        }
        setDepositAddress((data as { address: string }).address);
      } catch (e) {
        if (!cancelled) {
          setDepositError(e instanceof Error ? e.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setDepositLoading(false);
      }
    }

    loadAddress();
    return () => {
      cancelled = true;
    };
  }, [open, flow, token, depositRetry]);

  const fiatAmountNum = Number.parseFloat(fiatAmountRaw.replace(/,/g, ""));
  const fiatAmountOk =
    fiatAmountRaw.trim().length > 0 &&
    Number.isFinite(fiatAmountNum) &&
    fiatAmountNum > 0;

  const refundOk =
    fiat === "NGN" ||
    (refundInstitution.trim().length > 0 &&
      refundAccountId.trim().length > 0 &&
      refundAccountName.trim().length > 0);

  const currentRateKey = useMemo(() => {
    if (!fiatAmountOk || !fiat) return "";
    return `${fiat}:${formatAmountForPaycrest(fiatAmountNum, fiat)}`;
  }, [fiat, fiatAmountOk, fiatAmountNum, fiatAmountRaw]);

  const estimatedUsdcNum = useMemo(() => {
    if (!fiatAmountOk || !fiat || !rateQuote?.trim() || rateKey !== currentRateKey) return null;
    const fromRate = estimatedUsdcNumber(fiatAmountNum, rateQuote);
    if (fromRate !== null) return fromRate;
    if (rateUsdcReceive?.trim()) {
      const n = Number.parseFloat(rateUsdcReceive.replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }, [
    fiat,
    fiatAmountOk,
    fiatAmountNum,
    rateQuote,
    rateKey,
    currentRateKey,
    rateUsdcReceive,
  ]);

  const meetsMinOnramp =
    estimatedUsdcNum !== null && estimatedUsdcNum >= MIN_ONRAMP_USDC;
  const meetsMaxOnramp =
    estimatedUsdcNum !== null && estimatedUsdcNum <= MAX_ONRAMP_USDC;
  const onrampBoundsOk = meetsMinOnramp && meetsMaxOnramp;

  const rateReady =
    fiatAmountOk &&
    Boolean(rateQuote?.trim()) &&
    rateKey === currentRateKey &&
    !rateLoading &&
    onrampBoundsOk;

  useEffect(() => {
    if (!open || flow !== "fiat-amount" || !fiat || !fiatAmountOk) return;
    if (rateKey && rateKey !== currentRateKey) {
      setRateQuote(null);
      setRateUsdcReceive(null);
      setRateError(null);
      setRateKey("");
    }
  }, [open, flow, fiat, fiatAmountOk, currentRateKey, rateKey]);

  useEffect(() => {
    if (!open || flow !== "fiat-refund" || !fiat || fiat === "NGN") {
      return;
    }

    let cancelled = false;
    setInstitutionsLoading(true);
    setInstitutionsError(null);
    setInstitutionOptions([]);
    setRefundInstitution("");
    setBankFilter("");
    setInstitutionManual(false);
    setBankPickerOpen(false);

    void (async () => {
      try {
        const res = await fetch(
          `/api/paycrest/institutions?currency=${encodeURIComponent(fiat)}`,
          { credentials: "include" },
        );
        const data: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 503) {
          setInstitutionOptions([]);
          setInstitutionsError(null);
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
          setInstitutionsError(msg);
          setInstitutionOptions([]);
          return;
        }
        const items =
          typeof data === "object" &&
          data !== null &&
          "items" in data &&
          Array.isArray((data as { items: unknown }).items)
            ? (data as { items: InstitutionOption[] }).items
            : [];
        const cleaned = items.filter(
          (i) =>
            i &&
            typeof i.value === "string" &&
            i.value.trim().length > 0 &&
            typeof i.label === "string",
        );
        setInstitutionOptions(cleaned);
      } catch {
        if (!cancelled) {
          setInstitutionsError("Could not load banks.");
          setInstitutionOptions([]);
        }
      } finally {
        if (!cancelled) setInstitutionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, flow, fiat]);

  useEffect(() => {
    if (!open || flow !== "fiat-amount" || !fiat) {
      return;
    }
    if (!fiatAmountOk) {
      setRateQuote(null);
      setRateUsdcReceive(null);
      setRateKey("");
      setRateError(null);
      setRateLoading(false);
      return;
    }

    const amountStr = formatAmountForPaycrest(fiatAmountNum, fiat);
    const fingerprint = `${fiat}:${amountStr}`;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setRateLoading(true);
      setRateError(null);
      setRateQuote(null);
      setRateUsdcReceive(null);
      setRateKey("");
      try {
        const res = await fetch(
          `/api/paycrest/rate?amount=${encodeURIComponent(amountStr)}&currency=${encodeURIComponent(fiat)}`,
          { credentials: "include" },
        );
        const data: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 503) {
          setRateQuote(null);
          setRateUsdcReceive(null);
          setRateKey("");
          setRateError(null);
          return;
        }
        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Could not load rate.";
          setRateError(msg);
          setRateQuote(null);
          setRateUsdcReceive(null);
          setRateKey("");
          return;
        }
        const rate =
          typeof data === "object" &&
          data !== null &&
          "rate" in data &&
          typeof (data as { rate: unknown }).rate === "string"
            ? (data as { rate: string }).rate
            : null;
        const usdcField =
          typeof data === "object" && data !== null && "usdcReceive" in data
            ? (data as { usdcReceive: unknown }).usdcReceive
            : null;
        const usdcRaw =
          typeof usdcField === "string" && usdcField.trim().length > 0
            ? usdcField.trim()
            : typeof usdcField === "number" && Number.isFinite(usdcField) && usdcField > 0
              ? String(usdcField)
              : null;
        if (rate?.trim()) {
          setRateQuote(rate);
          setRateKey(fingerprint);
          setRateUsdcReceive(usdcRaw && usdcRaw.length > 0 ? usdcRaw : null);
        } else {
          setRateQuote(null);
          setRateUsdcReceive(null);
          setRateKey("");
          setRateError("No rate returned for this amount.");
        }
      } catch {
        if (!cancelled) {
          setRateError("Could not load rate.");
          setRateQuote(null);
          setRateUsdcReceive(null);
          setRateKey("");
        }
      } finally {
        if (!cancelled) setRateLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, flow, fiat, fiatAmountOk, fiatAmountNum, fiatAmountRaw]);

  /** Drop rate when not on amount/refund so we never show the wrong currency after going back. */
  useEffect(() => {
    if (!open) return;
    if (flow === "fiat-amount" && fiat) return;
    if (flow === "fiat-refund" && fiat) return;
    setRateQuote(null);
    setRateUsdcReceive(null);
    setRateKey("");
    setRateError(null);
    setRateLoading(false);
  }, [open, flow, fiat]);

  const goBack = useCallback(() => {
    if (flow === "fiat-currencies") {
      setFiatDirectoryFilter("");
      setFiatDirectoryExpanded(false);
      setFlow("choose");
    } else if (flow === "fiat-amount") {
      setFiat(null);
      setFiatAmountRaw("");
      setFiatDirectoryFilter("");
      setFiatDirectoryExpanded(false);
      setFlow("fiat-currencies");
    } else if (flow === "fiat-refund") {
      setRefundInstitution("");
      setRefundAccountId("");
      setRefundAccountName("");
      setInstitutionOptions([]);
      setInstitutionsLoading(false);
      setInstitutionsError(null);
      setBankFilter("");
      setInstitutionManual(false);
      setBankPickerOpen(false);
      setSubmitError(null);
      setFlow("fiat-amount");
    } else if (flow === "fiat-account") {
      setLiveProvider(null);
      setUsedFallback(false);
      setPaycrestOrderId(null);
      setInstructionsIncomplete(false);
      setFlow("choose");
      setFiat(null);
      setFiatAmountRaw("");
      setRefundInstitution("");
      setRefundAccountId("");
      setRefundAccountName("");
      setInstitutionOptions([]);
      setInstitutionsLoading(false);
      setBankFilter("");
      setInstitutionManual(false);
      setInstitutionsError(null);
      setBankPickerOpen(false);
    } else if (flow === "crypto-tokens") setFlow("choose");
    else if (flow === "crypto-address") {
      setToken(null);
      setFlow("crypto-tokens");
    }
  }, [flow]);

  async function submitPaycrestOrder() {
    if (!fiat || !fiatAmountOk || !refundOk) return;
    const submitKey = `${fiat}:${formatAmountForPaycrest(fiatAmountNum, fiat)}`;
    if (!rateQuote?.trim() || rateKey !== submitKey) return;
    const usdcEst = estimatedUsdcNumber(fiatAmountNum, rateQuote);
    if (usdcEst === null || usdcEst < MIN_ONRAMP_USDC || usdcEst > MAX_ONRAMP_USDC) return;
    setSubmitLoading(true);
    setSubmitError(null);
    const amountStr = formatAmountForPaycrest(fiatAmountNum, fiat);
    try {
      const res = await fetch("/api/paycrest/onramp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountStr,
          currency: fiat,
          ...(rateQuote ? { rate: rateQuote } : {}),
          refundAccount:
            fiat === "NGN"
              ? {
                  institution: NGN_PAYCREST_REFUND_ACCOUNT.institution,
                  accountIdentifier: NGN_PAYCREST_REFUND_ACCOUNT.accountIdentifier,
                  accountName: NGN_PAYCREST_REFUND_ACCOUNT.accountName,
                }
              : {
                  institution: refundInstitution.trim(),
                  accountIdentifier: refundAccountId.trim(),
                  accountName: refundAccountName.trim(),
                },
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setUsedFallback(true);
        setLiveProvider(null);
        setPaycrestOrderId(null);
        setInstructionsIncomplete(false);
        setFlow("fiat-account");
        return;
      }

      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Could not create transfer instructions.";
        throw new Error(msg);
      }

      const provider =
        typeof data === "object" &&
        data !== null &&
        "providerAccount" in data &&
        (data as { providerAccount: unknown }).providerAccount &&
        typeof (data as { providerAccount: unknown }).providerAccount === "object"
          ? ((data as { providerAccount: Record<string, unknown> }).providerAccount as Record<
              string,
              unknown
            >)
          : null;

      const oid =
        typeof data === "object" &&
        data !== null &&
        "orderId" in data &&
        typeof (data as { orderId: unknown }).orderId === "string"
          ? (data as { orderId: string }).orderId
          : null;

      if (provider) {
        const institution = typeof provider.institution === "string" ? provider.institution : "";
        const accountIdentifier =
          typeof provider.accountIdentifier === "string" ? provider.accountIdentifier : "";
        const accountName = typeof provider.accountName === "string" ? provider.accountName : "";
        setLiveProvider({
          institution,
          accountIdentifier,
          accountName,
          amountToTransfer:
            typeof provider.amountToTransfer === "string" ? provider.amountToTransfer : undefined,
          currency: typeof provider.currency === "string" ? provider.currency : undefined,
          validUntil: typeof provider.validUntil === "string" ? provider.validUntil : undefined,
        });
        setInstructionsIncomplete(false);
      } else {
        setLiveProvider(null);
        setInstructionsIncomplete(!!oid);
      }
      setUsedFallback(false);
      setPaycrestOrderId(oid);
      setFlow("fiat-account");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const sheetTitle =
    flow === "choose"
      ? "Add Money From"
      : flow === "fiat-currencies"
        ? "Bank transfer"
        : flow === "fiat-amount"
          ? "How much?"
          : flow === "fiat-refund"
            ? "Your bank (refunds)"
            : flow === "fiat-account" && fiat
              ? `Pay · ${BANK_TRANSFER_FIATS[fiat].country}`
              : flow === "fiat-account"
                ? "Bank details"
                : flow === "crypto-tokens"
                  ? "Direct transfer"
                  : `${token ?? "USDC"} address`;

  const showBack =
    flow === "fiat-currencies" ||
    flow === "fiat-amount" ||
    flow === "fiat-refund" ||
    flow === "fiat-account" ||
    flow === "crypto-tokens" ||
    flow === "crypto-address";

  const display =
    fiat != null && !(instructionsIncomplete && !usedFallback)
      ? bankDisplay(fiat, liveProvider, usedFallback)
      : null;

  const filteredInstitutions = useMemo(() => {
    const q = bankFilter.trim().toLowerCase();
    let list = !q
      ? institutionOptions
      : institutionOptions.filter(
          (o) =>
            o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        );
    if (
      refundInstitution &&
      !list.some((o) => o.value === refundInstitution)
    ) {
      const pinned = institutionOptions.find((o) => o.value === refundInstitution);
      if (pinned) {
        list = [pinned, ...list.filter((o) => o.value !== refundInstitution)];
      }
    }
    return list;
  }, [institutionOptions, bankFilter, refundInstitution]);

  const selectedInstitutionLabel = useMemo(() => {
    if (!refundInstitution.trim()) return null;
    const hit = institutionOptions.find((o) => o.value === refundInstitution);
    return hit?.label?.trim() || refundInstitution;
  }, [refundInstitution, institutionOptions]);

  useEffect(() => {
    if (open && flow === "fiat-refund") return;
    setBankPickerOpen(false);
  }, [open, flow]);

  /** NGN skips refund UI; bounce back if state ever lands here. */
  useEffect(() => {
    if (!open || flow !== "fiat-refund" || fiat !== "NGN") return;
    setFlow("fiat-amount");
  }, [open, flow, fiat]);

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

  return (
    <>
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={sheetTitle}
      showClose
      stackClassName="z-[55]"
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
            <button
              type="button"
              onClick={() => setFlow("fiat-currencies")}
              className="relative w-full rounded-2xl border border-border bg-white p-4 text-left shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04] transition-colors active:bg-neutral-50/90"
            >
              <div className="flex items-start justify-between gap-3 pr-1">
                <div className="min-w-0">
                  <p className="text-base font-bold tracking-tight text-foreground">Bank Account</p>
                  <p className="mt-0.5 text-sm text-muted">$10,000 limit</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  Suggested
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center pl-0.5">
                  {ADD_FUNDS_BANK_ICONS.map((src, i) => (
                    <div
                      key={src}
                      className={`relative size-9 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                      style={{ zIndex: ADD_FUNDS_BANK_ICONS.length - i }}
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
            </button>

            <button
              type="button"
              onClick={() => setFlow("crypto-tokens")}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 text-left shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04] transition-colors active:bg-neutral-50/90"
            >
              <div className="min-w-0">
                <p className="text-base font-bold tracking-tight text-foreground">Stablecoin Wallet</p>
                <p className="mt-0.5 text-sm text-muted">Unlimited</p>
              </div>
              <div className="flex shrink-0 items-center pl-0.5">
                {ADD_FUNDS_STABLE_ICONS.map((src, i) => (
                  <div
                    key={src}
                    className={`relative size-9 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                    style={{ zIndex: ADD_FUNDS_STABLE_ICONS.length - i }}
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
            </button>

            <div
              className="relative w-full rounded-2xl border border-border bg-white p-4 opacity-[0.72] shadow-[0_1px_14px_rgba(13,24,21,0.05)] ring-1 ring-black/[0.04]"
              aria-disabled="true"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold tracking-tight text-foreground">Debit Card</p>
                    <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-700">
                      Coming soon
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">$1,000 limit</p>
                </div>
                <div className="flex shrink-0 items-center pl-0.5">
                  {ADD_FUNDS_CARD_BRAND_ICONS.map((src, i) => (
                    <div
                      key={src}
                      className={`relative size-9 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                      style={{ zIndex: ADD_FUNDS_CARD_BRAND_ICONS.length - i }}
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
              </div>
            </div>
          </div>
        ) : null}

        {flow === "fiat-currencies" ? (
          <>
            <p className="text-sm text-muted">
              Pick the currency you&apos;re transferring from. You&apos;ll receive{" "}
              <strong className="text-foreground">USDC</strong> on Base after we confirm payment.
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
                    const meta = enabledFiat ? BANK_TRANSFER_FIATS[enabledFiat] : null;
                    const inner = (
                      <>
                        {meta ? (
                          <Image
                            src={meta.flag}
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
                            setFiat(enabledFiat);
                            setFlow("fiat-amount");
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
                    <span className="text-[11px] font-bold tracking-wide">Show More</span>
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
                    <span className="text-[11px] font-bold tracking-wide">Show Less</span>
                    <ChevronUp className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                  <div className="h-px min-w-0 flex-1 bg-border" aria-hidden />
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {flow === "fiat-amount" && fiat ? (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-neutral-50/80 px-3 py-2.5">
              <Image
                src={BANK_TRANSFER_FIATS[fiat].flag}
                alt={`${BANK_TRANSFER_FIATS[fiat].country} flag`}
                width={44}
                height={30}
                className="h-[30px] w-11 shrink-0 rounded-md object-cover ring-1 ring-black/10"
              />
              <p className="text-sm text-foreground">
                <span className="font-semibold">{BANK_TRANSFER_FIATS[fiat].country}</span>
                <span className="text-muted"> · {BANK_TRANSFER_FIATS[fiat].label}</span>
              </p>
            </div>
            <p className="text-sm text-muted">
              Enter how much you&apos;ll send from your bank. We&apos;ll match it to your wallet and
              credit <strong className="text-foreground">USDC</strong> on Base.
            </p>
            <div>
              <label htmlFor="fiat-send-amount" className="text-xs font-semibold text-muted">
                You send ({fiat})
              </label>
              <p className="mt-0.5 text-[11px] text-muted">
                ${MIN_ONRAMP_USDC}–${MAX_ONRAMP_USDC} USDC equivalent per transfer.
              </p>
              <div className="relative mt-1.5">
                <span
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-muted ${
                    BANK_TRANSFER_FIATS[fiat].symbol.length > 1 ? "left-3 max-w-[3.25rem] truncate" : "left-3 text-base"
                  }`}
                >
                  {BANK_TRANSFER_FIATS[fiat].symbol}
                </span>
                <input
                  id="fiat-send-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={fiatAmountRaw}
                  onChange={(e) => {
                    setSubmitError(null);
                    setFiatAmountRaw(sanitizeFiatAmountInput(e.target.value, fiat));
                  }}
                  className={`w-full rounded-xl border border-border bg-white py-3 pr-3 text-lg font-semibold tabular-nums text-foreground outline-none ring-primary/20 focus:ring-2 ${
                    BANK_TRANSFER_FIATS[fiat].symbol.length > 1 ? "pl-[4.25rem]" : "pl-9"
                  }`}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-to-b from-neutral-50/90 to-white px-4 py-3.5 shadow-sm ring-1 ring-black/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Quote · USDC on Base</p>
              {!fiatAmountOk ? (
                <p className="mt-2 text-sm text-muted">Enter an amount to load a live quote.</p>
              ) : rateLoading ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Fetching rate…
                </p>
              ) : rateError ? (
                <p className="mt-2 text-sm text-amber-800">{rateError}</p>
              ) : rateQuote ? (
                <div className="mt-2 space-y-3">
                  {rateUsdcReceive ? (
                    <div className="flex items-center gap-3">
                      <Image
                        src="/crypto/usdc.svg"
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 shrink-0 rounded-full ring-1 ring-black/10"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted">You receive (estimate)</p>
                        <p className="text-2xl font-bold tabular-nums leading-tight text-foreground">
                          ≈{rateUsdcReceive}{" "}
                          <span className="text-base font-semibold text-muted">USDC</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      USDC estimate unavailable for this quote — we need it to enforce the{" "}
                      ${MIN_ONRAMP_USDC}–${MAX_ONRAMP_USDC} USDC band. Try changing the amount.
                    </p>
                  )}
                  <div className="border-t border-border/70 pt-2.5">
                    <p className="text-[11px] font-semibold text-muted">Paycrest reference rate</p>
                    <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{rateQuote}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Rate unavailable — fix Paycrest configuration or adjust the amount, then wait for a
                  quote.
                </p>
              )}
            </div>
            {rateQuote && rateKey === currentRateKey && !rateLoading && fiatAmountOk ? (
              estimatedUsdcNum !== null && estimatedUsdcNum < MIN_ONRAMP_USDC ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  Minimum deposit is about <strong>${MIN_ONRAMP_USDC} USDC</strong>. At this quote
                  you&apos;d receive ≈{" "}
                  <strong className="tabular-nums">
                    {estimatedUsdcNum.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    USDC
                  </strong>
                  — increase the amount to continue.
                </div>
              ) : estimatedUsdcNum !== null && estimatedUsdcNum > MAX_ONRAMP_USDC ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  Maximum deposit is about <strong>${MAX_ONRAMP_USDC} USDC</strong>. At this quote
                  you&apos;d receive ≈{" "}
                  <strong className="tabular-nums">
                    {estimatedUsdcNum.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    USDC
                  </strong>
                  — reduce the amount to continue.
                </div>
              ) : estimatedUsdcNum === null ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  We couldn&apos;t verify the ${MIN_ONRAMP_USDC}–${MAX_ONRAMP_USDC} USDC limits for
                  this quote. Try changing the amount slightly.
                </div>
              ) : null
            ) : null}
            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {submitError}
              </div>
            ) : null}
            <button
              type="button"
              disabled={!fiatAmountOk || !rateReady || submitLoading}
              onClick={() => {
                if (fiat === "NGN") void submitPaycrestOrder();
                else setFlow("fiat-refund");
              }}
              className="min-h-12 w-full rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-40 active:bg-primary-hover"
            >
              {submitLoading && fiat === "NGN" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Getting instructions…
                </span>
              ) : fiat === "NGN" ? (
                "Get transfer instructions"
              ) : (
                "Continue"
              )}
            </button>
          </>
        ) : null}

        {flow === "fiat-refund" && fiat && fiat !== "NGN" ? (
          <>
            <p className="text-sm text-muted">
              Enter the bank account that sends this transfer — Paycrest uses it for{" "}
              <strong className="text-foreground">refunds</strong> if needed. Use your own details.
            </p>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Landmark className="size-4" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-muted">Bank / institution</span>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    Pick a bank Paycrest supports for {fiat}, or enter the institution identifier
                    manually if needed.
                  </p>
                </div>
              </div>
              {institutionsLoading ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/80 bg-neutral-50/80 px-3 py-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Landmark className="size-5 text-muted" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="h-4 flex-1 animate-pulse rounded-md bg-neutral-200/80" aria-hidden />
                </div>
              ) : institutionOptions.length > 0 && !institutionManual ? (
                <div className="mt-3 flex flex-col gap-2">
                  <div ref={bankPickerRef} className="flex flex-col gap-0">
                    <button
                      type="button"
                      id="refund-inst-select"
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
                          {selectedInstitutionLabel ?? "Select your bank"}
                        </span>
                        {!refundInstitution.trim() ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            Search and choose from the list
                          </span>
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
                          {filteredInstitutions.length === 0 ? (
                            <li className="px-4 py-6 text-center text-sm text-muted">
                              No banks match that search.
                            </li>
                          ) : (
                            filteredInstitutions.map((o) => {
                              const selected = refundInstitution === o.value;
                              return (
                                <li key={o.value} role="presentation">
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => {
                                      setRefundInstitution(o.value);
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
                  <button
                    type="button"
                    onClick={() => {
                      setInstitutionManual(true);
                      setRefundInstitution("");
                      setBankPickerOpen(false);
                    }}
                    className="text-left text-xs font-semibold text-primary active:opacity-80"
                  >
                    Enter institution code manually
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {institutionOptions.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setInstitutionManual(false);
                        setRefundInstitution("");
                      }}
                      className="text-left text-xs font-semibold text-primary active:opacity-80"
                    >
                      Choose from Paycrest bank list
                    </button>
                  ) : null}
                  {institutionsError ? (
                    <p className="text-xs text-amber-800">{institutionsError}</p>
                  ) : null}
                  <div className="relative">
                    <Landmark
                      className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      id="refund-inst"
                      autoComplete="off"
                      placeholder="Institution code or name (Paycrest format)"
                      value={refundInstitution}
                      onChange={(e) => setRefundInstitution(e.target.value)}
                      className="w-full rounded-2xl border border-border/90 bg-white py-3 pl-12 pr-3 text-base text-foreground shadow-sm outline-none ring-primary/20 transition hover:border-primary/25 focus:ring-2"
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="refund-acct" className="text-xs font-semibold text-muted">
                Account number
              </label>
              <input
                id="refund-acct"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Account number"
                value={refundAccountId}
                onChange={(e) => setRefundAccountId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-3 text-base text-foreground outline-none ring-primary/20 focus:ring-2"
              />
            </div>
            <div>
              <label htmlFor="refund-name" className="text-xs font-semibold text-muted">
                Account name
              </label>
              <input
                id="refund-name"
                autoComplete="name"
                placeholder="Full name on the account"
                value={refundAccountName}
                onChange={(e) => setRefundAccountName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-3 text-base text-foreground outline-none ring-primary/20 focus:ring-2"
              />
            </div>

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {submitError}
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                !fiatAmountOk ||
                !refundOk ||
                !onrampBoundsOk ||
                submitLoading ||
                !rateQuote?.trim() ||
                rateKey !== `${fiat}:${formatAmountForPaycrest(fiatAmountNum, fiat)}`
              }
              onClick={() => void submitPaycrestOrder()}
              className="min-h-12 w-full rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-40 active:bg-primary-hover"
            >
              {submitLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Getting instructions…
                </span>
              ) : (
                "Get transfer instructions"
              )}
            </button>
          </>
        ) : null}

        {flow === "fiat-account" && fiat && instructionsIncomplete && !usedFallback ? (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <p className="font-semibold">Order created — bank details pending</p>
              <p className="mt-2 text-tabular-nums text-foreground">
                Amount: {BANK_TRANSFER_FIATS[fiat].symbol}
                {BANK_TRANSFER_FIATS[fiat].symbol.length > 1 ? " " : ""}
                {formatFiatAmount(fiat, fiatAmountNum)} ({fiat})
              </p>
              <p className="mt-2 leading-relaxed">
                Paycrest accepted your request but did not return deposit instructions in the
                response. Save your order id for support:
              </p>
              {paycrestOrderId ? (
                <p className="mt-2 font-mono text-xs font-medium text-foreground">{paycrestOrderId}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {flow === "fiat-account" && fiat && display ? (
          <>
            {usedFallback ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Paycrest isn&apos;t configured in this environment — showing{" "}
                <strong>example</strong> bank details only. Set{" "}
                <code className="rounded bg-white/80 px-1">PAYCREST_API_BASE_URL</code> and{" "}
                <code className="rounded bg-white/80 px-1">PAYCREST_API_KEY</code> for live
                instructions.
              </div>
            ) : null}

            <div className="rounded-xl border border-primary/25 bg-primary-muted/40 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Your transfer</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {BANK_TRANSFER_FIATS[fiat].symbol}
                {BANK_TRANSFER_FIATS[fiat].symbol.length > 1 ? " " : ""}
                {formatFiatAmount(fiat, fiatAmountNum)}
              </p>
              {display.amountToTransfer ? (
                <p className="mt-1 text-sm text-muted">
                  Pay exactly:{" "}
                  <strong className="text-foreground">{display.amountToTransfer}</strong>
                  {display.transferCurrency ? ` ${display.transferCurrency}` : ""}
                </p>
              ) : null}
              {display.validUntil ? (
                <p className="mt-1.5 text-sm text-muted">
                  <span className="font-semibold text-foreground">Complete transfer by</span>
                  <br />
                  <span className="tabular-nums">{formatValidUntilDisplay(display.validUntil)}</span>
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                Credited in <strong className="text-foreground">USDC</strong> after we
                confirm your payment.
              </p>
            </div>

            {paycrestOrderId ? (
              <p className="text-xs text-muted">
                Order reference:{" "}
                <span className="font-mono font-medium text-foreground">{paycrestOrderId}</span>
              </p>
            ) : null}

            <div className="flex items-center gap-3 rounded-xl bg-primary-muted/50 px-3 py-2">
              <Image
                src={BANK_TRANSFER_FIATS[fiat].flag}
                alt={`${BANK_TRANSFER_FIATS[fiat].country} flag`}
                width={44}
                height={30}
                className="h-[30px] w-11 shrink-0 rounded-md object-cover ring-1 ring-black/10"
              />
              <p className="text-sm text-foreground">
                Send only <strong>{BANK_TRANSFER_FIATS[fiat].symbol}</strong> ({fiat}) from accounts
                in your own name. Use the exact amount shown if the provider specified one.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Virtual account
              </p>
              <div className="flex flex-col gap-3">
                <CopyField label="Bank name" value={display.bankName} />
                <CopyField label="Account number" value={display.accountNumber} compact />
                <CopyField label="Account name" value={display.accountName} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTransferAckOpen(true)}
              className="min-h-12 w-full rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm active:bg-primary-hover"
            >
              I&apos;ve transferred
            </button>
            <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-muted">
              We&apos;ll notify you when the funds are converted and USDC appears in your wallet.
              Timing depends on your bank and local rails.
            </p>
          </>
        ) : null}

        {flow === "crypto-tokens" ? (
          <>
            <p className="text-sm text-muted">
              Send USDC directly to your deposit address. We&apos;ll show a QR code you can scan from another wallet.
            </p>
            <button
              type="button"
              onClick={() => {
                setToken("USDC");
                setFlow("crypto-address");
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-4 text-left shadow-sm active:bg-primary-muted/40"
            >
              <Image
                src="/crypto/usdc.svg"
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full ring-1 ring-black/10"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">USDC</span>
                <span className="text-sm text-muted">USD Coin</span>
              </span>
            </button>

            <div
              className="relative rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70"
              aria-disabled="true"
            >
              <div className="pointer-events-none flex w-full select-none items-center gap-3 p-4 blur-[1px]">
                <Image
                  src="/crypto/usdt.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-full ring-1 ring-black/10"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">USDT</span>
                  <span className="text-sm text-muted">Tether USD</span>
                </span>
              </div>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-neutral-800/88 px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-wide text-white shadow-sm backdrop-blur-[2px]">
                Coming Soon
              </span>
            </div>
          </>
        ) : null}

        {flow === "crypto-address" && token ? (
          <>
            <div className="flex items-center gap-2">
              <Image
                src={token === "USDT" ? "/crypto/usdt.svg" : "/crypto/usdc.svg"}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full ring-1 ring-black/10"
              />
              <div>
                <p className="font-semibold text-foreground">Your {token} deposit</p>
                <p className="text-xs text-muted">ERC-20 · BASE</p>
              </div>
            </div>
            {depositLoading ? (
              <DepositAddressSkeleton />
            ) : depositError ? (
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-sm text-foreground">{depositError}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDepositRetry((n) => n + 1)}
                    className="text-sm font-semibold text-primary"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDepositError(null);
                      setFlow("crypto-tokens");
                      setToken(null);
                    }}
                    className="text-sm font-medium text-muted"
                  >
                    Go back
                  </button>
                </div>
              </div>
            ) : depositAddress ? (
              <>
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="rounded-xl bg-white p-2 ring-1 ring-neutral-100">
                    <QRCodeSVG
                      value={depositAddress}
                      size={176}
                      level="M"
                      marginSize={1}
                      className="size-[176px]"
                    />
                  </div>
                  <p className="flex items-center gap-1 text-xs font-medium text-muted">
                    <QrCode className="size-3.5" aria-hidden />
                    Scan from your other wallet
                  </p>
                </div>
                <CopyField label="Wallet address" value={depositAddress} compact />
              </>
            ) : null}
            {depositAddress ? (
              <p className="rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950">
                Only send <strong>{token}</strong> on <strong>{KUDI_CHAIN.name}</strong>. Sending
                other tokens or using the wrong network may result in permanent loss.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </MobileBottomSheet>

    <MobileBottomSheet
      open={transferAckOpen}
      onOpenChange={setTransferAckOpen}
      title="What happens next"
      showClose
      stackClassName="z-[65]"
    >
      <div className="flex flex-col gap-4 pb-1">
        <p className="text-sm leading-relaxed text-muted">
          After your bank sends the payment, Paycrest usually confirms it in{" "}
          <strong className="text-foreground">under 60 seconds</strong>. Then{" "}
          <strong className="text-foreground">USDC</strong> is deposited to your Kudi wallet on Base
          and your balance updates—you don&apos;t need to do anything else.
        </p>
        <button
          type="button"
          onClick={() => setTransferAckOpen(false)}
          className="min-h-12 w-full rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm active:bg-primary-hover"
        >
          Got it
        </button>
      </div>
    </MobileBottomSheet>
    </>
  );
}
