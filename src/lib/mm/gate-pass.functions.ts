/**
 * MM Gate Pass — live SAP fetch via the configured Gate_Pass_Approval_API.
 * Payload: { USER_ID, GATE_PASS_NUMBER, HOD_APPROVAL, STORE_APPROVAL,
 *            SCM_HEAD, PLANT_HEAD, RETURN_RECEIPT }
 * Parses response { HEADER: [...], DATA: [...] } and returns { header, data }.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "Gate_Pass_Fetch_API";

export const fetchGatePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().trim().min(1, "User ID is required").max(60),
      gate_pass_number: z.string().trim().max(40).optional().default(""),
      hod_approval: z.boolean().optional().default(false),
      store_approval: z.boolean().optional().default(false),
      scm_head: z.boolean().optional().default(false),
      plant_head: z.boolean().optional().default(false),
      return_receipt: z.boolean().optional().default(false),
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

    const inputs: Record<string, string> = {
      GATEPASS_NUMBER: (data.gate_pass_number ?? "").trim(),
      HOD_APPROVAL: data.hod_approval ? "X" : "",
      STORE_APPROVAL: data.store_approval ? "X" : "",
      SCM_HEAD: data.scm_head ? "X" : "",
      PLANT_HEAD: data.plant_head ? "X" : "",
      RETURN_RECEIPT: data.return_receipt ? "X" : "",
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
        message: `gate-pass network: ${errMsg}`,
      });
      return {
        header: null as Record<string, any> | null,
        data: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        user_id: userId,
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
        message: `gate-pass: ${message} ${text.slice(0, 500)}`,
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
        : Array.isArray(sapJson)
          ? sapJson
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
      message: `gate-pass: ${message}`,
    });

    return {
      header,
      data: rows,
      fetched_at: new Date().toISOString(),
      user_id: userId,
      error: null as string | null,
    };
  });

const SAVE_CONFIG_NAME = "Gate_Pass_Save_API";

const gpSaveRowSchema = z.object({
  MATERIAL: z.string().optional().default(""),
  DESCRIPTION: z.string().optional().default(""),
  MEINS: z.string().optional().default(""),
  QUANTITY: z.union([z.string(), z.number()]).optional().default(0),
  VALUE: z.union([z.string(), z.number()]).optional().default(0),
  EXPECTED_DATE_OF_RETURN: z.string().optional().default(""),
  USER_REMARKS: z.string().optional().default(""),
  HOD_APPROVAL: z.string().optional().default(""),
  HOD_REJECTION: z.string().optional().default(""),
  HOD_REMARKS: z.string().optional().default(""),
  ISSUED_QUANTITY: z.union([z.string(), z.number()]).optional().default(0),
  STORE_APPROVAL: z.string().optional().default(""),
  JUSTIFICATION: z.string().optional().default(""),
  SCM_HEAD: z.string().optional().default(""),
  PH_APPROVAL: z.string().optional().default(""),
  PH_REJECTION: z.string().optional().default(""),
  RETURN_STATUS: z.string().optional().default(""),
  REMARKS: z.string().optional().default(""),
  RETURNED_QUANTITY: z.union([z.string(), z.number()]).optional().default(0),
}).passthrough();

function toNum(v: any): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const saveGatePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      header: z.object({
        GATEPASS_NUMBER: z.union([z.string(), z.number()]).optional().default(""),
        GATE_PASS_TYPE: z.string().optional().default(""),
        GATEPASS_DATE: z.string().optional().default(""),
        PLANT: z.string().optional().default(""),
        VEHICLE_NO: z.string().optional().default(""),
        VENDOR: z.string().optional().default(""),
        VENDOR_NAME: z.string().optional().default(""),
        PURPOSE: z.string().optional().default(""),
      }).passthrough(),
      data: z.array(gpSaveRowSchema).min(1, "At least one row is required"),
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

    const h = data.header;
    const gpNumRaw = h.GATEPASS_NUMBER;
    const gpNumNumeric =
      typeof gpNumRaw === "number"
        ? gpNumRaw
        : typeof gpNumRaw === "string" && gpNumRaw.trim() !== "" && !Number.isNaN(Number(gpNumRaw))
          ? Number(gpNumRaw)
          : gpNumRaw ?? "";

    const payload: Record<string, any> = {
      GATEPASS_NUMBER: gpNumNumeric,
      GATE_PASS_TYPE: h.GATE_PASS_TYPE ?? (h as any).GATEPASS_TYPE ?? "",
      GATEPASS_DATE: h.GATEPASS_DATE ?? "",
      PLANT: h.PLANT ?? "",
      VEHICLE_NO: h.VEHICLE_NO ?? "",
      VENDOR: h.VENDOR ?? "",
      VENDOR_NAME: h.VENDOR_NAME ?? "",
      PURPOSE: h.PURPOSE ?? "",
      DATA: data.data.map((r) => ({
        MATERIAL: r.MATERIAL ?? "",
        DESCRIPTION: r.DESCRIPTION ?? "",
        MEINS: r.MEINS ?? "",
        QUANTITY: toNum(r.QUANTITY),
        VALUE: toNum(r.VALUE),
        EXPECTED_DATE_OF_RETURN: r.EXPECTED_DATE_OF_RETURN ?? "",
        USER_REMARKS: r.USER_REMARKS ?? "",
        HOD_APPROVAL: r.HOD_APPROVAL ?? "",
        HOD_REJECTION: r.HOD_REJECTION ?? "",
        HOD_REMARKS: r.HOD_REMARKS ?? "",
        ISSUED_QUANTITY: toNum(r.ISSUED_QUANTITY),
        STORE_APPROVAL: r.STORE_APPROVAL ?? "",
        JUSTIFICATION: r.JUSTIFICATION ?? "",
        SCM_HEAD: r.SCM_HEAD ?? "",
        PH_APPROVAL: r.PH_APPROVAL ?? "",
        PH_REJECTION: r.PH_REJECTION ?? "",
        RETURN_STATUS: r.RETURN_STATUS ?? "",
        REMARKS: r.REMARKS ?? "",
        RETURNED_QUANTITY: toNum(r.RETURNED_QUANTITY),
      })),
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
        message: `gate-pass-save network: ${errMsg}`,
      });
      return { ok: false, message: `Could not reach SAP: ${errMsg}`, document_number: null as string | null, error: errMsg };
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;

    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `gate-pass-save: invalid JSON ${text.slice(0, 300)}`,
      });
      return { ok: false, message: `Invalid JSON from SAP: ${text.slice(0, 200)}`, document_number: null, error: "invalid_json" };
    }

    const sapJson: any = proxied ? (json?.data ?? json ?? {}) : json;

    // Preferred shape: { MESSAGES: [{ TYPE, MESSAGE }] }
    if (Array.isArray(sapJson?.MESSAGES) && sapJson.MESSAGES.length > 0) {
      const msg = sapJson.MESSAGES
        .map((m: any) => String(m?.MESSAGE ?? "").trim())
        .filter(Boolean)
        .join("; ") || "SAP returned an error";
      const anyError = sapJson.MESSAGES.some(
        (m: any) => {
          const t = String(m?.TYPE ?? "").toUpperCase();
          return t === "E" || t === "A";
        },
      );
      const ok = res.ok && !anyError;
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: ok ? "ok" : "error",
        latency_ms,
        message: `gate-pass-save: ${msg}`,
      });
      const docMatch = msg.match(/Document\s*No\s*:?\s*(\S+)/i);
      return {
        ok,
        message: msg,
        document_number: (sapJson?.DOCUMENT_NUMBER ?? docMatch?.[1]) ?? null,
        error: ok ? null : msg,
      };
    }

    // Legacy single-object shape: { TYPE, DOCUMENT_NUMBER, MESSAGE }
    const type = String(sapJson?.TYPE ?? "").toUpperCase();
    const message = String(sapJson?.MESSAGE ?? "").trim();
    const ok = res.ok && (type === "S" || type === "I" || type === "");

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms,
      message: `gate-pass-save: ${type || "?"} ${message || text.slice(0, 200)}`,
    });

    return {
      ok,
      message: message || (ok ? "Saved successfully" : `SAP returned ${res.status}`),
      document_number: sapJson?.DOCUMENT_NUMBER ?? null,
      error: ok ? null : (message || `SAP returned ${res.status}`),
    };
  });
