import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getPaycrestSecretKey } from "@/lib/paycrest/config";
import {
  parseWebhookClientIp,
  isPaycrestWebhookIpAllowed,
  verifyPaycrestWebhookSignature,
} from "@/lib/paycrest/webhook-verify";

export const runtime = "nodejs";

function mapPaycrestEventToStatus(event: string): string {
  switch (event) {
    case "payment_order.settled":
      return "SETTLED";
    case "payment_order.validated":
      return "VALIDATED";
    case "payment_order.pending":
      return "PENDING";
    case "payment_order.expired":
      return "EXPIRED";
    case "payment_order.refunded":
      return "REFUNDED";
    default:
      return event;
  }
}

/**
 * Paycrest payment webhooks — verify HMAC, update on-ramp or off-ramp order by Paycrest order id.
 */
export async function POST(req: Request) {
  if (!getPaycrestSecretKey()) {
    console.error("[webhooks/paycrest] PAYCREST_SECRET_KEY is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("x-paycrest-signature");

  const clientIp = parseWebhookClientIp(req.headers.get("x-forwarded-for"));
  if (!isPaycrestWebhookIpAllowed(clientIp)) {
    console.warn("[webhooks/paycrest] IP not allowlisted:", clientIp);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!verifyPaycrestWebhookSignature(rawBody, sig)) {
    console.warn("[webhooks/paycrest] Bad signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { event?: string; data?: { id?: string } };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const orderId =
    payload.data && typeof payload.data === "object" && typeof payload.data.id === "string"
      ? payload.data.id
      : null;

  if (orderId) {
    const status = mapPaycrestEventToStatus(event);
    try {
      const onramp = await db.paycrestOnrampOrder.updateMany({
        where: { paycrestOrderId: orderId },
        data: { status },
      });
      if (onramp.count === 0) {
        const offramp = await db.paycrestOfframpOrder.updateMany({
          where: { paycrestOrderId: orderId },
          data: { status },
        });
        if (offramp.count === 0) {
          console.warn("[webhooks/paycrest] No local order for Paycrest id:", orderId);
        }
      }
    } catch (e) {
      console.error("[webhooks/paycrest] DB update failed:", e);
      return NextResponse.json({ error: "Storage error" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
