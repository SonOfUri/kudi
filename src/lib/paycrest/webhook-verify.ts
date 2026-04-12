import { createHmac, timingSafeEqual } from "crypto";

import { getPaycrestSecretKey } from "./config";

/**
 * Verifies `x-paycrest-signature` per Paycrest guide (HMAC-SHA256 hex).
 * Tries raw body first, then JSON.stringify(JSON.parse(body)) as fallback.
 */
export function verifyPaycrestWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = getPaycrestSecretKey();
  if (!secret) {
    return false;
  }
  const sig = signatureHeader?.trim().toLowerCase();
  if (!sig) {
    return false;
  }

  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (sig === expectedHex.toLowerCase()) {
    return true;
  }

  try {
    const reparsed = JSON.stringify(JSON.parse(rawBody));
    const altHex = createHmac("sha256", secret).update(reparsed).digest("hex");
    if (sig === altHex.toLowerCase()) {
      return true;
    }
  } catch {
    /* ignore */
  }

  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

export function parseWebhookClientIp(header: string | null): string | null {
  if (!header?.trim()) return null;
  return header.split(",")[0]?.trim() ?? null;
}

export function isPaycrestWebhookIpAllowed(clientIp: string | null): boolean {
  const raw = process.env.PAYCREST_WEBHOOK_IPS?.trim();
  if (!raw) {
    return true;
  }
  if (!clientIp) {
    return false;
  }
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return allowed.has(clientIp);
}
