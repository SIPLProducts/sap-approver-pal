/**
 * IWM Price Master Update Approvals — live SAP fetch via the PMUA_FETCH_API config.
 *
 * Payload (sent verbatim):
 * {
 *   "get_data": {
 *     "plant": [{ "plant": "3601" }],
 *     "kunnr": [],
 *     "date_from": "",
 *     "date_to": "",
 *     "R_pen": "",
 *     "R_appr": "X",
 *     "r_rej": ""
 *   }
 * }
 *
 * Response: array of price master approval rows.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "PMUA_FETCH_API";

export type PriceMasterApprovalRow = Record<string, string | number | null>;

export type PriceMasterApprovalsResponse = {
  rows: PriceMasterApprovalRow[];
  error: string | null;
  sapMessage: string | null;
  fetched_at: string;
};

function fail(
  error: string | null,
  sapMessage: string | null = null,
): PriceMasterApprovalsResponse {
  return { rows: [], error, sapMessage, fetched_at: new Date().toISOString() };
}

function extractSapMsg(text: string): string | null {
  if (!text || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    const node = Array.isArray(parsed) ? parsed[0] : parsed;
    const msg =
      node?.MSG ??
      node?.MSGTXT ??
      node?.MESSAGE ??
      node?.data?.MSG ??
      node?.data?.MSGTXT ??
      node?.data?.MESSAGE ??
      node?.message ??
      node?.error;
    return typeof msg === "string" && msg.trim() ? msg.trim() : null;
  } catch {
    const match = text.match(/"(?:MSG|MSGTXT|MESSAGE)"\s*:\s*"([^"]*)"/i);
    return match?.[1] ? match[1] : null;
  }
}

function pickRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const candidates = [payload.DATA, payload.data, payload.ITEMS, payload.get_data];
    const found = candidates.find((c) => Array.isArray(c));
    if (found) return found;
    for (const v of Object.values(payload)) if (Array.isArray(v)) return v as any[];
  }
  return [];
}

export const fetchPriceMasterApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plants: z.array(z.string().trim().min(1).max(40)).min(1, "At least one plant is required"),
        customer: z.string().trim().max(40).optional(),
        date_from: z.string().trim().max(20).optional(),
        date_to: z.string().trim().max(20).optional(),
        status: z.enum(["pending", "approved", "rejected"]).default("pending"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PriceMasterApprovalsResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      throw new Error(`SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin
        .from("sap_global_secrets")
        .select("proxy_secret")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    const customer = (data.customer ?? "").trim();

    const inputs = {
      get_data: {
        plant: data.plants.map((p) => ({ plant: p })),
        kunnr: customer ? [{ kunnr: customer }] : [],
        date_from: (data.date_from ?? "").trim(),
        date_to: (data.date_to ?? "").trim(),
        R_pen: data.status === "pending" ? "X" : "",
        R_appr: data.status === "approved" ? "X" : "",
        r_rej: data.status === "rejected" ? "X" : "",
      },
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method = "POST";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/raw-invoke`;
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs });
      proxied = true;
    } else {
      method = cfg.http_method ?? "POST";
      target = cfg.endpoint_url;
      bodyOut = JSON.stringify(inputs);
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
    } catch (e) {
      const errMsg = (e as Error).message || "fetch failed";
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `pmua-fetch network: ${errMsg}`,
      });
      return fail(`Could not reach SAP. ${errMsg}.`);
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `pmua-fetch: ${res.status} ${text.slice(0, 500)}`,
      });
      return fail(null, extractSapMsg(text) ?? `SAP returned ${res.status} ${res.statusText}`);
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return fail(null, extractSapMsg(text) ?? "Invalid response from SAP");
    }

    const sapJson: any = proxied ? (json?.data ?? json) : json;
    const first = Array.isArray(sapJson) ? sapJson[0] : sapJson;
    const rawStatus = typeof first?.STATUS === "string" ? first.STATUS.trim() : "";
    const status = rawStatus.toUpperCase();
    const type = String(first?.TYPE ?? "").toUpperCase();
    const isMessageNode =
      !!first && typeof first === "object" && !("WERKS" in first) && !!rawStatus;

    // SAP sometimes returns a single status/message node instead of data rows,
    // e.g. [{ TYPE: "E", STATUS: "No Authorization ..." }].
    if ((type === "E" || type === "A" || status === "FALSE") && isMessageNode) {
      return fail(null, rawStatus);
    }
    if (!Array.isArray(sapJson) && (status === "FALSE" || type === "E")) {
      return fail(null, extractSapMsg(text) ?? "SAP returned an error");
    }

    const rows = pickRows(sapJson).filter((r) => r && typeof r === "object");

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `pmua-fetch: ${res.status} ${res.statusText}`,
    });

    if (rows.length === 0) {
      return fail(null, extractSapMsg(text) ?? "Data is not available");
    }

    return {
      rows: rows as PriceMasterApprovalRow[],
      error: null,
      sapMessage: null,
      fetched_at: new Date().toISOString(),
    };
  });

/* ------------------------------------------------------------------ */
/* Approve — PMUA_APPROVE_API                                          */
/* Payload: { "Approve": [ { ...row as received from SAP... } ] }       */
/* Response: [ { "TYPE": "S", "MESSAGE": "Approved Sucessfully" } ]     */
/* ------------------------------------------------------------------ */

const APPROVE_CONFIG_NAME = "PMUA_APPROVE_API";

export type PriceMasterApproveResponse = {
  ok: boolean;
  message: string | null;
};

export const approvePriceMasterApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rows: z.array(z.record(z.string(), z.any())).min(1, "Select at least one record"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PriceMasterApproveResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", APPROVE_CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      throw new Error(
        `SAP API config "${APPROVE_CONFIG_NAME}" not found. Configure it in Admin → SAP API.`,
      );
    if (!cfg.is_active) throw new Error(`SAP API config "${APPROVE_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin
        .from("sap_global_secrets")
        .select("proxy_secret")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    const inputs = { Approve: data.rows };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method = "POST";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/raw-invoke`;
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs, raw: true });
      proxied = true;
    } else {
      method = cfg.http_method ?? "POST";
      target = cfg.endpoint_url;
      bodyOut = JSON.stringify(inputs);
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
    } catch (e) {
      const errMsg = (e as Error).message || "fetch failed";
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `pmua-approve network: ${errMsg}`,
      });
      return { ok: false, message: `Could not reach SAP. ${errMsg}.` };
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `pmua-approve: ${res.status} ${text.slice(0, 500)}`,
      });
      return {
        ok: false,
        message: extractSapMsg(text) ?? `SAP returned ${res.status} ${res.statusText}`,
      };
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, message: extractSapMsg(text) ?? "Invalid response from SAP" };
    }

    const sapJson: any = proxied ? (json?.data ?? json) : json;
    const first = Array.isArray(sapJson) ? sapJson[0] : sapJson;
    const type = String(first?.TYPE ?? "").toUpperCase();
    const status = String(first?.STATUS ?? "").toUpperCase();
    const message = extractSapMsg(JSON.stringify(sapJson ?? null)) ?? extractSapMsg(text);
    const ok = type === "S" && status !== "FALSE";

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms,
      rows_processed: data.rows.length,
      message: `pmua-approve: ${res.status} ${res.statusText} ${message ?? ""}`.slice(0, 500),
    });

    return { ok, message: message ?? (ok ? "Approved successfully" : "SAP returned an error") };
  });

/* ------------------------------------------------------------------ */
/* Reject — PMUA_REJECT_API                                            */
/* Payload: { "reject": [ { ...row as received from SAP... } ] }        */
/* Response: [ { "TYPE": "S", "MESSAGE": "Rejected Sucessfully" } ]     */
/* ------------------------------------------------------------------ */

const REJECT_CONFIG_NAME = "PMUA_REJECT_API";

export type PriceMasterRejectResponse = {
  ok: boolean;
  message: string | null;
};

export const rejectPriceMasterApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rows: z.array(z.record(z.string(), z.any())).min(1, "Select at least one record"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PriceMasterRejectResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", REJECT_CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      throw new Error(
        `SAP API config "${REJECT_CONFIG_NAME}" not found. Configure it in Admin → SAP API.`,
      );
    if (!cfg.is_active) throw new Error(`SAP API config "${REJECT_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin
        .from("sap_global_secrets")
        .select("proxy_secret")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    const inputs = { reject: data.rows };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method = "POST";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/raw-invoke`;
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs, raw: true });
      proxied = true;
    } else {
      method = cfg.http_method ?? "POST";
      target = cfg.endpoint_url;
      bodyOut = JSON.stringify(inputs);
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
    } catch (e) {
      const errMsg = (e as Error).message || "fetch failed";
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `pmua-reject network: ${errMsg}`,
      });
      return { ok: false, message: `Could not reach SAP. ${errMsg}.` };
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `pmua-reject: ${res.status} ${text.slice(0, 500)}`,
      });
      return {
        ok: false,
        message: extractSapMsg(text) ?? `SAP returned ${res.status} ${res.statusText}`,
      };
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, message: extractSapMsg(text) ?? "Invalid response from SAP" };
    }

    const sapJson: any = proxied ? (json?.data ?? json) : json;
    const first = Array.isArray(sapJson) ? sapJson[0] : sapJson;
    const type = String(first?.TYPE ?? "").toUpperCase();
    const status = String(first?.STATUS ?? "").toUpperCase();
    const message = extractSapMsg(JSON.stringify(sapJson ?? null)) ?? extractSapMsg(text);
    const ok = type === "S" && status !== "FALSE";

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms,
      rows_processed: data.rows.length,
      message: `pmua-reject: ${res.status} ${res.statusText} ${message ?? ""}`.slice(0, 500),
    });

    return { ok, message: message ?? (ok ? "Rejected successfully" : "SAP returned an error") };
  });
