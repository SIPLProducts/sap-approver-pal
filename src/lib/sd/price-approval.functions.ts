/**
 * SD Price Approvals — live SAP fetch via the configured Price_Approval_Fetch API.
 * Reads the admin-managed sap_api_configs row, calls the SAP endpoint
 * (basic or proxy auth), and returns the DATA[] rows as plain DTOs.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PriceRow = {
  select_flg: string | null;
  key_combination: string | null;
  condition_type: string | null;
  customer: string | null;
  price_group: string | null;
  plant: string | null;
  material: string | null;
  new_price: string | number | null;
  currency: string | null;
  uom: string | null;
  calculation_sc: string | null;
  valid_from_sc: string | null;
  valid_to_sc: string | null;
  old_price: string | number | null;
};

const CONFIG_NAME = "Price_Approval_Fetch";

function pick(o: any, k: string) {
  if (!o || typeof o !== "object") return null;
  // case-insensitive lookup
  const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit ? (o[hit] ?? null) : null;
}

function mapRow(raw: any): PriceRow {
  return {
    select_flg: pick(raw, "SELECT_FLG"),
    key_combination: pick(raw, "KEY_COMBINATION"),
    condition_type: pick(raw, "CONDITION_TYPE"),
    customer: pick(raw, "CUSTOMER"),
    price_group: pick(raw, "PRICE_GROUP"),
    plant: pick(raw, "PLANT"),
    material: pick(raw, "MATERIAL"),
    new_price: pick(raw, "NEW_PRICE"),
    currency: pick(raw, "CURRENCY"),
    uom: pick(raw, "UOM"),
    calculation_sc: pick(raw, "CALCULATION_SC"),
    valid_from_sc: pick(raw, "VALID_FROM_SC"),
    valid_to_sc: pick(raw, "VALID_TO_SC"),
    old_price: pick(raw, "OLD_PRICE"),
  };
}

export const getMySapUserId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("sap_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    // Fall back to the request-field default on the Price_Approval_Fetch config.
    let fallback: string | null = null;
    if (!data?.sap_user_id) {
      const { data: cfg } = await supabaseAdmin
        .from("sap_api_configs")
        .select("id")
        .eq("name", CONFIG_NAME)
        .maybeSingle();
      if (cfg) {
        const { data: f } = await supabaseAdmin
          .from("sap_api_request_fields")
          .select("default_value")
          .eq("config_id", cfg.id)
          .eq("field_name", "USER_ID")
          .maybeSingle();
        fallback = (f?.default_value as string | null) ?? null;
      }
    }
    return { sap_user_id: data?.sap_user_id ?? fallback ?? "" };
  });

export const fetchPriceApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      plant: z.string().min(1, "Plant is required").max(40),
      user_id: z.string().trim().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${CONFIG_NAME}" is disabled.`);

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

    const userId =
      (data.user_id && data.user_id.trim()) ||
      (prof?.sap_user_id && prof.sap_user_id.trim()) ||
      (userIdField?.default_value as string | null) ||
      "NEOBMWCONS";

    // Build target URL — endpoint already has ?sap-client=300, so append &.
    const join = cfg.endpoint_url.includes("?") ? "&" : "?";
    const qs = `${join}PLANT=${encodeURIComponent(data.plant)}&USER_ID=${encodeURIComponent(userId)}`;

    // Decide whether to proxy. Either:
    //   - per-config auth_type === 'proxy' (legacy), OR
    //   - global connection_mode === 'via_proxy' AND a middleware URL is set.
    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url || cfg.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      (cfg.middleware_url && cfg.middleware_url.trim()) ||
      (globalSettings?.middleware_url?.trim() ?? null);

    let target: string;
    let method: string = cfg.http_method ?? "GET";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      // Route through the middleware's named alias so the middleware log
      // clearly shows which business call ran (e.g. POST /price_approval/Fetch).
      target = `${middlewareUrl.replace(/\/$/, "")}/price_approval/Fetch`;
      method = "POST";
      headers["Content-Type"] = "application/json";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({
        inputs: { PLANT: data.plant, USER_ID: userId },
      });
      proxied = true;
    } else {
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
    let rows: PriceRow[] = [];
    let message = "";
    let res: Response;
    try {
      res = await fetch(target, { method, headers, body: bodyOut });

      // Fallback: older middleware doesn't have /price_approval/Fetch yet.
      // Express returns 404 "Cannot POST /price_approval/Fetch". Retry the
      // generic /sap/invoke route so the user doesn't need to redeploy first.
      if (proxied && res.status === 404) {
        const peek = await res.clone().text().catch(() => "");
        if (/Cannot\s+POST/i.test(peek)) {
          const fallback = `${middlewareUrl!.replace(/\/$/, "")}/sap/invoke`;
          res = await fetch(fallback, {
            method: "POST",
            headers,
            body: JSON.stringify({
              configId: cfg.id,
              inputs: { PLANT: data.plant, USER_ID: userId },
            }),
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
        message: `price-fetch network: ${errMsg}`,
      });
      // Friendly error — the SAP host is unreachable from this environment
      // (typical when the endpoint is on a private/VPN network).
      return {
        rows: [] as PriceRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        user_id: userId,
        error: `Could not reach SAP at ${cfg.endpoint_url.split("?")[0]}. ${errMsg}. The endpoint may be on a private network not accessible from this server.`,
      };
    }

    const text = await res.text().catch(() => "");
    message = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      if (proxied && res.status === 404 && /Cannot\s+POST/i.test(text)) {
        message = `Middleware is outdated — copy the latest middleware/server.js and restart it (${res.status})`;
      }
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `price-fetch: ${message} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as PriceRow[],
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
        rows: [] as PriceRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        user_id: userId,
        error: `Invalid JSON from SAP: ${text.slice(0, 200)}`,
      };
    }
    // When proxied through the middleware, the actual SAP payload is in json.data
    // (middleware wraps as { ok, status, latency_ms, data }). Unwrap it.
    const sapJson: any = proxied ? (json?.data ?? {}) : json;
    const arr: any[] = Array.isArray(sapJson?.DATA)
      ? sapJson.DATA
      : Array.isArray(sapJson?.data)
        ? sapJson.data
        : Array.isArray(sapJson)
          ? sapJson
          : [];

    rows = arr.map(mapRow);

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `price-fetch: ${message}`,
    });

    return { rows, fetched_at: new Date().toISOString(), count: rows.length, user_id: userId, error: null as string | null };
  });

const DECISION_CONFIG_NAME = "Price_Approve_Reject";

const PriceRowSchema = z.object({
  select_flg: z.string().nullable().optional(),
  key_combination: z.string().nullable().optional(),
  condition_type: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  price_group: z.string().nullable().optional(),
  plant: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  new_price: z.union([z.string(), z.number()]).nullable().optional(),
  currency: z.string().nullable().optional(),
  uom: z.string().nullable().optional(),
  calculation_sc: z.string().nullable().optional(),
  valid_from_sc: z.string().nullable().optional(),
  valid_to_sc: z.string().nullable().optional(),
  old_price: z.union([z.string(), z.number()]).nullable().optional(),
});

function toSapRow(r: z.infer<typeof PriceRowSchema>) {
  return {
    SELECT_FLG: "X",
    KEY_COMBINATION: str(r.key_combination),
    CONDITION_TYPE: str(r.condition_type),
    CUSTOMER: padCustomer(r.customer),
    PRICE_GROUP: str(r.price_group),
    PLANT: str(r.plant),
    MATERIAL: str(r.material),
    NEW_PRICE: str(r.new_price),
    CURRENCY: str(r.currency),
    UOM: str(r.uom),
    CALCULATION_SC: str(r.calculation_sc),
    VALID_FROM_SC: str(r.valid_from_sc),
    VALID_TO_SC: str(r.valid_to_sc),
    OLD_PRICE: str(r.old_price),
  };
}

// SAP's JSON deserializer dumps on type mismatches — every value must be a
// string, exactly like the sample payload imported in SAP API Settings.
function str(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}

// SAP customer numbers are 10-char zero-padded (e.g. "0001061570").
function padCustomer(v: string | number | null | undefined): string {
  const s = str(v).trim();
  return s && /^\d+$/.test(s) ? s.padStart(10, "0") : s;
}

export const submitPriceDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      action: z.enum(["accepted", "rejected"]),
      rows: z.array(PriceRowSchema).min(1, "Select at least one row"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", DECISION_CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${DECISION_CONFIG_NAME}" not found.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${DECISION_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const sapPayload = {
      APPROV: data.action === "accepted" ? "X" : "",
      REJ: data.action === "rejected" ? "X" : "",
      DATA: data.rows.map(toSapRow),
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url || cfg.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl =
      (cfg.middleware_url && cfg.middleware_url.trim()) ||
      (globalSettings?.middleware_url?.trim() ?? null);

    let target: string;
    let method: string = cfg.http_method ?? "PUT";
    let bodyOut: string;
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/price_approval/Price_Approve_Reject`;
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

    const t0 = Date.now();
    console.log("[submitPriceDecision] target=", target, "method=", method, "proxied=", proxied, "payload=", sapPayload);
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
      console.error("[submitPriceDecision] network error", errMsg);
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `price-decision ${data.action}: network ${errMsg}`,
      });
      throw new Error(`Could not reach SAP: ${errMsg}`);
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;
    console.log("[submitPriceDecision] status=", res.status, "latency_ms=", latency_ms, "body=", text.slice(0, 1000));

    if (!res.ok) {
      // Try to extract SAP's real error from middleware envelope { ok, status, data }
      let upstream = "";
      try {
        const j = JSON.parse(text);
        if (j?.error) upstream = String(j.error);
        else if (j?.data) upstream = typeof j.data === "string" ? j.data : JSON.stringify(j.data);
      } catch { /* ignore */ }
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `price-decision ${data.action}: ${res.status} ${text.slice(0, 500)}`,
      });
      throw new Error(`SAP returned ${res.status} ${res.statusText}: ${upstream || text.slice(0, 300)}`);
    }

    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: data.rows.length,
      message: `price-decision ${data.action}: ${res.status}`,
    });

    return { ok: true, action: data.action, count: data.rows.length, sap_response: json };
  });

