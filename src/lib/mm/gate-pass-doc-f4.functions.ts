/**
 * MM Gate Pass — F4 help for the Gate Pass Number field.
 * Config: Gate_Pass_Doc_F4_API
 * Payload: { USER_ID, HOD, STORES, SCM, PLANT }  (exactly one flag = "X")
 * Response: [{ UNIQUE_NO }, ...]
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "Gate_Pass_Doc_F4_API";

export type GatePassDocF4Response = {
  numbers: string[];
  error: string | null;
  sapMessage: string | null;
  fetched_at: string;
};

function fail(error: string | null, sapMessage: string | null = null): GatePassDocF4Response {
  return { numbers: [], error, sapMessage, fetched_at: new Date().toISOString() };
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
    const candidates = [payload.DATA, payload.data, payload.ITEMS, payload.GATEPASS_LIST];
    const found = candidates.find((c) => Array.isArray(c));
    if (found) return found;
    for (const v of Object.values(payload)) if (Array.isArray(v)) return v as any[];
  }
  return [];
}

export const fetchGatePassDocF4 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().trim().min(1, "User ID is required").max(60),
        hod: z.boolean().optional().default(false),
        stores: z.boolean().optional().default(false),
        scm: z.boolean().optional().default(false),
        plant: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<GatePassDocF4Response> => {
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

    const inputs: Record<string, string> = {
      USER_ID: data.user_id.trim(),
      HOD: data.hod ? "X" : "",
      STORES: data.stores ? "X" : "",
      SCM: data.scm ? "X" : "",
      PLANT: data.plant ? "X" : "",
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
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs, raw: true });
      proxied = true;
    } else {
      method = cfg.http_method ?? "POST";
      if (method.toUpperCase() === "GET") {
        const qs = new URLSearchParams(inputs).toString();
        const join = cfg.endpoint_url.includes("?") ? "&" : "?";
        target = `${cfg.endpoint_url}${join}${qs}`;
        bodyOut = undefined;
      } else {
        target = cfg.endpoint_url;
        bodyOut = JSON.stringify(inputs);
      }
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
        message: `gate-pass-doc-f4 network: ${errMsg}`,
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
        message: `gate-pass-doc-f4: ${res.status} ${text.slice(0, 500)}`,
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
    const status = String(first?.STATUS ?? "").toUpperCase();
    const type = String(first?.TYPE ?? "").toUpperCase();
    if (!Array.isArray(sapJson) && (status === "FALSE" || type === "E")) {
      return fail(null, extractSapMsg(text) ?? "SAP returned an error");
    }

    const rows = pickRows(sapJson);
    const seen = new Set<string>();
    const numbers: string[] = [];
    for (const row of rows) {
      const raw =
        typeof row === "string" || typeof row === "number"
          ? String(row)
          : String(row?.UNIQUE_NO ?? row?.GATEPASS_NUMBER ?? row?.GATE_PASS_NUMBER ?? "");
      const v = raw.trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      numbers.push(v);
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: numbers.length,
      message: `gate-pass-doc-f4: ${res.status} ${res.statusText}`,
    });

    if (numbers.length === 0) {
      return fail(null, extractSapMsg(text) ?? "Data is not available");
    }

    return { numbers, error: null, sapMessage: null, fetched_at: new Date().toISOString() };
  });
