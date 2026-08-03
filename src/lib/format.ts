/**
 * Shared number / date formatting so every table in the app renders values
 * the same way. Numeric cells are right-aligned with tabular figures.
 */

const NUMERIC_RE = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/;

/** True when a raw SAP string/number should be treated as a number. */
export function isNumericValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return NUMERIC_RE.test(v);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/,/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Integer-ish counts and quantities: grouped, up to 3 decimals, no padding. */
export function formatNumber(value: unknown, fallback = "—"): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

/** Money / amounts: grouped with exactly 2 decimals. */
export function formatAmount(value: unknown, fallback = "—"): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Money with the Indian rupee symbol. */
export function formatCurrency(value: unknown, fallback = "—"): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  return `₹${formatAmount(n)}`;
}

/** Quantity plus unit of measure, e.g. "1,200 EA". */
export function formatQuantity(value: unknown, uom?: string | null): string {
  const q = formatNumber(value);
  if (q === "—") return q;
  return uom ? `${q} ${uom}` : q;
}

/**
 * Dates: consistent DD-MMM-YYYY. Handles ISO strings, Date objects and the
 * SAP 8-digit YYYYMMDD form.
 */
export function formatDate(value: unknown, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (typeof value === "string") {
    const v = value.trim();
    if (/^\d{8}$/.test(v)) {
      d = new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00`);
    } else {
      const parsed = new Date(v);
      d = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  if (!d || Number.isNaN(d.getTime())) return fallback;
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/ /g, "-");
}

/** Date + time for audit trails. */
export function formatDateTime(value: unknown, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return fallback;
  return `${formatDate(d)} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
