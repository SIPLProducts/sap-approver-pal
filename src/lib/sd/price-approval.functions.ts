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
  .inputValidator((d) => z.object({ plant: z.string().min(1, "Plant is required").max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: prof }, { data: userIdField }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("sap_api_request_fields")
        .select("default_value")
        .eq("config_id", cfg.id)
        .eq("field_name", "USER_ID")
        .maybeSingle(),
    ]);

    const userId =
      (prof?.sap_user_id && prof.sap_user_id.trim()) ||
      (userIdField?.default_value as string | null) ||
      "NEOBMWCONS";

    // Build target URL — endpoint already has ?sap-client=300, so append &.
    const join = cfg.endpoint_url.includes("?") ? "&" : "?";
    const qs = `${join}PLANT=${encodeURIComponent(data.plant)}&USER_ID=${encodeURIComponent(userId)}`;

    let target: string;
    const headers: Record<string, string> = { Accept: "application/json" };

    if (cfg.auth_type === "proxy") {
      if (!cfg.middleware_url) throw new Error("Proxy mode requires middleware_url.");
      target = `${cfg.middleware_url.replace(/\/$/, "")}/proxy?upstream=${encodeURIComponent(cfg.endpoint_url + qs)}`;
      if (cfg.proxy_secret_ref) {
        const secret = process.env[cfg.proxy_secret_ref];
        if (secret) headers["x-shared-secret"] = secret;
      }
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
      res = await fetch(target, { method: cfg.http_method ?? "GET", headers });
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
    const arr: any[] = Array.isArray(json?.DATA)
      ? json.DATA
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
          ? json
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

