import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
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

  // Keep `amount` in the query string for backward compatibility, but always fetch a unit rate
  // and let the frontend convert the user's input amount.
  if (amount && !/^[\d.]+$/.test(amount)) {
    return NextResponse.json({ error: "Invalid USDC amount" }, { status: 400 });
  }

  if (!isPaycrestFiat(currencyRaw)) {
    return NextResponse.json(
      { error: "This currency is not available for bank cash-out yet." },
      { status: 400 },
    );
  }

  try {
    const UNIT_AMOUNT_USDC = "1";
    const json = await fetchPaycrestRate(UNIT_AMOUNT_USDC, currencyRaw);
    const { rate } = extractSellQuote(json);
    return NextResponse.json({
      currency: currencyRaw,
      amountUsdc: amount,
      unitAmountUsdc: UNIT_AMOUNT_USDC,
      rate,
      /** Same as `receiveAmount` for this corridor; kept for older clients. */
      ngnReceive: null,
      receiveAmount: null,
    });
  } catch (e) {
    console.error("[api/paycrest/offramp/rate]", e);
    return NextResponse.json(
      { error: "Could not load a quote right now. Try again in a moment." },
      { status: 502 },
    );
  }
}
