import type { CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";

const RESERVED = new Set(["select", "__key"]);

// Keys where the value is purely a numeric string of digits (e.g. a document
// number or customer code) but must NOT be right-aligned or formatted as a
// currency/quantity. These are treated as text.
const FORCE_TEXT_KEYS = new Set([
  "customer",
  "year",
  "contract_no",
  "contract_item",
  "sales_document_no",
  "sales_item_no",
  "company_code",
  "sales_org",
  "dis_chanel",
  "division",
  "material",
  "customer_group",
  "customer_price_group",
  "plant",
  "rel_1",
  "rel_2",
  "rel_3",
  "rel_4",
  "rel_5",
  "rel_6",
  "rel_7",
  "rel_8",
  "release_code_1",
  "approval_status",
  "status_1",
  "status_2",
  "status_3",
  "status_4",
  "status_5",
  "status_6",
  "status_7",
  "status_8",
]);

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function prettify(key: string): string {
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((s) => (s.length <= 3 ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))
    .join(" ");
}

function isDateLike(v: unknown): boolean {
  if (typeof v !== "string" || !v) return false;
  if (/^\d{8}$/.test(v)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  return false;
}

function fmtDate(v: string): string {
  if (/^\d{8}$/.test(v)) return `${v.slice(6, 8)}.${v.slice(4, 6)}.${v.slice(0, 4)}`;
  const d = new Date(v);
  if (!isNaN(+d)) return d.toLocaleDateString("en-GB").replaceAll("/", ".");
  return v;
}

function isNumericStrict(v: unknown): boolean {
  if (typeof v === "number") return isFinite(v);
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  // Must contain a decimal or non-digit char to be treated as numeric formatting.
  // Pure digit strings are treated as identifiers (see FORCE_TEXT_KEYS also).
  return /^-?\d+(\.\d+)?$/.test(s) && /[.,-]/.test(s);
}

function isFinancialLoose(v: unknown): boolean {
  if (typeof v === "number") return isFinite(v);
  if (typeof v !== "string") return false;
  const s = v.trim();
  return !!s && /^-?\d+(\.\d+)?$/.test(s);
}

function fmtNum(v: string | number): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return String(v);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type DynamicOptions = {
  exclude?: string[];
  /** Keys forced to display as-is (text), regardless of numeric content. */
  textKeys?: string[];
  /** Keys forced to display as formatted numbers (right aligned). */
  numericKeys?: string[];
  /** Keys that must always appear, even when every row is empty. */
  alwaysInclude?: string[];
  /** Per-key header label overrides (bypasses auto-prettify). */
  headerLabels?: Record<string, string>;
};

export function buildDynamicColumns<T extends Record<string, any>>(
  rows: T[],
  options: DynamicOptions = {},
): CloudscapeColumn<T>[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const exclude = new Set([...(options.exclude ?? [])]);
  const forceText = new Set([...(options.textKeys ?? [])]);
  const forceNum = new Set([...(options.numericKeys ?? [])]);
  const alwaysInclude = options.alwaysInclude ?? [];
  const alwaysSet = new Set(alwaysInclude);
  const headerLabels = options.headerLabels ?? {};

  // Union of keys, preserving order of first appearance.
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const k of Object.keys(row)) {
      if (seen.has(k)) continue;
      if (RESERVED.has(k) || exclude.has(k)) continue;
      seen.add(k);
      keys.push(k);
    }
  }
  // Append alwaysInclude keys that weren't observed in the data.
  for (const k of alwaysInclude) {
    if (RESERVED.has(k) || exclude.has(k)) continue;
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }

  // Drop keys where every row is empty, unless whitelisted via alwaysInclude.
  const nonEmpty = keys.filter((k) => alwaysSet.has(k) || rows.some((r) => !isEmpty(r?.[k])));


  return nonEmpty.map((key) => {
    // Decide render mode.
    const forcedText = forceText.has(key) || FORCE_TEXT_KEYS.has(key);
    const forcedNumeric = forceNum.has(key);

    // Sniff sample values.
    const samples = rows.map((r) => r?.[key]).filter((v) => !isEmpty(v));
    const looksDate = !forcedNumeric && !forcedText && samples.length > 0 && samples.every(isDateLike);

    let looksNumeric = false;
    if (forcedNumeric) {
      looksNumeric = true;
    } else if (!forcedText && !looksDate && samples.length > 0) {
      const numericCount = samples.filter((v) => isFinancialLoose(v)).length;
      const strictCount = samples.filter((v) => isNumericStrict(v)).length;
      // Right-align if strictly-financial (has decimal/sign) OR all values are numeric AND key hints money/qty.
      looksNumeric =
        strictCount === samples.length ||
        (numericCount === samples.length &&
          /(value|amount|price|rate|qty|quantity|total|tax|net|amt)/i.test(key));
    }

    const header = headerLabels[key] ?? prettify(key);
    const render = (v: unknown) => {
      if (isEmpty(v)) return "—";
      if (looksDate) return fmtDate(String(v));
      if (looksNumeric) return fmtNum(v as string | number);
      return String(v);
    };

    // Content-aware min width: fit the header and the widest rendered cell.
    let maxCellLen = 0;
    for (const r of rows) {
      const s = render(r?.[key]);
      if (s && s.length > maxCellLen) maxCellLen = s.length;
    }
    const chars = Math.max(header.length, maxCellLen);
    const padding = looksNumeric ? 44 : 32;
    const minWidth = Math.min(360, Math.max(96, chars * 8 + padding));

    return {
      id: key,
      header,
      align: looksNumeric ? "right" : undefined,
      minWidth,
      cell: (r: T) => render(r?.[key]),
    } satisfies CloudscapeColumn<T>;
  });
}

