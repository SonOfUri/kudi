import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { PaycrestFiatCode } from "@/lib/paycrest/constants";
import { isPaycrestFiat } from "@/lib/paycrest/constants";
import {
  createPaycrestSenderOrder,
  estimatedUsdcNumber,
  extractBuyQuote,
  fetchPaycrestRate,
  MAX_ONRAMP_USDC,
  MIN_ONRAMP_USDC,
  normalizeCreateOrderResponse,
} from "@/lib/paycrest/client";
import { isPaycrestOnrampConfigured } from "@/lib/paycrest/config";
import { ensureUserWallet } from "@/lib/wallet-provision";

const refundSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  accountIdentifier: z.string().trim().min(1).max(80),
  accountName: z.string().trim().min(1).max(200),
});

const bodySchema = z.object({
  amount: z.string().trim().regex(/^[\d.]+$/),
  currency: z.string().trim().length(3),
  rate: z.string().trim().min(1).max(80).optional(),
  refundAccount: refundSchema,
});

function referenceForUser(userId: string) {
  return `kudi-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create Paycrest sender order; persist row for webhook correlation.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPaycrestOnrampConfigured()) {
    return NextResponse.json(
      { error: "On-ramp is not configured.", code: "PAYCREST_DISABLED" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const currency = parsed.data.currency.toUpperCase();
  if (!isPaycrestFiat(currency)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  try {
    const fiatNum = Number.parseFloat(parsed.data.amount);
    if (!Number.isFinite(fiatNum) || fiatNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const rateJson = await fetchPaycrestRate(parsed.data.amount, currency as PaycrestFiatCode);
    const { rate: verifiedRate } = extractBuyQuote(rateJson);
    if (!verifiedRate?.trim()) {
      return NextResponse.json(
        { error: "Could not verify deposit minimum for this amount." },
        { status: 502 },
      );
    }
    const usdcEst = estimatedUsdcNumber(fiatNum, verifiedRate);
    if (usdcEst === null || usdcEst < MIN_ONRAMP_USDC) {
      return NextResponse.json(
        {
          error: `Minimum deposit is ${MIN_ONRAMP_USDC} USDC (~$${MIN_ONRAMP_USDC}). Increase your amount.`,
          code: "MIN_ONRAMP_USDC",
        },
        { status: 400 },
      );
    }
    if (usdcEst > MAX_ONRAMP_USDC) {
      return NextResponse.json(
        {
          error: `Maximum deposit is ${MAX_ONRAMP_USDC} USDC (~$${MAX_ONRAMP_USDC}). Reduce your amount.`,
          code: "MAX_ONRAMP_USDC",
        },
        { status: 400 },
      );
    }

    const { address } = await ensureUserWallet(user.id);
    const reference = referenceForUser(user.id);

    const raw = await createPaycrestSenderOrder({
      amount: parsed.data.amount,
      amountIn: "fiat",
      rate: parsed.data.rate,
      fiatCurrency: currency as PaycrestFiatCode,
      refundAccount: parsed.data.refundAccount,
      recipientAddress: address,
      reference,
    });

    const normalized = normalizeCreateOrderResponse(raw);
    if (!normalized) {
      console.error("[api/paycrest/onramp] Unexpected response shape:", raw);
      return NextResponse.json(
        { error: "Unexpected response from payment partner." },
        { status: 502 },
      );
    }

    await db.paycrestOnrampOrder.create({
      data: {
        userId: user.id,
        paycrestOrderId: normalized.paycrestOrderId,
        reference,
        status: normalized.status ?? "PENDING",
        fiatCurrency: currency,
        amountFiat: parsed.data.amount,
        rate: parsed.data.rate ?? null,
        providerAccount: normalized.providerAccount
          ? (normalized.providerAccount as object)
          : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: normalized.paycrestOrderId,
      reference,
      status: normalized.status,
      providerAccount: normalized.providerAccount,
    });
  } catch (e) {
    console.error("[api/paycrest/onramp]", e);
    const message = e instanceof Error ? e.message : "Order creation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
