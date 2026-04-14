/** Fiat corridors supported for Paycrest on-ramp/off-ramp via Paycrest rates + sender API. */
export const PAYCREST_FIAT_CODES = ["NGN", "KES"] as const;

export type PaycrestFiatCode = (typeof PAYCREST_FIAT_CODES)[number];

export function isPaycrestFiat(code: string): code is PaycrestFiatCode {
  return (PAYCREST_FIAT_CODES as readonly string[]).includes(code);
}
