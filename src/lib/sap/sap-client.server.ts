/**
 * Real SAP Gateway REST client (server-only).
 *
 * Behind a feature flag: SAP_USE_REAL === "true". When off, callers fall back
 * to the mock generator in sap.functions.ts.
 *
 * Auth: HTTP Basic with a technical user. SAP CSRF token is fetched once per
 * call chain and re-used for the POST.
 *
 * Endpoint convention (custom Z REST wrapper):
 *   GET  {SAP_BASE_URL}/api/approvals?doc_type=&since=  -> { items: [...] }
 *   POST {SAP_BASE_URL}/api/approvals/{sap_doc_no}/decision
 *        body: { action, comments, role, step_seq, actor_sap_id }
 */

type FetchOpts = { method?: "GET" | "POST"; body?: unknown; csrfToken?: string };

function basicAuth() {
  const u = process.env.SAP_USER;
  const p = process.env.SAP_PASSWORD;
  if (!u || !p) throw new Error("SAP credentials not configured");
  return "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
}

export function sapEnabled() {
  return process.env.SAP_USE_REAL === "true" && !!process.env.SAP_BASE_URL;
}

async function sapFetch(path: string, opts: FetchOpts = {}) {
  const base = process.env.SAP_BASE_URL!.replace(/\/$/, "");
  const headers: Record<string, string> = {
    Authorization: basicAuth(),
    Accept: "application/json",
  };
  if (opts.method === "POST") {
    headers["Content-Type"] = "application/json";
    headers["x-csrf-token"] = opts.csrfToken ?? "fetch";
  }
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res;
}

/** Fetch a fresh CSRF token (SAP convention). */
export async function fetchCsrfToken(): Promise<string> {
  const base = process.env.SAP_BASE_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/api/csrf`, {
    method: "GET",
    headers: { Authorization: basicAuth(), "x-csrf-token": "fetch" },
  });
  return res.headers.get("x-csrf-token") ?? "";
}

export type SapApprovalItem = {
  module: "MM" | "SD";
  doc_type: string;
  sap_t_code: string;
  sap_doc_no: string;
  title: string;
  description?: string | null;
  plant?: string | null;
  business_unit?: string | null;
  company_code?: string | null;
  vendor_name?: string | null;
  customer_name?: string | null;
  requester_name: string;
  requester_sap_id?: string | null;
  total_value: number;
  currency: string;
  document_date: string;
  steps: Array<{ seq: number; role: string }>;
  lines: Array<{
    line_no: number;
    material_code?: string | null;
    description: string;
    quantity: number;
    uom?: string | null;
    unit_price?: number | null;
    amount?: number | null;
  }>;
};

export async function fetchOpenApprovals(docType?: string, sinceIso?: string): Promise<SapApprovalItem[]> {
  const qs = new URLSearchParams();
  if (docType) qs.set("doc_type", docType);
  if (sinceIso) qs.set("since", sinceIso);
  const res = await sapFetch(`/api/approvals?${qs.toString()}`);
  if (!res.ok) {
    console.error("SAP fetchOpenApprovals failed", res.status, await res.text().catch(() => ""));
    return [];
  }
  const json = (await res.json()) as { items?: SapApprovalItem[] };
  return json.items ?? [];
}

export async function postDecision(input: {
  sapDocNo: string;
  action: "approve" | "reject" | "send_back";
  comments?: string | null;
  role: string;
  stepSeq: number;
  actorSapId?: string | null;
}) {
  const csrf = await fetchCsrfToken();
  const res = await sapFetch(`/api/approvals/${encodeURIComponent(input.sapDocNo)}/decision`, {
    method: "POST",
    csrfToken: csrf,
    body: {
      action: input.action,
      comments: input.comments ?? "",
      role: input.role,
      step_seq: input.stepSeq,
      actor_sap_id: input.actorSapId ?? "",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SAP decision rejected: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}
