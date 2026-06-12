/**
 * SD Contract Approvals — live SAP fetch via Contract_Approval_Fetch API.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ContractRow = {
  select: string | null;
  company_code: string | null;
  sales_org: string | null;
  customer: string | null;
  customer_name: string | null;
  year: string | null;
  contract_no: string | null;
  contract_item: string | null;
  con_creation_date: string | null;
  dis_chanel: string | null;
  division: string | null;
  material: string | null;
  qty: string | number | null;
  customer_group: string | null;
  customer_price_group: string | null;
  net_value: string | number | null;
  tax_value: string | number | null;
  total: string | number | null;
  agreement_from: string | null;
  agreement_to: string | null;
  service_valid_from: string | null;
  service_valid_to: string | null;
  service_start_date: string | null;
  registration_date: string | null;
  upper_slab: string | null;
  no_of_beds_to_be_inv: string | number | null;
  fixed_rate: string | number | null;
  per_bed_rate: string | number | null;
  excess_qty_rate: string | number | null;
  reason: string | null;
};

const CONFIG_NAME = "Contract_Approval_Fetch";

function pick(o: any, k: string) {
  if (!o || typeof o !== "object") return null;
  const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit ? (o[hit] ?? null) : null;
}

function mapRow(raw: any): ContractRow {
  return {
    select: pick(raw, "SELECT"),
    company_code: pick(raw, "COMPANY_CODE"),
    sales_org: pick(raw, "SALES_ORG"),
    customer: pick(raw, "CUSTOMER"),
    customer_name: pick(raw, "CUSTOMER_NAME"),
    year: pick(raw, "YEAR"),
    contract_no: pick(raw, "CONTRACT_NO"),
    contract_item: pick(raw, "CONTRACT_ITEM"),
    con_creation_date: pick(raw, "CON_CREATION_DATE"),
    dis_chanel: pick(raw, "DIS_CHANEL"),
    division: pick(raw, "DIVISION"),
    material: pick(raw, "MATERIAL"),
    qty: pick(raw, "QTY"),
    customer_group: pick(raw, "CUSTOMER_GROUP"),
    customer_price_group: pick(raw, "CUSTOMER_PRICE_GROUP"),
    net_value: pick(raw, "NET_VALUE"),
    tax_value: pick(raw, "TAX_VALUE"),
    total: pick(raw, "TOTAL"),
    agreement_from: pick(raw, "AGREEMENT_FROM"),
    agreement_to: pick(raw, "AGREEMENT_TO"),
    service_valid_from: pick(raw, "SERVICE_VALID_FROM"),
    service_valid_to: pick(raw, "SERVICE_VALID_TO"),
    service_start_date: pick(raw, "SERVICE_START_DATE"),
    registration_date: pick(raw, "REGISTRATION_DATE"),
    upper_slab: pick(raw, "UPPER_SLAB"),
    no_of_beds_to_be_inv: pick(raw, "NO_OF_BEDS_TO_BE_INV"),
    fixed_rate: pick(raw, "FIXED_RATE"),
    per_bed_rate: pick(raw, "PER_BED_RATE"),
    excess_qty_rate: pick(raw, "EXCESS_QTY_RATE"),
    reason: pick(raw, "REASON"),
  };
}

export const fetchContractApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      plant: z.string().trim().min(1, "Plant is required").max(40),
      user_id: z.string().trim().max(40).optional(),
      customer_from: z.string().trim().max(40).optional(),
      customer_to: z.string().trim().max(40).optional(),
      status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const userId = (data.user_id ?? "").trim();
    const R_PEND = data.status === "pending" ? "X" : "";
    const R_ACCP = data.status === "accepted" ? "X" : "";
    const R_REJ = data.status === "rejected" ? "X" : "";

    const custFrom = (data.customer_from ?? "").trim();
    const custTo = (data.customer_to ?? "").trim() || custFrom;

    const inputs = {
      PLANT: data.plant,
      CUSTOMER_FROM: custFrom,
      CUSTOMER_TO: custTo,
      USER_ID: userId,
      R_PEND,
      R_ACCP,
      R_REJ,
    };


    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url || cfg.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      (cfg.middleware_url && cfg.middleware_url.trim()) ||
      (globalSettings?.middleware_url?.trim() ?? null);

    let target: string;
    let method: string = cfg.http_method ?? "GET";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/contract_approval/Fetch`;
      method = "POST";
      headers["Content-Type"] = "application/json";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ inputs });
      proxied = true;
    } else {
      const join = cfg.endpoint_url.includes("?") ? "&" : "?";
      const qs =
        `${join}PLANT=${encodeURIComponent(inputs.PLANT)}` +
        `&CUSTOMER_FROM=${encodeURIComponent(inputs.CUSTOMER_FROM)}` +
        `&CUSTOMER_TO=${encodeURIComponent(inputs.CUSTOMER_TO)}` +
        `&USER_ID=${encodeURIComponent(inputs.USER_ID)}` +
        `&R_PEND=${encodeURIComponent(inputs.R_PEND)}` +
        `&R_ACCP=${encodeURIComponent(inputs.R_ACCP)}` +
        `&R_REJ=${encodeURIComponent(inputs.R_REJ)}`;
      target = cfg.endpoint_url + qs;
      if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
        headers.Authorization =
          "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
      }
    }

    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      headers[k] = v;
    }

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(target, { method, headers, body: bodyOut });
      if (proxied && res.status === 404) {
        const peek = await res.clone().text().catch(() => "");
        if (/Cannot\s+POST/i.test(peek)) {
          const fallback = `${middlewareUrl!.replace(/\/$/, "")}/sap/invoke`;
          res = await fetch(fallback, {
            method: "POST",
            headers,
            body: JSON.stringify({ configId: cfg.id, inputs }),
          });
          target = fallback;
        }
      }
    } catch (e) {
      const errMsg = (e as Error).message || "fetch failed";
      const latency_ms = Date.now() - t0;
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `contract-fetch network: ${errMsg}`,
      });
      return {
        rows: [] as ContractRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Could not reach SAP at ${cfg.endpoint_url.split("?")[0]}. ${errMsg}.`,
      };
    }

    const text = await res.text().catch(() => "");
    const message = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `contract-fetch: ${message} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as ContractRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP returned ${message}: ${text.slice(0, 200)}`,
      };
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        rows: [] as ContractRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Invalid JSON from SAP: ${text.slice(0, 200)}`,
      };
    }

    const sapJson: any = proxied ? (json?.data ?? {}) : json;
    const arr: any[] = Array.isArray(sapJson?.DATA)
      ? sapJson.DATA
      : Array.isArray(sapJson?.data)
        ? sapJson.data
        : Array.isArray(sapJson)
          ? sapJson
          : [];

    const rows = arr.map(mapRow);

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `contract-fetch: ${message}`,
    });

    return {
      rows,
      fetched_at: new Date().toISOString(),
      count: rows.length,
      error: null as string | null,
    };
  });

// ============================================================================
// Approve / Reject submit
// ============================================================================

const DECISION_CONFIG_NAME = "Contract_Approve_Reject";

function s(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}

function padCustomer(v: string | number | null | undefined): string {
  const x = s(v).trim();
  return x && /^\d+$/.test(x) ? x.padStart(10, "0") : x;
}

const ContractRowSchema = z.object({
  select: z.string().nullable().optional(),
  company_code: z.string().nullable().optional(),
  sales_org: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  contract_no: z.string().nullable().optional(),
  contract_item: z.string().nullable().optional(),
  con_creation_date: z.string().nullable().optional(),
  dis_chanel: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  qty: z.union([z.string(), z.number()]).nullable().optional(),
  customer_group: z.string().nullable().optional(),
  customer_price_group: z.string().nullable().optional(),
  net_value: z.union([z.string(), z.number()]).nullable().optional(),
  tax_value: z.union([z.string(), z.number()]).nullable().optional(),
  total: z.union([z.string(), z.number()]).nullable().optional(),
  agreement_from: z.string().nullable().optional(),
  agreement_to: z.string().nullable().optional(),
  service_valid_from: z.string().nullable().optional(),
  service_valid_to: z.string().nullable().optional(),
  service_start_date: z.string().nullable().optional(),
  registration_date: z.string().nullable().optional(),
  upper_slab: z.string().nullable().optional(),
  no_of_beds_to_be_inv: z.union([z.string(), z.number()]).nullable().optional(),
  fixed_rate: z.union([z.string(), z.number()]).nullable().optional(),
  per_bed_rate: z.union([z.string(), z.number()]).nullable().optional(),
  excess_qty_rate: z.union([z.string(), z.number()]).nullable().optional(),
  reason: z.string().nullable().optional(),
});

function toSapContractRow(r: z.infer<typeof ContractRowSchema>) {
  return {
    SELECT: "X",
    COMPANY_CODE: s(r.company_code),
    SALES_ORG: s(r.sales_org),
    CUSTOMER: padCustomer(r.customer),
    CUSTOMER_NAME: s(r.customer_name),
    YEAR: s(r.year),
    CONTRACT_NO: s(r.contract_no),
    CONTRACT_ITEM: s(r.contract_item),
    CON_CREATION_DATE: s(r.con_creation_date),
    DIS_CHANEL: s(r.dis_chanel),
    DIVISION: s(r.division),
    MATERIAL: s(r.material),
    QTY: s(r.qty),
    CUSTOMER_GROUP: s(r.customer_group),
    CUSTOMER_PRICE_GROUP: s(r.customer_price_group),
    NET_VALUE: s(r.net_value),
    TAX_VALUE: s(r.tax_value),
    TOTAL: s(r.total),
    AGREEMENT_FROM: s(r.agreement_from),
    AGREEMENT_TO: s(r.agreement_to),
    SERVICE_VALID_FROM: s(r.service_valid_from),
    SERVICE_VALID_TO: s(r.service_valid_to),
    SERVICE_START_DATE: s(r.service_start_date),
    REGISTRATION_DATE: s(r.registration_date),
    UPPER_SLAB: s(r.upper_slab),
    NO_OF_BEDS_TO_BE_INV: s(r.no_of_beds_to_be_inv),
    FIXED_RATE: s(r.fixed_rate),
    PER_BED_RATE: s(r.per_bed_rate),
    EXCESS_QTY_RATE: s(r.excess_qty_rate),
    REASON: s(r.reason),
  };
}

export const submitContractDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      action: z.enum(["accepted", "rejected"]),
      rows: z.array(ContractRowSchema).min(1, "Select at least one row"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", DECISION_CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${DECISION_CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${DECISION_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const sapPayload = {
      APPROV: data.action === "accepted" ? "X" : "",
      REJ: data.action === "rejected" ? "X" : "",
      DATA: data.rows.map(toSapContractRow),
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url || cfg.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      (cfg.middleware_url && cfg.middleware_url.trim()) ||
      (globalSettings?.middleware_url?.trim() ?? null);

    let target: string;
    let method: string = cfg.http_method ?? "PUT";
    let bodyOut: string;
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/contract_approval/Contract_Approve_Reject`;
      method = "POST";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ inputs: sapPayload });
      proxied = true;
    } else {
      target = cfg.endpoint_url.trim();
      if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
        headers.Authorization =
          "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
      }
      bodyOut = JSON.stringify(sapPayload);
    }

    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      headers[k] = v;
    }

    const t0 = Date.now();
    console.log("[submitContractDecision] target=", target, "method=", method, "proxied=", proxied, "payload=", sapPayload);
    let res: Response;
    try {
      res = await fetch(target, { method, headers, body: bodyOut });
      if (proxied && res.status === 404) {
        const peek = await res.clone().text().catch(() => "");
        if (/Cannot\s+(POST|PUT)/i.test(peek)) {
          const fallback = `${middlewareUrl!.replace(/\/$/, "")}/sap/invoke`;
          res = await fetch(fallback, {
            method: "POST",
            headers,
            body: JSON.stringify({ configId: cfg.id, inputs: sapPayload }),
          });
          target = fallback;
        }
      }
    } catch (e) {
      const errMsg = (e as Error).message || "fetch failed";
      console.error("[submitContractDecision] network error", errMsg);
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `contract-decision ${data.action}: network ${errMsg}`,
      });
      throw new Error(`Could not reach SAP: ${errMsg}`);
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;
    console.log("[submitContractDecision] status=", res.status, "latency_ms=", latency_ms, "body=", text.slice(0, 1000));

    if (!res.ok) {
      let upstream = "";
      try {
        const j = JSON.parse(text);
        if (j?.error) upstream = String(j.error);
        else if (j?.data) upstream = typeof j.data === "string" ? j.data : JSON.stringify(j.data);
      } catch { /* ignore */ }
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `contract-decision ${data.action}: ${res.status} ${text.slice(0, 500)}`,
      });
      throw new Error(`SAP returned ${res.status} ${res.statusText}: ${upstream || text.slice(0, 300)}`);
    }

    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: data.rows.length,
      message: `contract-decision ${data.action}: ${res.status}`,
    });

    return { ok: true, action: data.action, count: data.rows.length, sap_response: json };
  });

