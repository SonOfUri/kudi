import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { verifyPaycrestAccount } from "@/lib/paycrest/client";
import { isPaycrestOnrampConfigured } from "@/lib/paycrest/config";

const bodySchema = z.object({
  institution: z.string().trim().min(1).max(200),
  accountIdentifier: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
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

  try {
    const { accountName } = await verifyPaycrestAccount(
      parsed.data.institution,
      parsed.data.accountIdentifier,
    );
    if (!accountName) {
      return NextResponse.json(
        { error: "Could not verify this account. Check bank and account number." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, accountName });
  } catch (e) {
    console.error("[api/paycrest/verify-account]", e);
    return NextResponse.json(
      { error: "We could not verify that account right now. Please try again." },
      { status: 502 },
    );
  }
}
