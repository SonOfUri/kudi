/**
 * Normalize Paycrest institutions payloads to `{ value, label }[]`.
 * `value` is sent as `refundAccount.institution` on create order.
 */

export type InstitutionOption = { value: string; label: string };

function asArray(x: unknown): unknown[] {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.institutions)) return o.institutions;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.banks)) return o.banks;
  }
  return [];
}

function rowValue(row: Record<string, unknown>): string | null {
  const candidates = [
    row.institution,
    row.code,
    row.bankCode,
    row.id,
    row.identifier,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return null;
}

function rowLabel(row: Record<string, unknown>, value: string): string {
  const name = row.name ?? row.bankName ?? row.label ?? row.title ?? row.institutionName;
  if (typeof name === "string" && name.trim()) {
    const n = name.trim();
    return n === value ? n : `${n} · ${value}`;
  }
  return value;
}

export function normalizePaycrestInstitutions(json: unknown): InstitutionOption[] {
  const rows = asArray(json);
  const map = new Map<string, string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const value = rowValue(r);
    if (!value) continue;
    if (!map.has(value)) {
      map.set(value, rowLabel(r, value));
    }
  }

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}
