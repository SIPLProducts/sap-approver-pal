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
