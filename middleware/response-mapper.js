function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object") return acc[key];
    return undefined;
  }, obj);
}

/**
 * Apply configured response-field aliases without destroying list-shaped SAP
 * responses. Fields written as [].FIELD describe an item in a collection; the
 * caller needs the original envelope/array so it can inspect every item.
 */
export function mapSapResponse(fields, raw) {
  if (!fields.length) return raw;

  const hasCollectionFields = fields.some((field) =>
    String(field.field_name ?? "").startsWith("[]."),
  );
  if (hasCollectionFields) return raw;

  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.DATA) || Array.isArray(raw.data) || Array.isArray(raw)) {
      return raw;
    }
  }

  const root = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const field of fields) {
    out[field.target_column ?? field.field_name] = getByPath(root, field.field_name);
  }
  return out;
}