/**
 * Resolve a configured SAP endpoint URL against the global SAP Base URL.
 *
 * - If `endpoint` already starts with http(s):// it is returned unchanged
 *   (legacy full URLs keep working).
 * - Otherwise, the endpoint is treated as a path/query suffix and joined to
 *   `baseUrl` (e.g. `http://10.150.150.155:8005`).
 */
export function resolveSapUrl(endpoint: string | null | undefined, baseUrl: string | null | undefined): string {
  const ep = (endpoint ?? "").trim();
  if (!ep) throw new Error("Endpoint URL is empty");
  if (/^https?:\/\//i.test(ep)) return ep;
  const base = (baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "SAP Base URL is not configured. Set it in SAP API Settings → SAP Connection, " +
        "or use a full http(s):// URL on this endpoint.",
    );
  }
  return `${base}${ep.startsWith("/") ? "" : "/"}${ep}`;
}
