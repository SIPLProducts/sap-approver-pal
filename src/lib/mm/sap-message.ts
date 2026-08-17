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

/**
 * Find an SAP failure envelope at any depth and return its exact MSGTXT.
 * Middleware responses commonly wrap the SAP object in data/GET or an array.
 */
export function extractFalseStatusMessage(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;

  if (!Array.isArray(payload)) {
    const entries = Object.entries(payload);
    const statusEntry = entries.find(([key]) => key.toUpperCase() === "STATUS");
    if (statusEntry && String(statusEntry[1] ?? "").trim().toUpperCase() === "FALSE") {
      const messageEntry = entries.find(([key]) => key.toUpperCase() === "MSGTXT");
      if (messageEntry) {
        const message = String(messageEntry[1] ?? "").trim();
        if (message) return message;
      }

      const nestedMessage = extractSapMessage(payload);
      return nestedMessage || "No data returned by SAP.";
    }
  }

  for (const value of Object.values(payload)) {
    const message = extractFalseStatusMessage(value);
    if (message) return message;
  }
  return null;
}

/**
 * Find a MESSAGES: [{ TYPE, MESSAGE }] array at any depth and return the exact
 * text of the first error/abort entry (TYPE "E" or "A").
 */
export function extractMessagesArrayError(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;

  if (!Array.isArray(payload)) {
    for (const [key, value] of Object.entries(payload)) {
      if (key.toUpperCase() === "MESSAGES" && Array.isArray(value)) {
        for (const entry of value) {
          const type = String((entry as any)?.TYPE ?? (entry as any)?.type ?? "")
            .trim()
            .toUpperCase();
          if (type === "E" || type === "A") {
            const text = extractSapMessage(entry);
            if (text) return text;
          }
        }
      }
    }
  }

  for (const value of Object.values(payload)) {
    const message = extractMessagesArrayError(value);
    if (message) return message;
  }
  return null;
}

/**
 * Collect every SAP message in a payload, in the order received, without
 * combining or rewording the text. Finds MESSAGES: [{ TYPE, MESSAGE }] arrays
 * at any depth, else falls back to a single TYPE/MESSAGE|MSGTXT envelope.
 */
export function collectSapMessages(
  payload: any,
): Array<{ type: string; message: string }> {
  const out: Array<{ type: string; message: string }> = [];

  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (!Array.isArray(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (key.toUpperCase() === "MESSAGES" && Array.isArray(value)) {
          for (const entry of value) {
            if (typeof entry === "string") {
              if (entry.trim()) out.push({ type: "", message: entry });
              continue;
            }
            const type = String((entry as any)?.TYPE ?? (entry as any)?.type ?? "");
            const text = String(
              (entry as any)?.MESSAGE ??
                (entry as any)?.message ??
                (entry as any)?.MSGTXT ??
                (entry as any)?.msgtxt ??
                "",
            );
            if (text.trim()) out.push({ type, message: text });
          }
        }
      }
    }
    for (const value of Object.values(node)) walk(value);
  };

  walk(payload);
  if (out.length > 0) return out;

  const single = extractSapMessage(payload);
  if (single) {
    const type = findFirstDeep(payload, ["TYPE"]);
    return [{ type: typeof type === "string" ? type : "", message: single }];
  }
  return [];
}
