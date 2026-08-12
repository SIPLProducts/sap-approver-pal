/** Deep, case-insensitive lookup of the first matching key in a SAP payload. */
export function findFirstDeep(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  const wanted = new Set(keys.map((k) => k.toUpperCase()));
  for (const [key, value] of Object.entries(obj)) {
    if (wanted.has(key.toUpperCase())) return value;
  }
  for (const value of Object.values(obj)) {
    const found = findFirstDeep(value, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Extract the exact SAP message text (MESSAGE, else MSGTXT) from a payload. */
export function extractSapMessage(payload: any): string | null {
  const raw = findFirstDeep(payload, ["MESSAGE", "MSGTXT"]);
  if (raw == null) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (Array.isArray(raw)) {
    const parts = raw
      .map((r) => (typeof r === "string" ? r : extractSapMessage(r)))
      .filter((s): s is string => !!s && !!s.trim());
    return parts.length ? parts.join("\n") : null;
  }
  if (typeof raw === "object") return extractSapMessage(raw);
  return String(raw).trim() || null;
}
