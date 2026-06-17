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
      plant: z.string().trim().min(1, "Plant is required").max(40),
      user_id: z.string().trim().max(40).optional(),
      customer_from: z.string().trim().max(40).optional(),
      customer_to: z.string().trim().max(40).optional(),
      status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
      approval_type: z.enum(["service", "sales"]).default("service"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const CONFIG_NAME = "Sevice_Certificate_Fetch";

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

    const custFrom = (data.customer_from ?? "").trim();
    const custTo = (data.customer_to ?? "").trim() || custFrom;

    const inputs = {
      PLANT: data.plant,
      CUSTOMER_FROM: custFrom,
      CUSTOMER_TO: custTo,
      USER_ID: (data.user_id ?? "").trim(),
      R_PEND: data.status === "pending" ? "X" : "",
      R_ACCP: data.status === "accepted" ? "X" : "",
      R_REJ: data.status === "rejected" ? "X" : "",
      service: data.approval_type === "service" ? "X" : "",
      Sales: data.approval_type === "sales" ? "X" : "",
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url || cfg.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      (cfg.middleware_url && cfg.middleware_url.trim()) ||
      (globalSettings?.middleware_url?.trim() ?? null);

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
