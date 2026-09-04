/**
 * IMW Price Master Update — live SAP fetch via the IMW_PMU_FETCH_API config.
 *
 * Payload (sent verbatim):
 * {
 *   "get_data": {
 *     "plant": [{ "plant": "3601" }],
 *     "kunnr": [],
 *     "R_DIS": "X",
 *     "R_UPD": "",
 *     "user_name": "",
 *     "PASSWORD": ""
 *   }
 * }
 *
 * Response: array of price master rows.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "IMW_PMU_FETCH_API";

export type PriceMasterRow = Record<string, string | number | null>;

export type PriceMasterResponse = {
  rows: PriceMasterRow[];
  error: string | null;
  sapMessage: string | null;
  fetched_at: string;
};

function fail(error: string | null, sapMessage: string | null = null): PriceMasterResponse {
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

export const fetchPriceMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plants: z.array(z.string().trim().min(1).max(40)).min(1, "At least one plant is required"),
        customer: z.string().trim().max(40).optional(),
        mode: z.enum(["display", "update"]).default("display"),
        user_name: z.string().trim().max(60).optional(),
        password: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PriceMasterResponse> => {
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

    const isUpdate = data.mode === "update";
    const customer = (data.customer ?? "").trim();

    const inputs = {
      get_data: {
        plant: data.plants.map((p) => ({ plant: p })),
        kunnr: customer ? [{ kunnr: customer }] : [],
        R_DIS: isUpdate ? "" : "X",
        R_UPD: isUpdate ? "X" : "",
        user_name: isUpdate ? (data.user_name ?? "").trim() : "",
        PASSWORD: isUpdate ? (data.password ?? "") : "",
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
        message: `imw-pmu-fetch network: ${errMsg}`,
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
        message: `imw-pmu-fetch: ${res.status} ${text.slice(0, 500)}`,
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

    // SAP sometimes returns a single status/message node (object or 1-element
    // array) instead of data rows, e.g. [{ TYPE: "E", STATUS: "No Authorization ..." }].
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
      message: `imw-pmu-fetch: ${res.status} ${res.statusText}`,
    });

    if (rows.length === 0) {
      return fail(null, extractSapMsg(text) ?? "Data is not available");
    }

    return {
      rows: rows as PriceMasterRow[],
      error: null,
      sapMessage: null,
      fetched_at: new Date().toISOString(),
    };
  });
