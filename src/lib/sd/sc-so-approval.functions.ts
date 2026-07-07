/**
 * Service Certificate & SO Approvals — live SAP fetch.
 * Switches between two SAP API configs based on approval_type:
 *   - service → "Sevice_Certificate_Fetch"
 *   - sales   → "Service_SO_Approval_Fetch"
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ScSoRow = {
  select: string | null;
  company_code: string | null;
  sales_org: string | null;
  customer: string | null;
  customer_name: string | null;
  year: string | number | null;
  contract_no: string | null;
  contract_item: string | number | null;
  contract_ref_no: string | null;
  contract_ref_date: string | null;
  con_creation_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  down_pay_req_amount: string | number | null;
  adv_doc_zeile: string | number | null;
  adv_doc_ebelp: string | number | null;
  adv_amount: string | number | null;
  profit_center: string | null;
  clearing_document: string | null;
  customer_group: string | null;
  customer_price_group: string | null;
  service_valid_from: string | null;
  service_valid_to: string | null;
  service_start_date: string | null;
  registration_date: string | null;
  cus_agr_from: string | null;
  cus_agr_to: string | null;
  active_inactive: string | null;
  no_of_beds_to_be_inv: string | number | null;
  fixed_rate: string | number | null;
  per_bed_rate: string | number | null;
  excess_qty_rate: string | number | null;
  upper_slab_qty: string | number | null;
  code_land_qty: string | number | null;
  total_balance: string | number | null;
  ph_reason_code: string | null;
  reason: string | null;
};

function pick(o: any, k: string) {
  if (!o || typeof o !== "object") return null;
  const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit ? (o[hit] ?? null) : null;
}

function mapRow(raw: any): ScSoRow {
  const adv = pick(raw, "ADV_DOC_NUM");
  return {
    select: pick(raw, "SELECT"),
    company_code: pick(raw, "COMPANY_CODE"),
    sales_org: pick(raw, "SALES_ORG"),
    customer: pick(raw, "CUSTOMER"),
    customer_name: pick(raw, "CUSTOMER_NAME"),
    year: pick(raw, "YEAR"),
    contract_no: pick(raw, "CONTRACT_NO"),
    contract_item: pick(raw, "CONTRACT_ITEM"),
    contract_ref_no: pick(raw, "CONTRACT_REF_NO"),
    contract_ref_date: pick(raw, "CONTRACT_REF_DATE"),
    con_creation_date: pick(raw, "CON_CREATION_DATE"),
    contract_start_date: pick(raw, "CONTRACT_START_DATE"),
    contract_end_date: pick(raw, "CONTRACT_END_DATE"),
    down_pay_req_amount: pick(raw, "DOWN_PAY_REQ_AMOUNT"),
    adv_doc_zeile: adv && typeof adv === "object" ? pick(adv, "ZEILE") : null,
    adv_doc_ebelp: adv && typeof adv === "object" ? pick(adv, "EBELP") : null,
    adv_amount: pick(raw, "ADV_AMOUNT"),
    profit_center: pick(raw, "PROFIT_CENTER"),
    clearing_document: pick(raw, "CLEARING_DOCUMENT"),
    customer_group: pick(raw, "CUSTOMER_GROUP"),
    customer_price_group: pick(raw, "CUSTOMER_PRICE_GROUP"),
    service_valid_from: pick(raw, "SERVICE_VALID_FROM"),
    service_valid_to: pick(raw, "SERVICE_VALID_TO"),
    service_start_date: pick(raw, "SERVICE_START_DATE"),
    registration_date: pick(raw, "REGISTRATION_DATE"),
    cus_agr_from: pick(raw, "CUS_AGR_FROM"),
    cus_agr_to: pick(raw, "CUS_AGR_TO"),
    active_inactive: pick(raw, "ACTIVE_INACTIVE"),
    no_of_beds_to_be_inv: pick(raw, "NO_OF_BEDS_TO_BE_INV"),
    fixed_rate: pick(raw, "FIXED_RATE"),
    per_bed_rate: pick(raw, "PER_BED_RATE"),
    excess_qty_rate: pick(raw, "EXCESS_QTY_RATE"),
    upper_slab_qty: pick(raw, "UPPER_SLAB_QTY"),
    code_land_qty: pick(raw, "CODE_LAND_QTY"),
    total_balance: pick(raw, "TOTAL_BALANCE"),
    ph_reason_code: pick(raw, "PH_REASON_CODE"),
    reason: pick(raw, "REASON"),
  };
}

export const fetchScSoApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      plants: z.array(z.string().trim().min(1).max(40)).min(1, "At least one plant required"),
      user_id: z.string().trim().max(40).optional(),
      customer_from: z.string().trim().max(40).optional(),
      customer_to: z.string().trim().max(40).optional(),
      status: z.enum(["pending", "accepted", "rejected", "all"]).default("pending"),
      approval_type: z.enum(["service", "sales", "all"]).default("service"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const CONFIG_NAME = "Sevice_Certificate_Fetch";

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: prof }, { data: userIdField }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("sap_api_request_fields")
        .select("default_value")
        .eq("config_id", cfg.id)
        .eq("field_name", "USER_ID")
        .maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const custFrom = (data.customer_from ?? "").trim();
    const custTo = (data.customer_to ?? "").trim() || custFrom;

    const resolvedUserId =
      (data.user_id && data.user_id.trim()) ||
      (prof?.sap_user_id && prof.sap_user_id.trim()) ||
      (userIdField?.default_value as string | null) ||
      "";

    const isAllStatus = data.status === "all";
    const isAllType = data.approval_type === "all";
    const inputs = {
      PLANT: data.plants.map((p) => ({ plant: p })),
      CUSTOMER_FROM: custFrom,
      CUSTOMER_TO: custTo,
      USER_ID: resolvedUserId,
      R_PEND: isAllStatus || data.status === "pending" ? "X" : "",
      R_ACCP: isAllStatus || data.status === "accepted" ? "X" : "",
      R_REJ: isAllStatus || data.status === "rejected" ? "X" : "",
      service: isAllType || data.approval_type === "service" ? "X" : "",
      Sales: isAllType || data.approval_type === "sales" ? "X" : "",
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "POST";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/service_certificate/Fetch`;
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
      target = cfg.endpoint_url.trim();
      headers["Content-Type"] = "application/json";
      if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
        headers.Authorization =
          "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
      }
      bodyOut = JSON.stringify(inputs);
    }

    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      headers[k] = v;
    }

    console.log("[scso-fetch] target=", target, "method=", method, "proxied=", proxied);
    console.log("[scso-fetch] payload=", JSON.stringify(inputs));

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(target, { method, headers, body: bodyOut });
    } catch (e) {

      const errMsg = (e as Error).message || "fetch failed";
      const latency_ms = Date.now() - t0;
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `scso-fetch network: ${errMsg}`,
      });
      console.log("[scso-fetch] network-error=", errMsg, "latency_ms=", latency_ms);
      return {
        rows: [] as ScSoRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Could not reach SAP. ${errMsg}.`,
        payload: inputs,
        debug: { target, method, proxied, request_payload: inputs, response_status: 0, response_body_preview: errMsg, latency_ms },
      };
    }

    const text = await res.text().catch(() => "");
    const message = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    console.log("[scso-fetch] status=", res.status, "latency_ms=", latency_ms, "body=", text.slice(0, 1000));

    const debug = {
      target,
      method,
      proxied,
      request_payload: inputs,
      response_status: res.status,
      response_body_preview: text.slice(0, 2000),
      latency_ms,
    };

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `scso-fetch: ${message} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as ScSoRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP returned ${message}: ${text.slice(0, 200)}`,
        payload: inputs,
        debug,
      };
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        rows: [] as ScSoRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Invalid JSON from SAP: ${text.slice(0, 200)}`,
        payload: inputs,
        debug,
      };
    }

    const sapJson: any = proxied ? (json?.data ?? json) : json;

    // Middleware surfaces unparseable SAP bodies as { __parse_error, __raw_preview }.
    if (sapJson && typeof sapJson === "object" && sapJson.__parse_error) {
      return {
        rows: [] as ScSoRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP returned unparseable JSON: ${sapJson.__parse_error}. Preview: ${String(sapJson.__raw_preview ?? "").slice(0, 200)}`,
        payload: inputs,
        debug,
      };
    }

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
      message: `scso-fetch: ${message}`,
    });

    return {
      rows,
      fetched_at: new Date().toISOString(),
      count: rows.length,
      error: null as string | null,
      payload: inputs,
      debug,
    };
  });

// ============================================================================
// Approve / Reject submit — Service_Certificate_Approve_Reject
// ============================================================================

const DECISION_CONFIG_NAME = "Service_Certificate_Approve_Reject";

function s(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}
function padCustomer(v: string | number | null | undefined): string {
  const x = s(v).trim();
  return x && /^\d+$/.test(x) ? x.padStart(10, "0") : x;
}
function numOrEmpty(v: string | number | null | undefined): number | "" {
  if (v == null || v === "") return "";
  const n = Number(v);
  return isFinite(n) ? n : "";
}

const ScSoRowSchema = z.object({
  select: z.string().nullable().optional(),
  company_code: z.string().nullable().optional(),
  sales_org: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  year: z.union([z.string(), z.number()]).nullable().optional(),
  contract_no: z.string().nullable().optional(),
  contract_item: z.union([z.string(), z.number()]).nullable().optional(),
  contract_ref_no: z.string().nullable().optional(),
  contract_ref_date: z.string().nullable().optional(),
  con_creation_date: z.string().nullable().optional(),
  contract_start_date: z.string().nullable().optional(),
  contract_end_date: z.string().nullable().optional(),
  down_pay_req_amount: z.union([z.string(), z.number()]).nullable().optional(),
  adv_doc_zeile: z.union([z.string(), z.number()]).nullable().optional(),
  adv_doc_ebelp: z.union([z.string(), z.number()]).nullable().optional(),
  adv_amount: z.union([z.string(), z.number()]).nullable().optional(),
  profit_center: z.string().nullable().optional(),
  clearing_document: z.string().nullable().optional(),
  customer_group: z.string().nullable().optional(),
  customer_price_group: z.string().nullable().optional(),
  service_valid_from: z.string().nullable().optional(),
  service_valid_to: z.string().nullable().optional(),
  service_start_date: z.string().nullable().optional(),
  registration_date: z.string().nullable().optional(),
  cus_agr_from: z.string().nullable().optional(),
  cus_agr_to: z.string().nullable().optional(),
  active_inactive: z.string().nullable().optional(),
  no_of_beds_to_be_inv: z.union([z.string(), z.number()]).nullable().optional(),
  fixed_rate: z.union([z.string(), z.number()]).nullable().optional(),
  per_bed_rate: z.union([z.string(), z.number()]).nullable().optional(),
  excess_qty_rate: z.union([z.string(), z.number()]).nullable().optional(),
  upper_slab_qty: z.union([z.string(), z.number()]).nullable().optional(),
  code_land_qty: z.union([z.string(), z.number()]).nullable().optional(),
  total_balance: z.union([z.string(), z.number()]).nullable().optional(),
  ph_reason_code: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

function toSapScSoRow(r: z.infer<typeof ScSoRowSchema>) {
  return {
    SELECT: "X",
    COMPANY_CODE: s(r.company_code),
    SALES_ORG: s(r.sales_org),
    CUSTOMER: padCustomer(r.customer),
    CUSTOMER_NAME: s(r.customer_name),
    YEAR: numOrEmpty(r.year),
    CONTRACT_NO: s(r.contract_no),
    CONTRACT_ITEM: numOrEmpty(r.contract_item),
    CONTRACT_REF_NO: s(r.contract_ref_no),
    CONTRACT_REF_DATE: s(r.contract_ref_date),
    CON_CREATION_DATE: s(r.con_creation_date),
    CONTRACT_START_DATE: s(r.contract_start_date),
    CONTRACT_END_DATE: s(r.contract_end_date),
    DOWN_PAY_REQ_AMOUNT: numOrEmpty(r.down_pay_req_amount),
    ADV_DOC_NUM: {
      ZEILE: numOrEmpty(r.adv_doc_zeile),
      EBELP: numOrEmpty(r.adv_doc_ebelp),
    },
    ADV_AMOUNT: numOrEmpty(r.adv_amount),
    PROFIT_CENTER: s(r.profit_center),
    CLEARING_DOCUMENT: s(r.clearing_document),
    CUSTOMER_GROUP: s(r.customer_group),
    CUSTOMER_PRICE_GROUP: s(r.customer_price_group),
    SERVICE_VALID_FROM: s(r.service_valid_from),
    SERVICE_VALID_TO: s(r.service_valid_to),
    SERVICE_START_DATE: s(r.service_start_date),
    REGISTRATION_DATE: s(r.registration_date),
    CUS_AGR_FROM: s(r.cus_agr_from),
    CUS_AGR_TO: s(r.cus_agr_to),
    ACTIVE_INACTIVE: s(r.active_inactive),
    NO_OF_BEDS_TO_BE_INV: numOrEmpty(r.no_of_beds_to_be_inv),
    FIXED_RATE: numOrEmpty(r.fixed_rate),
    PER_BED_RATE: numOrEmpty(r.per_bed_rate),
    EXCESS_QTY_RATE: numOrEmpty(r.excess_qty_rate),
    UPPER_SLAB_QTY: numOrEmpty(r.upper_slab_qty),
    CODE_LAND_QTY: numOrEmpty(r.code_land_qty),
    TOTAL_BALANCE: numOrEmpty(r.total_balance),
    PH_REASON_CODE: s(r.ph_reason_code),
    REASON: s(r.reason),
  };
}

export const submitScSoDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      action: z.enum(["accepted", "rejected"]),
      user_id: z.string().trim().max(40).optional(),
      approval_type: z.enum(["service", "sales"]).default("service"),
      rows: z.array(ScSoRowSchema).min(1, "Select at least one row"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", DECISION_CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${DECISION_CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${DECISION_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: prof }, { data: userIdField }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("sap_api_request_fields")
        .select("default_value")
        .eq("config_id", cfg.id)
        .eq("field_name", "USER_ID")
        .maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const resolvedUserId =
      (data.user_id && data.user_id.trim()) ||
      (prof?.sap_user_id && prof.sap_user_id.trim()) ||
      (userIdField?.default_value as string | null) ||
      "NEOBMWCONS";

    const sapPayload = {
      APPROV: data.action === "accepted" ? "X" : "",
      REJ: data.action === "rejected" ? "X" : "",
      USER_ID: resolvedUserId,
      DATA: data.rows.map(toSapScSoRow),
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "POST";
    let bodyOut: string;
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/service_certificate/Service_Certificate_Approve_Reject`;
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

    const redacted = (h: Record<string, string>) => {
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(h)) {
        if (/^(authorization|x-shared-secret)$/i.test(k)) o[k] = "***redacted***";
        else o[k] = v;
      }
      return o;
    };

    const t0 = Date.now();
    console.log("[submitScSoDecision] target=", target, "method=", method, "proxied=", proxied, "payload=", sapPayload);
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
      const latency_ms = Date.now() - t0;
      console.error("[submitScSoDecision] network error", errMsg);
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `scso-decision ${data.action}: network ${errMsg}`,
      });
      return {
        ok: false as const,
        action: data.action,
        count: data.rows.length,
        error: `Could not reach SAP: ${errMsg}`,
        sap_response: null,
        debug: {
          target, method, proxied,
          request_headers: redacted(headers),
          request_payload: sapPayload,
          response_status: null as number | null,
          response_body_preview: "",
          latency_ms,
        },
      };
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;
    console.log("[submitScSoDecision] status=", res.status, "latency_ms=", latency_ms, "body=", text.slice(0, 1000));

    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!res.ok) {
      let upstream = "";
      try {
        if (json?.error) upstream = String(json.error);
        else if (json?.data) upstream = typeof json.data === "string" ? json.data : JSON.stringify(json.data);
      } catch { /* ignore */ }
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `scso-decision ${data.action}: ${res.status} ${text.slice(0, 500)}`,
      });
      return {
        ok: false as const,
        action: data.action,
        count: data.rows.length,
        error: `SAP returned ${res.status} ${res.statusText}: ${upstream || text.slice(0, 300) || "(empty body)"}`,
        sap_response: json,
        debug: {
          target, method, proxied,
          request_headers: redacted(headers),
          request_payload: sapPayload,
          response_status: res.status,
          response_body_preview: text.slice(0, 4000),
          latency_ms,
        },
      };
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: data.rows.length,
      message: `scso-decision ${data.action}: ${res.status}`,
    });

    return {
      ok: true as const,
      action: data.action,
      count: data.rows.length,
      error: null as string | null,
      sap_response: json,
      debug: {
        target, method, proxied,
        request_headers: redacted(headers),
        request_payload: sapPayload,
        response_status: res.status,
        response_body_preview: text.slice(0, 4000),
        latency_ms,
      },
    };
  });
