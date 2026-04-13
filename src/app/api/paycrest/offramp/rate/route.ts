import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  estimateNgnFromSell,
  extractSellQuote,
  fetchPaycrestRate,
} from "@/lib/paycrest/client";
import { isPaycrestOnrampConfigured } from "@/lib/paycrest/config";
import { isPaycrestFiat } from "@/lib/paycrest/constants";

/**
 * Quote: USDC → fiat sell side (Paycrest `data.sell.rate`). `currency` defaults to NGN.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPaycrestOnrampConfigured()) {
    return NextResponse.json(
      { error: "Bank transfers are not available right now.", code: "FIAT_TRANSFER_DISABLED" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const amount = searchParams.get("amount")?.trim() ?? "";
  const currencyRaw = searchParams.get("currency")?.trim().toUpperCase() ?? "NGN";

  if (!amount || !/^[\d.]+$/.test(amount)) {
    return NextResponse.json({ error: "Invalid USDC amount" }, { status: 400 });
  }

  const usdcNum = Number.parseFloat(amount);
  if (!Number.isFinite(usdcNum) || usdcNum <= 0) {
    return NextResponse.json({ error: "Invalid USDC amount" }, { status: 400 });
  }

  if (!isPaycrestFiat(currencyRaw)) {
    return NextResponse.json(
      { error: "This currency is not available for bank cash-out yet." },
      { status: 400 },
    );
  }

  try {
    const json = await fetchPaycrestRate(amount, currencyRaw);
    const { rate, ngnReceive: ngnFromApi } = extractSellQuote(json);
    const receiveAmount =
      ngnFromApi?.trim() ||
      (rate && Number.isFinite(usdcNum) && usdcNum > 0 ? estimateNgnFromSell(usdcNum, rate) : null);
    return NextResponse.json({
      currency: currencyRaw,
      amountUsdc: amount,
      rate,
      /** Same as `receiveAmount` for this corridor; kept for older clients. */
      ngnReceive: currencyRaw === "NGN" ? receiveAmount : null,
      receiveAmount,
    });
  } catch (e) {
    console.error("[api/paycrest/offramp/rate]", e);
    return NextResponse.json(
      { error: "Could not load a quote right now. Try again in a moment." },
      { status: 502 },
    );
  }
}
