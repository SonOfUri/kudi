import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isPaycrestFiat } from "@/lib/paycrest/constants";
import { fetchPaycrestInstitutions } from "@/lib/paycrest/client";
import { isPaycrestOnrampConfigured } from "@/lib/paycrest/config";
import { normalizePaycrestInstitutions } from "@/lib/paycrest/normalize-institutions";

/**
 * Banks / institutions Paycrest accepts for `refundAccount.institution` for this fiat.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPaycrestOnrampConfigured()) {
    return NextResponse.json(
      { error: "On-ramp is not configured.", code: "PAYCREST_DISABLED", items: [] },
      { status: 503 },
    );
  }

  const currency = (new URL(req.url).searchParams.get("currency") ?? "NGN").trim().toUpperCase();
  if (!isPaycrestFiat(currency)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  try {
    const data = await fetchPaycrestInstitutions(currency);
    const items = normalizePaycrestInstitutions(data);
    return NextResponse.json({ currency, items });
  } catch (e) {
    console.error("[api/paycrest/institutions]", e);
    const message = e instanceof Error ? e.message : "Institutions request failed";
    return NextResponse.json({ error: message, items: [] }, { status: 502 });
  }
}
