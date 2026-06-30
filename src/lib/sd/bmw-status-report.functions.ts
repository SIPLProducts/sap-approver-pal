/**
 * SD BMW Status Report — live SAP fetch via BMW_Status_Report API.
 * Modeled on sales-order-approval.functions.ts (fetch half).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "BMW_Status_Report";

export type BmwStatusRow = Record<string, string | number | null>;

export const fetchBmwStatusReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plants: z.array(z.string().trim().min(1).max(40)).min(1, "Select at least one Sales Organization"),
        selection: z.enum(["customer", "contract", "sales"]),
        customer: z.string().trim().max(40).optional(),
        contract: z.string().trim().max(40).optional(),
        sales_document: z.string().trim().max(40).optional(),
        user_id: z.string().trim().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .ilike("name", CONFIG_NAME)
      .maybeSingle();

    if (!cfg) {
      return {
        rows: [] as BmwStatusRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP API config "${CONFIG_NAME}" is not configured. Add it in Admin → SAP API Settings.`,
      };
    }
    if (!cfg.is_active) {
      return {
        rows: [] as BmwStatusRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP API config "${CONFIG_NAME}" is disabled.`,
      };
    }

    const [{ data: creds }, { data: prof }, { data: globalSettings }, { data: globalSecret }] =
      await Promise.all([
        supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
        supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
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

    const userId =
      (data.user_id && data.user_id.trim()) ||
      (prof?.sap_user_id && prof.sap_user_id.trim()) ||
      "";

    const inputs = {
      PLANT: data.plants.map((p) => ({ plant: p })),
      SELECTION: data.selection.toUpperCase(),
      R_CUST: data.selection === "customer" ? "X" : "",
      R_CONT: data.selection === "contract" ? "X" : "",
      R_SALES: data.selection === "sales" ? "X" : "",
      CUSTOMER: data.selection === "customer" ? (data.customer ?? "").trim() : "",
      CONTRACT: data.selection === "contract" ? (data.contract ?? "").trim() : "",
      SALES_DOCUMENT: data.selection === "sales" ? (data.sales_document ?? "").trim() : "",
      USER_ID: userId,
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "POST";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) {
        return {
          rows: [] as BmwStatusRow[],
          fetched_at: new Date().toISOString(),
          count: 0,
          error: "Proxy mode is on but no middleware URL is configured.",
        };
      }
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
      target = cfg.endpoint_url;
      if (method.toUpperCase() === "GET") {
        const join = cfg.endpoint_url.includes("?") ? "&" : "?";
        const firstPlant = data.plants[0];
        const qs =
          `${join}PLANT=${encodeURIComponent(firstPlant)}` +
          `&SELECTION=${encodeURIComponent(inputs.SELECTION)}` +
          `&CUSTOMER=${encodeURIComponent(inputs.CUSTOMER)}` +
          `&CONTRACT=${encodeURIComponent(inputs.CONTRACT)}` +
          `&SALES_DOCUMENT=${encodeURIComponent(inputs.SALES_DOCUMENT)}` +
          `&USER_ID=${encodeURIComponent(inputs.USER_ID)}`;
        target = cfg.endpoint_url + qs;
      } else {
        headers["Content-Type"] = "application/json";
        bodyOut = JSON.stringify(inputs);
      }
      if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
        headers.Authorization =
          "Basic " +
          Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
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
        message: `bmw-status network: ${errMsg}`,
      });
      return {
        rows: [] as BmwStatusRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Could not reach SAP. ${errMsg}.`,
      };
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `bmw-status: ${res.status} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as BmwStatusRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP returned ${res.status} ${res.statusText}: ${text.slice(0, 200)}`,
      };
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        rows: [] as BmwStatusRow[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Invalid JSON from SAP: ${text.slice(0, 200)}`,
      };
    }

    const sapJson: any = proxied ? (json?.data ?? {}) : json;
    const arr: any[] = Array.isArray(sapJson?.DATA)
      ? sapJson.DATA
      : Array.isArray(sapJson?.data)
        ? sapJson.data
        : Array.isArray(sapJson?.ITEM)
          ? sapJson.ITEM
          : Array.isArray(sapJson)
            ? sapJson
            : [];

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: arr.length,
      message: `bmw-status: ${res.status}`,
    });

    return {
      rows: arr as BmwStatusRow[],
      fetched_at: new Date().toISOString(),
      count: arr.length,
      error: null as string | null,
    };
  });
