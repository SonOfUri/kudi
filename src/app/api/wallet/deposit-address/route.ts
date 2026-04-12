import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { ensureUserWallet } from "@/lib/wallet-provision";

/**
 * Returns the authenticated user's custodial deposit address (public).
 * Provisions a wallet on first request if missing (new and legacy users).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const wallet = await ensureUserWallet(user.id);
    return NextResponse.json({ address: wallet.address });
  } catch (err) {
    console.error("[api/wallet/deposit-address]", err);
    const message = err instanceof Error ? err.message : "Could not load wallet.";
    return NextResponse.json({ error: message, code: "WALLET_PROVISION_FAILED" }, { status: 500 });
  }
}
