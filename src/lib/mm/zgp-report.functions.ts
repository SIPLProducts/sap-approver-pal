/**
 * MM ZGP Report (RGP / NRGP Status) — live SAP fetch via the
 * ZGP_FETCH_REPORT sap_api_configs row.
 *
 * Payload (sent verbatim):
 * {
 *   "get_data": {
 *     "type_from": "NRGP", "type_to": "",
 *     "number_from": "", "number_to": "",
 *     "material_from": "", "material_to": "",
 *     "date_from": "", "date_to": "",
 *     "plant_from": "", "plant_to": "",
 *     "vendor_from": "", "vendor_to": ""
 *   }
 * }
 *
 * Response: array of gate pass status rows (display only).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "ZGP_FETCH_REPORT";

export type ZgpReportRow = Record<string, string | number | null>;

export type ZgpReportResponse = {
  rows: ZgpReportRow[];
  error: string | null;
  sapMessage: string | null;
  fetched_at: string;
};

function fail(error: string | null, sapMessage: string | null = null): ZgpReportResponse {
  return { rows: [], error, sapMessage, fetched_at: new Date().toISOString() };
}

function extractSapMsg(text: string): string | null {
  if (!text || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    const node = Array.isArray(parsed) ? parsed[0] : parsed;
    const msg =
      node?.MESSAGE ??
      node?.MSG ??
      node?.MSGTXT ??
      node?.data?.MESSAGE ??
      node?.data?.MSG ??
      node?.data?.MSGTXT ??
      node?.message ??
      node?.error;
    return typeof msg === "string" && msg.trim() ? msg.trim() : null;
  } catch {
    const match = text.match(/"(?:MESSAGE|MSG|MSGTXT)"\s*:\s*"([^"]*)"/i);
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

const str = z.string().trim().max(40).optional();

export const fetchZgpReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        type_from: str,
        type_to: str,
        number_from: str,
        number_to: str,
        material_from: str,
        material_to: str,
        date_from: str,
        date_to: str,
        plant_from: str,
        plant_to: str,
        vendor_from: str,
        vendor_to: str,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ZgpReportResponse> => {
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
        .select("connection_mode, middleware_url, sap_base_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin
        .from("sap_global_secrets")
        .select("proxy_secret")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    const inputs = {
      get_data: {
        type_from: (data.type_from ?? "").trim(),
        type_to: (data.type_to ?? "").trim(),
        number_from: (data.number_from ?? "").trim(),
        number_to: (data.number_to ?? "").trim(),
        material_from: (data.material_from ?? "").trim(),
        material_to: (data.material_to ?? "").trim(),
        date_from: (data.date_from ?? "").trim(),
        date_to: (data.date_to ?? "").trim(),
        plant_from: (data.plant_from ?? "").trim(),
        plant_to: (data.plant_to ?? "").trim(),
        vendor_from: (data.vendor_from ?? "").trim(),
        vendor_to: (data.vendor_to ?? "").trim(),
      },
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method = cfg.http_method ?? "PUT";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/raw-invoke`;
      method = "POST";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs, raw: true });
      proxied = true;
    } else {
      const { resolveSapUrl } = await import("@/lib/sap/url");
      target = resolveSapUrl(cfg.endpoint_url, (globalSettings as any)?.sap_base_url ?? null);
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
        message: `zgp-report network: ${errMsg}`,
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
        message: `zgp-report: ${res.status} ${text.slice(0, 500)}`,
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
    const rowsRaw = pickRows(sapJson).filter((r) => r && typeof r === "object");
    const first = Array.isArray(sapJson) ? sapJson[0] : sapJson;
    const type = String(first?.TYPE ?? "").toUpperCase();
    const statusFalse = String(first?.STATUS ?? "").trim().toUpperCase() === "FALSE";
    // Report rows legitimately carry TYPE = "RGP" / "NRGP"; only a bare
    // single-node error payload (TYPE E/A or STATUS false) is a failure.
    const errorNode =
      statusFalse || ((type === "E" || type === "A") && rowsRaw.length <= 1 && !first?.UNIQUE_NO);

    if (errorNode) {
      return fail(null, extractSapMsg(text) ?? "SAP returned an error");
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rowsRaw.length,
      message: `zgp-report: ${res.status} ${res.statusText}`,
    });

    return {
      rows: rowsRaw as ZgpReportRow[],
      error: null,
      sapMessage: null,
      fetched_at: new Date().toISOString(),
    };
  });
