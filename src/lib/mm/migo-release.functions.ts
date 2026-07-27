/**
 * MM MIGO Release — live SAP fetch via the configured
 * MIGO_FETCH_API sap_api_configs row.
 *
 * Sends payload: { MATERIAL_DOC_NUMBER, MATERIAL_DOC_YEAR, USER_ID }
 * Parses response { HEADER: [...], DATA: [...] } and returns { header, data }.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "MIGO_FETCH_API";

export const fetchMigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().trim().min(1, "User ID is required").max(60),
      mat_doc_number: z.string().trim().max(40).optional().default(""),
      mat_doc_year: z.string().trim().max(4).optional().default(""),
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

    const userId = data.user_id.trim();
    const matDocNo = (data.mat_doc_number ?? "").trim();
    const matDocYear = (data.mat_doc_year ?? "").trim();

    const inputs: Record<string, string> = {
      MATERIAL_DOC_NUMBER: matDocNo,
      MATERIAL_DOC_YEAR: matDocYear,
      USER_ID: userId,
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "GET";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
      method = "POST";
      headers["Content-Type"] = "application/json";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs });
      proxied = true;
    } else {
      const qs = new URLSearchParams(inputs).toString();
      const join = cfg.endpoint_url.includes("?") ? "&" : "?";
      target = `${cfg.endpoint_url}${join}${qs}`;
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
      const latency_ms = Date.now() - t0;
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `migo-fetch network: ${errMsg}`,
      });
      return {
        header: null as Record<string, any> | null,
        data: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        user_id: userId,
        error: `Could not reach SAP. ${errMsg}.`,
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
        message: `migo-fetch: ${message} ${text.slice(0, 500)}`,
      });
      return {
        header: null as Record<string, any> | null,
        data: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        user_id: userId,
        error: `SAP returned ${message}: ${text.slice(0, 200)}`,
      };
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        header: null as Record<string, any> | null,
        data: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        user_id: userId,
        error: `Invalid JSON from SAP: ${text.slice(0, 200)}`,
      };
    }
    const sapJson: any = proxied ? (json?.data ?? json ?? {}) : json;

    const headerArr: any[] = Array.isArray(sapJson?.HEADER)
      ? sapJson.HEADER
      : Array.isArray(sapJson?.header)
        ? sapJson.header
        : [];
    const dataArr: any[] = Array.isArray(sapJson?.DATA)
      ? sapJson.DATA
      : Array.isArray(sapJson?.data)
        ? sapJson.data
        : [];

    const header: Record<string, any> | null =
      headerArr.length > 0 && headerArr[0] && typeof headerArr[0] === "object"
        ? { ...headerArr[0] }
        : null;
    const rows: Record<string, any>[] = dataArr.map((r) =>
      r && typeof r === "object" ? { ...r } : {},
    );

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `migo-fetch: ${message}`,
    });

    return {
      header,
      data: rows,
      fetched_at: new Date().toISOString(),
      user_id: userId,
      error: null as string | null,
    };
  });

const SAVE_CONFIG_NAME = "MIGO_SAVE_API";

export const saveMigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().trim().min(1, "User ID is required").max(60),
      header: z.record(z.string(), z.any()),
      data: z.array(z.record(z.string(), z.any())).min(1, "At least one row is required"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", SAVE_CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${SAVE_CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${SAVE_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const userId = data.user_id.trim();
    const payload: Record<string, any> = {
      ...data.header,
      USER_ID: userId,
      DATA: data.data,
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "POST";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
      method = "POST";
      headers["Content-Type"] = "application/json";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs: payload });
      proxied = true;
    } else {
      target = cfg.endpoint_url;
      headers["Content-Type"] = "application/json";
      bodyOut = JSON.stringify(payload);
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
      const latency_ms = Date.now() - t0;
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `migo-save network: ${errMsg}`,
      });
      return { ok: false, message: `Could not reach SAP: ${errMsg}`, documentNumber: null as string | null };
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;

    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `migo-save: invalid JSON ${text.slice(0, 300)}`,
      });
      return { ok: false, message: `Invalid JSON from SAP: ${text.slice(0, 200)}`, documentNumber: null };
    }

    const sapJson: any = proxied ? (json?.data ?? json ?? {}) : json;

    if (Array.isArray(sapJson?.MESSAGES) && sapJson.MESSAGES.length > 0) {
      const msg = sapJson.MESSAGES
        .map((m: any) => String(m?.MESSAGE ?? "").trim())
        .filter(Boolean)
        .join("; ") || "SAP returned an error";
      const anyError = sapJson.MESSAGES.some(
        (m: any) => String(m?.TYPE ?? "").toUpperCase() === "E" || String(m?.TYPE ?? "").toUpperCase() === "A",
      );
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: anyError ? "error" : "ok",
        latency_ms,
        message: `migo-save: ${msg}`,
      });
      return {
        ok: !anyError,
        message: msg,
        documentNumber: sapJson?.DOCUMENT_NUMBER ?? null,
      };
    }

    const type = String(sapJson?.TYPE ?? "").toUpperCase();
    const message = String(sapJson?.MESSAGE ?? "").trim();
    const ok = res.ok && (type === "S" || type === "I" || type === "");

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms,
      message: `migo-save: ${type || "?"} ${message || text.slice(0, 200)}`,
    });

    return {
      ok,
      message: message || (ok ? "Saved successfully" : `SAP returned ${res.status}`),
      documentNumber: sapJson?.DOCUMENT_NUMBER ?? null,
    };
  });
