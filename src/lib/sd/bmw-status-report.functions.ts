/**
 * BMW Status Report — read-only SAP report fetch.
 *
 * Calls the SAP API configured as "BMW_Status_Report". Returns raw rows
 * (array of records) so the UI can render whatever columns SAP sends.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "BMW_Status_Report";

export type BmwStatusRow = Record<string, string | number | null>;

export const fetchBmwStatusReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      sales_org_from: z.string().trim().max(10),
      sales_org_to: z.string().trim().max(10),
      customer_from: z.string().trim().max(40).optional().default(""),
      customer_to: z.string().trim().max(40).optional().default(""),
      contract_from: z.string().trim().max(40).optional().default(""),
      contract_to: z.string().trim().max(40).optional().default(""),
      mode: z.enum(["customer", "contract", "sales"]),
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

    const inputs = {
      SALES_ORG_FROM: data.sales_org_from,
      SALES_ORG_TO: data.sales_org_to || data.sales_org_from,
      CUSTOMER_FROM: data.customer_from,
      CUSTOMER_TO: data.customer_to,
      CONTRACT_FROM: data.contract_from,
      CONTRACT_TO: data.contract_to,
      R_CUS: data.mode === "customer" ? "X" : "",
      R_CONT: data.mode === "contract" ? "X" : "",
      R_SALES: data.mode === "sales" ? "X" : "",
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
      target = cfg.endpoint_url.trim();
      headers["Content-Type"] = "application/json";
      if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
        headers.Authorization =
          "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
      }
      bodyOut = JSON.stringify(inputs);
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
        columns: [] as string[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Could not reach SAP: ${errMsg}`,
      };
    }

    const text = await res.text().catch(() => "");
    const latency_ms = Date.now() - t0;
    const message = `${res.status} ${res.statusText}`;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `bmw-status: ${message} ${text.slice(0, 500)}`,
      });
      return {
        rows: [] as BmwStatusRow[],
        columns: [] as string[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `SAP returned ${message}: ${text.slice(0, 200)}`,
      };
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        rows: [] as BmwStatusRow[],
        columns: [] as string[],
        fetched_at: new Date().toISOString(),
        count: 0,
        error: `Invalid JSON from SAP: ${text.slice(0, 200)}`,
      };
    }

    const sapJson: any = proxied ? (json?.data ?? json) : json;
    const arr: any[] = Array.isArray(sapJson?.DATA)
      ? sapJson.DATA
      : Array.isArray(sapJson?.data)
        ? sapJson.data
        : Array.isArray(sapJson)
          ? sapJson
          : [];

    const rows: BmwStatusRow[] = arr.map((r) => {
      const o: BmwStatusRow = {};
      for (const k of Object.keys(r ?? {})) o[k] = (r as any)[k] ?? null;
      return o;
    });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `bmw-status: ${message}`,
    });

    return {
      rows,
      columns,
      fetched_at: new Date().toISOString(),
      count: rows.length,
      error: null as string | null,
    };
  });
