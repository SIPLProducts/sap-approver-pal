/**
 * Payload builders for the MIGO_POST_API call.
 * Pure functions — kept out of the *.functions.ts wrapper module.
 */

export const MIGO_HEADER_KEYS = [
  "DOC_DATE",
  "PSTNG_DATE",
  "DELIV_NOTE",
  "VENDOR_NAME",
  "HEADER_TEXT",
  "POST",
  "GAT_NO",
  "GAT_DATE",
  "GIR_NO",
  "GIR_DATE",
  "VEHICLE_NO",
  "INVOICE_NO",
  "TRANSPORT_NO",
  "ZINSP",
  "ZNSP",
  "ZMTSNR",
] as const;

export const MIGO_CUSTOM_KEYS = [
  "GAT_NO",
  "GAT_DATE",
  "GIR_NO",
  "GIR_DATE",
  "VEHICLE_NO",
  "INVOICE_NO",
  "TRANSPORT_NO",
  "ZINSP",
  "ZNSP",
  "ZMTSNR",
] as const;

export const MIGO_ITEM_KEYS = [
  "MAT_DOC",
  "DOC_YEAR",
  "MATDOC_ITM",
  "MATERIAL",
  "WARRANTY",
  "OK",
  "PLANT",
  "DESCRIPTION",
  "STGE_LOC",
  "BATCH",
  "MOVE_TYPE",
  "STCK_TYPE",
  "SPEC_STOCK",
  "VENDOR",
  "VENDOR_NAME",
  "CUSTOMER",
  "SALES_ORD",
  "S_ORD_ITEM",
  "SCHED_LINE",
  "ENTRY_QNT",
  "ENTRY_UOM",
  "PO_PR_QNT",
  "ORDERPR_UN",
  "PO_NUMBER",
  "PO_ITEM",
  "ITEM_TEXT",
  "PROFIT_CTR",
  "CURRENCY",
  "REF_DOC_YR",
  "REF_DOC",
  "REF_DOC_IT",
  "CMMT_ITEM_LONG",
  "LINE_ID",
] as const;

const MIGO_NUMERIC_ITEM_KEYS = new Set<string>([
  "DOC_YEAR",
  "MATDOC_ITM",
  "S_ORD_ITEM",
  "SCHED_LINE",
  "ENTRY_QNT",
  "PO_PR_QNT",
  "PO_ITEM",
  "REF_DOC_YR",
  "REF_DOC_IT",
  "LINE_ID",
]);

type Row = Record<string, unknown>;

/** Case-insensitive lookup, ignoring underscores/spaces. */
function pick(src: Row | null | undefined, key: string): unknown {
  if (!src) return undefined;
  if (key in src) return src[key];
  const norm = (s: string) => s.replace(/[\s_]/g, "").toUpperCase();
  const want = norm(key);
  for (const k of Object.keys(src)) {
    if (norm(k) === want) return src[k];
  }
  return undefined;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function asNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function buildMigoHeader(
  header: Row | null | undefined,
  custom?: Row | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MIGO_HEADER_KEYS) {
    if (key === "POST") {
      out.POST = "X";
      continue;
    }
    if ((MIGO_CUSTOM_KEYS as readonly string[]).includes(key)) {
      const fromCustom = pick(custom, key);
      out[key] = asString(fromCustom !== undefined && fromCustom !== null ? fromCustom : pick(header, key));
      continue;
    }
    out[key] = asString(pick(header, key));
  }
  return out;
}

export function buildMigoItem(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MIGO_ITEM_KEYS) {
    const v = pick(row, key);
    out[key] = MIGO_NUMERIC_ITEM_KEYS.has(key) ? asNumber(v) : asString(v);
  }
  return out;
}

export function buildMigoPostPayload(
  header: Row | null | undefined,
  rows: Row[],
  custom?: Row | null,
): { HEADER: Record<string, unknown>; DATA: Record<string, unknown>[] } {
  return {
    HEADER: buildMigoHeader(header, custom),
    DATA: rows.map(buildMigoItem),
  };
}
