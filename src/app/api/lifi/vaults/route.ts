import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { defaultVaultsSearchParams, fetchEarnVaultsFromSearchParams } from "@/lib/lifi/server";

/**
 * Proxies Earn Data API vault list (keeps LIFI_API_KEY on server).
 * Base (`KUDI_CHAIN`) only — client cannot override chainId.
 * Supports pagination via `cursor` query param.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incoming = new URL(req.url).searchParams;
  const merged = defaultVaultsSearchParams();
  for (const [key, value] of incoming.entries()) {
    merged.set(key, value);
  }
  merged.set("chainId", String(KUDI_CHAIN.chainId));

  try {
    const payload = await fetchEarnVaultsFromSearchParams(merged);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/lifi/vaults]", err);
    const message = err instanceof Error ? err.message : "Vaults request failed";
    const status = message.includes("LIFI_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message, code: "LIFI_VAULTS_FAILED" }, { status });
  }
}
