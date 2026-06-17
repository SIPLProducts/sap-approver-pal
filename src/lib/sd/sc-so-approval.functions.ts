/**
 * Service Certificate & SO Approvals — live SAP fetch.
 * Mirrors sales-order-approval.functions.ts but uses the combined
 * Service Certificate / Sales Order approval endpoint and adds
 * `service` / `Sales` toggles to the payload.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ScSoRow = {
  company_code: string | null;
  sales_org: string | null;
  customer: string | null;
  customer_name: string | null;
  year: string | number | null;
  contract_no: string | null;
  contract_item: string | number | null;
  contract_ref_no: string | null;
  contract_ref_date: string | null;
  creation_date: string | null;
  contract_start: string | null;
  contract_end: string | null;
  down_pay_req: string | number | null;
  adv_amount: string | number | null;
  net_value: string | number | null;
  reason: string | null;
  raw: Record<string, unknown>;
};

const CONFIG_NAME = "Service_SO_Approval_Fetch";

function pick(o: any, k: string) {
  if (!o || typeof o !== "object") return null;
  const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit ? (o[hit] ?? null) : null;
}

function mapRow(raw: any): ScSoRow {
  return {
    company_code: pick(raw, "COMPANY_CODE"),
    sales_org: pick(raw, "SALES_ORG"),
    customer: pick(raw, "CUSTOMER"),
    customer_name: pick(raw, "CUSTOMER_NAME"),
    year: pick(raw, "YEAR"),
    contract_no: pick(raw, "CONTRACT_NO"),
    contract_item: pick(raw, "CONTRACT_ITEM"),
    contract_ref_no: pick(raw, "CONTRACT_REF_NO"),
    contract_ref_date: pick(raw, "CONTRACT_REF_DATE"),
    creation_date: pick(raw, "CREATION_DATE") ?? pick(raw, "CRE_DATE"),
    contract_start: pick(raw, "CONTRACT_START") ?? pick(raw, "CUS_AGR_FROM"),
    contract_end: pick(raw, "CONTRACT_END") ?? pick(raw, "CUS_AGR_TO"),
    down_pay_req: pick(raw, "DOWN_PAY_REQ"),
    adv_amount: pick(raw, "ADV_AMOUNT"),
    net_value: pick(raw, "NET_VALUE") ?? pick(raw, "FIXED_RATE"),
    reason: pick(raw, "REASON"),
    raw: raw && typeof raw === "object" ? raw : {},
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
      target = `${middlewareUrl.replace(/\/$/, "")}/service_so_approval/Fetch`;
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
        message: `scso-fetch network: ${errMsg}`,
      });
      return {
        rows: [] as ScSoRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Could not reach SAP. ${errMsg}.`,
        payload: inputs,
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
        message: `scso-fetch: ${message} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as ScSoRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP returned ${message}: ${text.slice(0, 200)}`,
        payload: inputs,
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
    };
  });
