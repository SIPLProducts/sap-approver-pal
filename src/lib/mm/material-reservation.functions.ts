/**
 * MM Material Reservation — live SAP fetch via the configured
 * Material_Reservation_Fetch_API sap_api_configs row.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "Material_Reservation_Fetch_API";

export const fetchMaterialReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().trim().min(1, "User ID is required").max(60),
      doc_number: z.string().trim().max(40).optional().default(""),
      hod_approve: z.boolean().optional().default(false),
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
    const docNumber = (data.doc_number ?? "").trim();
    const hodFlag = data.hod_approve ? "X" : "";

    const inputs: Record<string, string> = {
      USER_ID: userId,
      DOC_NUMBER: docNumber,
      HOD_APPROVE: hodFlag,
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
      target = `${middlewareUrl.replace(/\/$/, "")}/material_reservation/Fetch`;
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
        message: `material-reservation-fetch network: ${errMsg}`,
      });
      return {
        rows: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        count: 0,
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
        message: `material-reservation-fetch: ${message} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        count: 0,
        user_id: userId,
        error: `SAP returned ${message}: ${text.slice(0, 200)}`,
      };
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        rows: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        count: 0,
        user_id: userId,
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

    const rows: Record<string, any>[] = arr.map((r) => (r && typeof r === "object" ? { ...r } : {}));

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `material-reservation-fetch: ${message}`,
    });

    return {
      rows,
      fetched_at: new Date().toISOString(),
      count: rows.length,
      user_id: userId,
      error: null as string | null,
    };
  });
