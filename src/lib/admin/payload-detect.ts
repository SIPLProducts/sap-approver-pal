/**
 * Client-only helpers for the SAP API payload import / autodetect feature.
 * Pure functions — no React, no I/O — so they are easy to test.
 */

export type InferredType = "string" | "number" | "boolean" | "date" | "null" | "array";

export type DetectedField = {
  path: string;
  sampleValue: unknown;
  inferredType: InferredType;
};

const MAX_FIELDS = 500;
const MAX_DEPTH = 8;
export const MAX_PAYLOAD_BYTES = 1_000_000;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function inferType(v: unknown): InferredType {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "string") return ISO_DATE_RE.test(v) ? "date" : "string";
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "boolean";
  return "string";
}

export function flattenPayload(input: unknown): DetectedField[] {
  const out: DetectedField[] = [];

  function walk(value: unknown, path: string, depth: number): void {
    if (out.length >= MAX_FIELDS || depth > MAX_DEPTH) return;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0 && path) {
        out.push({ path, sampleValue: {}, inferredType: "string" });
        return;
      }
      for (const [k, v] of entries) {
        if (out.length >= MAX_FIELDS) break;
        walk(v, path ? `${path}.${k}` : k, depth + 1);
      }
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        if (path) out.push({ path: `${path}[]`, sampleValue: [], inferredType: "array" });
        return;
      }
      const first = value[0];
      if (first !== null && typeof first === "object") {
        walk(first, `${path}[]`, depth + 1);
      } else {
        out.push({ path: `${path}[]`, sampleValue: first, inferredType: inferType(first) });
      }
      return;
    }

    if (path) out.push({ path, sampleValue: value, inferredType: inferType(value) });
  }

  walk(input, "", 0);
  return out;
}

function sanitizeLooseJson(text: string): string {
  let s = text;
  // strip /* block */ and // line comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/(^|[^:"])\/\/[^\n\r]*/g, "$1");
  // fill empty values after a colon: `"k": ,` -> `"k": null,` and `"k": }` -> `"k": null}`
  s = s.replace(/:(\s*)(,|\}|\])/g, ": null$1$2");
  // strip trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

export function parsePayloadText(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (text.length > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: `Payload exceeds ${Math.round(MAX_PAYLOAD_BYTES / 1000)} KB limit` };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const originalError = (e as Error).message;
    try {
      return { ok: true, value: JSON.parse(sanitizeLooseJson(text)) };
    } catch {
      return { ok: false, error: originalError };
    }
  }
}

function leafColumn(path: string): string {
  const leaf = path.split(/[.[]/).filter(Boolean).pop() ?? path;
  return leaf
    .replace(/\]$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export type ReqRow = {
  field_name: string;
  source: "static" | "column" | "expr" | "secret";
  default_value: string;
  required: boolean;
  sort_order: number;
};

export type ResRow = {
  field_name: string;
  target_table: string;
  target_column: string;
  transform_expr: string;
  sort_order: number;
};

export function toReqRows(fields: DetectedField[], startIndex = 0): ReqRow[] {
  return fields.map((f, i) => ({
    field_name: f.path,
    source: "static",
    default_value: f.sampleValue === null || f.sampleValue === undefined ? "" : String(f.sampleValue),
    required: false,
    sort_order: startIndex + i,
  }));
}

export function toResRows(fields: DetectedField[], startIndex = 0): ResRow[] {
  return fields.map((f, i) => ({
    field_name: f.path,
    target_table: "",
    target_column: leafColumn(f.path),
    transform_expr: "",
    sort_order: startIndex + i,
  }));
}

export type MergeMode = "replace" | "append";

export function mergeRows<T extends { field_name: string; sort_order: number }>(
  existing: T[],
  incoming: T[],
  mode: MergeMode,
): T[] {
  if (mode === "replace") return incoming.map((r, i) => ({ ...r, sort_order: i }));
  const seen = new Set(existing.map((r) => r.field_name));
  const additions = incoming.filter((r) => !seen.has(r.field_name));
  return [...existing, ...additions].map((r, i) => ({ ...r, sort_order: i }));
}
