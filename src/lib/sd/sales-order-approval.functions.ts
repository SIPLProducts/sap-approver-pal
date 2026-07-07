/**
 * SD Sales Order Approvals — live SAP fetch via Sales_Approval_Fetch API
 * and submit via Sales_Order_Approve_Reject API. Mirrors contract-approval.functions.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SalesOrderRow = {
  select: string | null;
  company_code: string | null;
  sales_org: string | null;
  dis_chanel: string | null;
  division: string | null;
  customer: string | null;
  customer_name: string | null;
  customer_group: string | null;
  customer_price_group: string | null;
  year: string | null;
  contract_no: string | null;
  contract_item: string | number | null;
  sales_document_no: string | null;
  so_creation_date: string | null;
  sales_item_no: string | number | null;
  material: string | null;
  qty: string | number | null;
  net_value: string | number | null;
  tax_value: string | number | null;
  reason: string | null;
  rel_1: string | null;
  status_1: string | null;
  rel_2: string | null;
  status_2: string | null;
};

const CONFIG_NAME = "Sales_Approval_Fetch";
const DECISION_CONFIG_NAME = "Sales_Order_Approve_Reject";

function pick(o: any, k: string) {
  if (!o || typeof o !== "object") return null;
  const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit ? (o[hit] ?? null) : null;
}

function mapRow(raw: any): SalesOrderRow {
  return {
    select: pick(raw, "SELECT"),
    company_code: pick(raw, "COMPANY_CODE"),
    sales_org: pick(raw, "SALES_ORG"),
    dis_chanel: pick(raw, "DIS_CHANEL"),
    division: pick(raw, "DIVISION"),
    customer: pick(raw, "CUSTOMER"),
    customer_name: pick(raw, "CUSTOMER_NAME"),
    customer_group: pick(raw, "CUSTOMER_GROUP"),
    customer_price_group: pick(raw, "CUSTOMER_PRICE_GROUP"),
    year: pick(raw, "YEAR"),
    contract_no: pick(raw, "CONTRACT_NO"),
    contract_item: pick(raw, "CONTRACT_ITEM"),
    sales_document_no: pick(raw, "SALES_DOCUMENT_NO"),
    so_creation_date: pick(raw, "SO_CREATION_DATE"),
    sales_item_no: pick(raw, "SALES_ITEM_NO"),
    material: pick(raw, "MATERIAL"),
    qty: pick(raw, "QTY"),
    net_value: pick(raw, "NET_VALUE"),
    tax_value: pick(raw, "TAX_VALUE"),
    reason: pick(raw, "REASON"),
  };
}

export const fetchSalesOrderApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      plants: z.array(z.string().trim().min(1).max(40)).min(1, "At least one plant required"),
      user_id: z.string().trim().max(40).optional(),
      customer_from: z.string().trim().max(40).optional(),
      customer_to: z.string().trim().max(40).optional(),
      status: z.enum(["pending", "accepted", "rejected", "all"]).default("pending"),
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
    const isAll = data.status === "all";
    const R_PEND = isAll || data.status === "pending" ? "X" : "";
    const R_ACCP = isAll || data.status === "accepted" ? "X" : "";
    const R_REJ = isAll || data.status === "rejected" ? "X" : "";


    const custFrom = (data.customer_from ?? "").trim();
    const custTo = (data.customer_to ?? "").trim() || custFrom;

    const inputs = {
      PLANT: data.plants.map((p) => ({ plant: p })),
      CUSTOMER_FROM: custFrom,
      CUSTOMER_TO: custTo,
      USER_ID: userId,
      R_PEND,
      R_ACCP,
      R_REJ,
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "GET";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sales_order_approval/Fetch`;
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
      const firstPlant = data.plants[0];
      const join = cfg.endpoint_url.includes("?") ? "&" : "?";
      const qs =
        `${join}PLANT=${encodeURIComponent(firstPlant)}` +
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
        message: `so-fetch network: ${errMsg}`,
      });
      return {
        rows: [] as SalesOrderRow[],
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
        message: `so-fetch: ${message} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as SalesOrderRow[],
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
        rows: [] as SalesOrderRow[],
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
      message: `so-fetch: ${message}`,
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

function s(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}

function padCustomer(v: string | number | null | undefined): string {
  const x = s(v).trim();
  return x && /^\d+$/.test(x) ? x.padStart(10, "0") : x;
}

const SalesOrderRowSchema = z.object({
  select: z.string().nullable().optional(),
  company_code: z.string().nullable().optional(),
  sales_org: z.string().nullable().optional(),
  dis_chanel: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_group: z.string().nullable().optional(),
  customer_price_group: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  contract_no: z.string().nullable().optional(),
  contract_item: z.union([z.string(), z.number()]).nullable().optional(),
  sales_document_no: z.string().nullable().optional(),
  so_creation_date: z.string().nullable().optional(),
  sales_item_no: z.union([z.string(), z.number()]).nullable().optional(),
  material: z.string().nullable().optional(),
  qty: z.union([z.string(), z.number()]).nullable().optional(),
  net_value: z.union([z.string(), z.number()]).nullable().optional(),
  tax_value: z.union([z.string(), z.number()]).nullable().optional(),
  reason: z.string().nullable().optional(),
});

function toSapSoRow(r: z.infer<typeof SalesOrderRowSchema>) {
  return {
    SELECT: "X",
    COMPANY_CODE: s(r.company_code),
    SALES_ORG: s(r.sales_org),
    DIS_CHANEL: s(r.dis_chanel),
    DIVISION: s(r.division),
    CUSTOMER: padCustomer(r.customer),
    CUSTOMER_NAME: s(r.customer_name),
    CUSTOMER_GROUP: s(r.customer_group),
    CUSTOMER_PRICE_GROUP: s(r.customer_price_group),
    YEAR: s(r.year),
    CONTRACT_NO: s(r.contract_no),
    CONTRACT_ITEM: s(r.contract_item),
    SALES_DOCUMENT_NO: s(r.sales_document_no),
    SO_CREATION_DATE: s(r.so_creation_date),
    SALES_ITEM_NO: s(r.sales_item_no),
    MATERIAL: s(r.material),
    QTY: s(r.qty),
    NET_VALUE: s(r.net_value),
    TAX_VALUE: s(r.tax_value),
    REASON: s(r.reason),
  };
}

export const submitSalesOrderDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      action: z.enum(["accepted", "rejected"]),
      user_id: z.string().trim().max(40).optional(),
      rows: z.array(SalesOrderRowSchema).min(1, "Select at least one row"),
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
      USER_ID: resolvedUserId,
      APPROV: data.action === "accepted" ? "X" : "",
      REJ: data.action === "rejected" ? "X" : "",
      DATA: data.rows.map(toSapSoRow),
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "PUT";
    let bodyOut: string;
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sales_order_approval/Sales_Order_Approve_Reject`;
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
    console.log("[submitSalesOrderDecision] target=", target, "method=", method, "proxied=", proxied, "payload=", sapPayload);
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
      console.error("[submitSalesOrderDecision] network error", errMsg);
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `so-decision ${data.action}: network ${errMsg}`,
      });
      return {
        ok: false as const,
        action: data.action,
        count: data.rows.length,
        error: `Could not reach SAP: ${errMsg}`,
        sap_response: null,
        debug: {
          target,
          method,
          proxied,
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
    console.log("[submitSalesOrderDecision] status=", res.status, "latency_ms=", latency_ms, "body=", text.slice(0, 1000));

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
        message: `so-decision ${data.action}: ${res.status} ${text.slice(0, 500)}`,
      });
      return {
        ok: false as const,
        action: data.action,
        count: data.rows.length,
        error: `SAP returned ${res.status} ${res.statusText}: ${upstream || text.slice(0, 300) || "(empty body)"}`,
        sap_response: json,
        debug: {
          target,
          method,
          proxied,
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
      message: `so-decision ${data.action}: ${res.status}`,
    });

    return {
      ok: true as const,
      action: data.action,
      count: data.rows.length,
      error: null as string | null,
      sap_response: json,
      debug: {
        target,
        method,
        proxied,
        request_headers: redacted(headers),
        request_payload: sapPayload,
        response_status: res.status,
        response_body_preview: text.slice(0, 4000),
        latency_ms,
      },
    };
  });
