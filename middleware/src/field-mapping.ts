import type { FieldRow, ResponseFieldRow } from "./config-loader.js";

/**
 * Resolve a request field's value based on its source.
 *   static  -> default_value
 *   column  -> inputs[field_name] ?? default_value
 *   expr    -> tiny templater: ${input.x}, today(), now()
 *   secret  -> process.env[default_value]
 */
export function resolveRequestField(field: FieldRow, inputs: Record<string, unknown>): unknown {
  switch (field.source) {
    case "static":
      return field.default_value ?? null;
    case "column":
      return inputs[field.field_name] ?? field.default_value ?? null;
    case "secret":
      return field.default_value ? process.env[field.default_value] ?? null : null;
    case "expr":
      return evalExpr(field.default_value ?? "", inputs);
    default:
      return null;
  }
}

function evalExpr(expr: string, inputs: Record<string, unknown>): string {
  let out = expr;
  out = out.replace(/today\(\)/g, new Date().toISOString().slice(0, 10));
  out = out.replace(/now\(\)/g, new Date().toISOString());
  out = out.replace(/\$\{input\.([a-zA-Z0-9_]+)\}/g, (_, k) => {
    const v = inputs[k];
    return v == null ? "" : String(v);
  });
  return out;
}

export function buildRequestPayload(fields: FieldRow[], inputs: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const f of fields) {
    const value = resolveRequestField(f, inputs);
    if (f.required && (value === null || value === undefined || value === "")) {
      missing.push(f.field_name);
    }
    payload[f.field_name] = value;
  }
  if (missing.length) throw new Error(`Missing required field(s): ${missing.join(", ")}`);
  return payload;
}

/**
 * Reduce a raw SAP response into the mapped shape the frontend asked for.
 * If no response fields are configured, the raw response is returned as-is.
 */
export function mapResponse(fields: ResponseFieldRow[], raw: unknown): unknown {
  if (!fields.length) return raw;
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    out[f.target_column ?? f.field_name] = getByPath(root, f.field_name);
  }
  return out;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}
