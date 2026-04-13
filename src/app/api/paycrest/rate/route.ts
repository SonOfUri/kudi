import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isPaycrestFiat } from "@/lib/paycrest/constants";
import { estimateUsdcReceive, extractBuyQuote, fetchPaycrestRate } from "@/lib/paycrest/client";
import { isPaycrestOnrampConfigured } from "@/lib/paycrest/config";

/**
 * Quote: fiat → USDC buy rate for Base (Paycrest public rates endpoint).
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
  const currency = (searchParams.get("currency") ?? "NGN").trim().toUpperCase();

  if (!amount || !/^[\d.]+$/.test(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!isPaycrestFiat(currency)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  try {
    const json = await fetchPaycrestRate(amount, currency);
    const { rate, usdcReceive: usdcFromApi } = extractBuyQuote(json);
    const fiatNum = Number.parseFloat(amount);
    let usdcReceive =
      usdcFromApi?.trim() ||
      (rate && Number.isFinite(fiatNum) && fiatNum > 0 ? estimateUsdcReceive(fiatNum, rate) : null);
    return NextResponse.json({
      currency,
      amount,
      rate,
      usdcReceive,
    });
  } catch (e) {
    console.error("[api/paycrest/rate]", e);
    return NextResponse.json(
      { error: "Could not load a rate right now. Try again in a moment." },
      { status: 502 },
    );
  }
}
