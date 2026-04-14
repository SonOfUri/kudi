import { parseUnits } from "ethers";

import type { PaycrestFiatCode } from "./constants";
import { getPaycrestApiKey, getPaycrestBaseUrl } from "./config";

const NETWORK = "base";
const DEST_TOKEN = "USDC";

function getBuyObject(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const data = (json as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return null;
  const buy = (data as Record<string, unknown>).buy;
  return buy && typeof buy === "object" ? (buy as Record<string, unknown>) : null;
}

function formatUsdcAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 0.01) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function pickUsdcFromBuy(buy: Record<string, unknown>): string | null {
  const keys = [
    "usdc",
    "amountOut",
    "receive",
    "cryptoAmount",
    "destinationAmount",
    "tokenAmount",
    "quote",
    "total",
  ];
  for (const k of keys) {
    const v = buy[k];
    if (typeof v === "string" && /^[\d.]/.test(v.trim())) return v.trim();
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return formatUsdcAmount(v);
  }
  for (const nestedKey of ["crypto", "token", "destination"] as const) {
    const nested = buy[nestedKey];
    if (!nested || typeof nested !== "object") continue;
    const o = nested as Record<string, unknown>;
    for (const k of ["amount", "value", "quantity"]) {
      const v = o[k];
      if (typeof v === "string" && /^[\d.]/.test(v.trim())) return v.trim();
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return formatUsdcAmount(v);
    }
  }
  return null;
}

/**
 * If Paycrest omits USDC out on `buy`, infer from numeric `rate`:
 * `rate > 1` → treated as fiat per 1 USDC (divide). Else → USDC per 1 fiat (multiply).
 */
export function estimateUsdcReceive(fiatAmount: number, rateStr: string): string | null {
  const r = Number.parseFloat(String(rateStr).replace(/,/g, ""));
  if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(fiatAmount) || fiatAmount <= 0) return null;
  const usdc = r > 1 ? fiatAmount / r : fiatAmount * r;
  if (!Number.isFinite(usdc) || usdc <= 0) return null;
  return formatUsdcAmount(usdc);
}

/** Numeric USDC estimate from fiat + Paycrest `rate` (same rules as `estimateUsdcReceive`). */
export function estimatedUsdcNumber(fiatAmount: number, rateStr: string): number | null {
  const s = estimateUsdcReceive(fiatAmount, rateStr);
  if (!s) return null;
  const n = Number.parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractBuyQuote(json: unknown): { rate: string | null; usdcReceive: string | null } {
  const buy = getBuyObject(json);
  if (!buy) return { rate: null, usdcReceive: null };
  const rateRaw = buy.rate;
  const rate = typeof rateRaw === "string" && rateRaw.length > 0 ? rateRaw : null;
  const usdcReceive = pickUsdcFromBuy(buy);
  return { rate, usdcReceive };
}

export function extractBuyRate(json: unknown): string | null {
  return extractBuyQuote(json).rate;
}

function getSellObject(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const data = (json as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return null;
  const sell = (data as Record<string, unknown>).sell;
  return sell && typeof sell === "object" ? (sell as Record<string, unknown>) : null;
}

function pickNgnFromSell(sell: Record<string, unknown>): string | null {
  const keys = ["ngn", "amountOut", "receive", "fiatAmount", "destinationAmount", "total"];
  for (const k of keys) {
    const v = sell[k];
    if (typeof v === "string" && /^[\d.]/.test(v.trim())) return v.trim();
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(Math.round(v));
  }
  return null;
}

/**
 * Off-ramp quote: use `data.sell.rate` (not buy) per Paycrest guide.
 */
export function extractSellQuote(json: unknown): { rate: string | null; ngnReceive: string | null } {
  const sell = getSellObject(json);
  if (!sell) return { rate: null, ngnReceive: null };
  const rateRaw = sell.rate;
  const rate = typeof rateRaw === "string" && rateRaw.length > 0 ? rateRaw : null;
  const ngnReceive = pickNgnFromSell(sell);
  return { rate, ngnReceive };
}

/** Rough NGN from USDC + sell rate (rate usually NGN per 1 USDC when > 50). */
export function estimateNgnFromSell(usdcAmount: number, rateStr: string): string | null {
  const r = Number.parseFloat(String(rateStr).replace(/,/g, ""));
  if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(usdcAmount) || usdcAmount <= 0) return null;
  const ngn = r > 50 ? usdcAmount * r : usdcAmount / r;
  if (!Number.isFinite(ngn) || ngn <= 0) return null;
  return Math.round(ngn).toLocaleString("en-NG");
}

/** Minimum USDC to cash out to bank (product guardrail). */
export const MIN_OFFRAMP_USDC = 1;

export type PaycrestRefundAccount = {
  institution: string;
  accountIdentifier: string;
  accountName: string;
};

export type CreateSenderOrderInput = {
  amount: string;
  amountIn: "fiat";
  rate?: string;
  fiatCurrency: PaycrestFiatCode;
  refundAccount: PaycrestRefundAccount;
  recipientAddress: string;
  reference: string;
};

/**
 * GET /rates/base/USDC/{amount}/{fiat} — public in reference backend.
 */
export async function fetchPaycrestRate(amount: string, fiatCurrency: PaycrestFiatCode): Promise<unknown> {
  const base = getPaycrestBaseUrl();
  const path = `/rates/${NETWORK}/${DEST_TOKEN}/${encodeURIComponent(amount)}/${fiatCurrency}`;
  const res = await fetch(`${base}${path}`, { method: "GET", cache: "no-store" });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = typeof json === "object" && json !== null && "message" in json
      ? String((json as { message: unknown }).message)
      : text.slice(0, 200);
    throw new Error(`Paycrest rate failed (${res.status}): ${msg}`);
  }
  return json;
}

/**
 * POST /sender/orders — requires API-Key.
 */
export async function createPaycrestSenderOrder(input: CreateSenderOrderInput): Promise<unknown> {
  const base = getPaycrestBaseUrl();
  const key = getPaycrestApiKey();
  if (!key) {
    throw new Error("PAYCREST_API_KEY is not set");
  }

  const body = {
    amount: input.amount,
    amountIn: input.amountIn,
    ...(input.rate ? { rate: input.rate } : {}),
    source: {
      type: "fiat",
      currency: input.fiatCurrency,
      refundAccount: {
        institution: input.refundAccount.institution.trim(),
        accountIdentifier: input.refundAccount.accountIdentifier.trim(),
        accountName: input.refundAccount.accountName.trim(),
      },
    },
    destination: {
      type: "crypto",
      currency: DEST_TOKEN,
      recipient: {
        address: input.recipientAddress,
        network: NETWORK,
      },
    },
    reference: input.reference,
  };

  const res = await fetch(`${base}/sender/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-Key": key,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : typeof json === "object" && json !== null && "error" in json
          ? String((json as { error: unknown }).error)
          : text.slice(0, 300);
    throw new Error(`Paycrest order failed (${res.status}): ${msg}`);
  }

  return json;
}

/**
 * GET /institutions/{currency} — list banks for refund account picker (if supported).
 */
export async function fetchPaycrestInstitutions(fiatCurrency: PaycrestFiatCode): Promise<unknown> {
  const base = getPaycrestBaseUrl();
  const key = getPaycrestApiKey();
  const res = await fetch(`${base}/institutions/${fiatCurrency}`, {
    method: "GET",
    headers: key ? { "API-Key": key } : {},
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = text.slice(0, 200);
    throw new Error(`Paycrest institutions failed (${res.status}): ${msg}`);
  }
  return json;
}

export type NormalizedProviderAccount = {
  institution: string;
  accountIdentifier: string;
  accountName: string;
  amountToTransfer?: string;
  currency?: string;
  validUntil?: string;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Pull order id + provider instructions from create-order response. */
export function normalizeCreateOrderResponse(json: unknown): {
  paycrestOrderId: string;
  status: string | null;
  providerAccount: NormalizedProviderAccount | null;
} | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const id = str(data.id);
  if (!id) return null;
  const status = str(data.status) ?? null;
  const pa = data.providerAccount;
  let providerAccount: NormalizedProviderAccount | null = null;
  if (pa && typeof pa === "object") {
    const p = pa as Record<string, unknown>;
    const institution = str(p.institution) ?? str(p.bankName) ?? "";
    const accountIdentifier = str(p.accountIdentifier) ?? str(p.accountNumber) ?? "";
    const accountName = str(p.accountName) ?? "";
    if (institution || accountIdentifier || accountName) {
      providerAccount = {
        institution,
        accountIdentifier,
        accountName,
        amountToTransfer: str(p.amountToTransfer),
        currency: str(p.currency),
        validUntil: str(p.validUntil),
      };
    }
  }
  return { paycrestOrderId: id, status, providerAccount };
}

export type PaycrestOfframpRecipient = {
  institution: string;
  accountIdentifier: string;
  accountName: string;
  memo?: string;
};

export type CreateOfframpOrderInput = {
  amount: string;
  rate?: string;
  refundAddress: string;
  recipient: PaycrestOfframpRecipient;
  reference: string;
};

/**
 * POST /sender/orders — USDC on Base → NGN bank (off-ramp).
 */
export async function createPaycrestOfframpOrder(input: CreateOfframpOrderInput): Promise<unknown> {
  const base = getPaycrestBaseUrl();
  const key = getPaycrestApiKey();
  if (!key) {
    throw new Error("PAYCREST_API_KEY is not set");
  }

  const body: Record<string, unknown> = {
    amount: input.amount,
    source: {
      type: "crypto",
      currency: DEST_TOKEN,
      network: NETWORK,
      refundAddress: input.refundAddress,
    },
    destination: {
      type: "fiat",
      currency: "NGN",
      recipient: {
        institution: input.recipient.institution.trim(),
        accountIdentifier: input.recipient.accountIdentifier.trim(),
        accountName: input.recipient.accountName.trim(),
        ...(input.recipient.memo?.trim() ? { memo: input.recipient.memo.trim() } : {}),
      },
    },
    reference: input.reference,
  };
  if (input.rate?.trim()) {
    body.rate = input.rate.trim();
  }

  const res = await fetch(`${base}/sender/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-Key": key,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : typeof json === "object" && json !== null && "error" in json
          ? String((json as { error: unknown }).error)
          : text.slice(0, 300);
    throw new Error(`Paycrest off-ramp order failed (${res.status}): ${msg}`);
  }

  return json;
}

/**
 * POST /verify-account — resolve account holder name (server-side only).
 */
export async function verifyPaycrestAccount(
  institution: string,
  accountIdentifier: string,
): Promise<{ accountName: string | null }> {
  const base = getPaycrestBaseUrl();
  const key = getPaycrestApiKey();
  if (!key) {
    throw new Error("PAYCREST_API_KEY is not set");
  }

  const res = await fetch(`${base}/verify-account`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-Key": key,
    },
    body: JSON.stringify({
      institution: institution.trim(),
      accountIdentifier: accountIdentifier.trim(),
    }),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : text.slice(0, 200);
    throw new Error(msg || `Verify account failed (${res.status})`);
  }

  if (!json || typeof json !== "object") {
    return { accountName: null };
  }
  const root = json as Record<string, unknown>;
  const data = root.data;
  if (typeof data === "string" && data.trim()) {
    return { accountName: data.trim() };
  }
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const name =
      (typeof d.accountName === "string" && d.accountName.trim()) ||
      (typeof d.name === "string" && d.name.trim()) ||
      (typeof d.accountHolderName === "string" && d.accountHolderName.trim()) ||
      null;
    return { accountName: name };
  }
  return { accountName: null };
}

function trimUsdcHuman(s: string): string {
  const t = s.replace(/,/g, "").trim();
  if (!t || !/^[\d.]+$/.test(t)) return "0";
  return t;
}

export type NormalizedOfframpOrder = {
  paycrestOrderId: string;
  status: string | null;
  receiverAddress: string | null;
  validUntil: string | null;
  /** Human USDC fee if present */
  senderFeeUsdc: string;
  /** Human USDC principal from API if present */
  cryptoAmountUsdc: string | null;
  providerAccountJson: Record<string, unknown> | null;
};

/**
 * Parse create-order response for crypto→fiat: deposit address + amounts for custodial send.
 */
export function normalizeOfframpCreateResponse(
  json: unknown,
  fallbackAmountUsdc: string,
): NormalizedOfframpOrder | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const id = str(data.id);
  if (!id) return null;
  const status = str(data.status) ?? null;

  const pa = data.providerAccount;
  let receiverAddress: string | null = null;
  let validUntil: string | null = null;
  let providerAccountJson: Record<string, unknown> | null = null;
  if (pa && typeof pa === "object") {
    const p = pa as Record<string, unknown>;
    providerAccountJson = p;
    receiverAddress =
      str(p.receiverAddress) ?? str(p.receiveAddress) ?? str(p.receiver_address) ?? null;
    validUntil = str(p.validUntil) ?? str(p.valid_until) ?? null;
  }

  let senderFeeUsdc = "0";
  const sf = data.senderFee;
  if (typeof sf === "string" && /^[\d.]/.test(sf.trim())) {
    senderFeeUsdc = sf.trim();
  } else if (typeof sf === "number" && Number.isFinite(sf) && sf >= 0) {
    senderFeeUsdc = String(sf);
  } else if (sf && typeof sf === "object") {
    const o = sf as Record<string, unknown>;
    const amt = o.amount ?? o.value;
    if (typeof amt === "string" && /^[\d.]/.test(amt.trim())) senderFeeUsdc = amt.trim();
    else if (typeof amt === "number" && Number.isFinite(amt) && amt >= 0) senderFeeUsdc = String(amt);
  }

  let cryptoAmountUsdc: string | null = null;
  const amt = data.amount;
  if (typeof amt === "string" && /^[\d.]/.test(amt.trim())) {
    cryptoAmountUsdc = amt.trim();
  } else if (typeof amt === "number" && Number.isFinite(amt) && amt > 0) {
    cryptoAmountUsdc = String(amt);
  }

  return {
    paycrestOrderId: id,
    status,
    receiverAddress,
    validUntil,
    senderFeeUsdc,
    cryptoAmountUsdc,
    providerAccountJson,
  };
}

/** Total USDC to transfer (6-decimal base units) = order crypto amount + sender fee. */
export function offrampTotalUsdcBaseUnits(
  normalized: NormalizedOfframpOrder,
  requestedAmountUsdc: string,
): bigint {
  const principalHuman = normalized.cryptoAmountUsdc?.trim() || requestedAmountUsdc;
  const p = trimUsdcHuman(principalHuman);
  const f = trimUsdcHuman(normalized.senderFeeUsdc);
  return parseUnits(p, 6) + parseUnits(f, 6);
}
