/**
 * Paycrest server-side configuration. Never import this module from client components.
 */
export function getPaycrestBaseUrl(): string {
  const u = process.env.PAYCREST_API_BASE_URL?.trim();
  if (!u) {
    throw new Error("PAYCREST_API_BASE_URL is not set");
  }
  return u.replace(/\/$/, "");
}

export function getPaycrestApiKey(): string | null {
  const k = process.env.PAYCREST_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

export function getPaycrestSecretKey(): string | null {
  const k = process.env.PAYCREST_SECRET_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

export function isPaycrestOnrampConfigured(): boolean {
  try {
    getPaycrestBaseUrl();
    return getPaycrestApiKey() !== null;
  } catch {
    return false;
  }
}
