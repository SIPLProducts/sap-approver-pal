/**
 * MM Service Entry Sheet (ML81N / ENTRY_REL) — live SAP fetch.
 * Config: SES_FETCH_API
 * Returns: { data: rows[], recordsFetched, message, fetched_at, error }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  extractFalseStatusMessage,
  extractMessagesArrayError,
  extractSapMessage,
} from "@/lib/mm/sap-message";

const CONFIG_NAME = "SES_FETCH_API";

const str = z.string().trim().max(60).optional().default("");

export const fetchServiceEntrySheetPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        releaseCode: z.string().trim().min(1, "Release Code is required").max(10),
        releaseGroup: str,
        releaseFilter: z.enum(["SET_RELEASE", "CANCEL_RELEASE"]).optional().default("SET_RELEASE"),
        poFrom: str,
        poTo: str,
        docDateFrom: str,
        docDateTo: str,
        purchOrgFrom: str,
        purchOrgTo: str,
        purchGroupFrom: str,
        purchGroupTo: str,
        plantFrom: str,
        plantTo: str,
        matGroupFrom: str,
        matGroupTo: str,
        entrySheetFrom: str,
        entrySheetTo: str,
        blockedFilter: z.enum(["BLOCKED", "NOT_BLOCKED", "ALL"]).optional().default("ALL"),
        acceptedFilter: z.enum(["ACCEPTED", "NOT_ACCEPTED", "ALL"]).optional().default("ALL"),
        scopeOfList: str,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const empty = (error: string | null, message = "") => ({
      data: [] as Record<string, any>[],
      recordsFetched: 0,
      message,
      fetched_at: new Date().toISOString(),
      error,
    });

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      return empty(
        `SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API Settings.`,
      );
    if (!cfg.is_active) return empty(`SAP API config "${CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const toSapDate = (v: string) => {
      const t = (v ?? "").trim();
      if (!t) return "";
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
      return m ? `${m[1]}${m[2]}${m[3]}` : t.replace(/\D/g, "");
    };

    const inputs: Record<string, string> = {
      ACTION: "GET_PENDING",
      RELEASE_CODE: data.releaseCode,
      RELEASE_GROUP_FROM: data.releaseGroup,
      RELEASE_GROUP_TO: "",
      RELEASE_FILTER: data.releaseFilter,
      PO_FROM: data.poFrom,
      PO_TO: data.poTo,
      DOCUMENT_DATE_FROM: toSapDate(data.docDateFrom),
      DOCUMENT_DATE_TO: toSapDate(data.docDateTo),
      PURCHASING_ORG_FROM: data.purchOrgFrom,
      PURCHASING_ORG_TO: data.purchOrgTo,
      PURCHASING_GROUP_FROM: data.purchGroupFrom,
      PURCHASING_GROUP_TO: data.purchGroupTo,
      PLANT_FROM: data.plantFrom,
      PLANT_TO: data.plantTo,
      MATERIAL_GROUP_FROM: data.matGroupFrom,
      MATERIAL_GROUP_TO: data.matGroupTo,
      ENTRY_SHEET_FROM: data.entrySheetFrom,
      ENTRY_SHEET_TO: data.entrySheetTo,
      BLOCKED_FILTER: data.blockedFilter,
      ACCEPTED_FILTER: data.acceptedFilter,
      SCOPE_OF_LIST: data.scopeOfList,
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
      if (!middlewareUrl) return empty("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
      method = "POST";
      headers["Content-Type"] = "application/json";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env["MIDDLEWARE_SHARED_SECRET"];
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs });
      proxied = true;
    } else {
      target = cfg.endpoint_url;
      headers["Content-Type"] = "application/json";
      method = "POST";
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
        message: `ses-fetch network: ${errMsg}`,
      });
      return empty(`Could not reach SAP. ${errMsg}.`);
    }

    const text = await res.text().catch(() => "");
    const statusLine = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `ses-fetch: ${statusLine} ${text.slice(0, 500)}`,
      });
      return empty(`SAP returned ${statusLine}: ${text.slice(0, 200)}`);
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return empty(`Invalid JSON from SAP: ${text.slice(0, 200)}`);
    }
    const sapJson: any = proxied ? (json?.data ?? json ?? {}) : json;

    const sapError =
      extractFalseStatusMessage(sapJson) || extractMessagesArrayError(sapJson) || null;
    if (sapError) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `ses-fetch: ${sapError.slice(0, 500)}`,
      });
      return empty(sapError);
    }

    const dataArr: any[] = Array.isArray(sapJson)
      ? sapJson
      : Array.isArray(sapJson?.DATA)
        ? sapJson.DATA
        : Array.isArray(sapJson?.data)
          ? sapJson.data
          : [];

    const rows: Record<string, any>[] = dataArr.map((r) =>
      r && typeof r === "object" ? { ...r } : {},
    );

    const sapMessage =
      (typeof sapJson?.message === "string" && sapJson.message.trim()) ||
      extractSapMessage(sapJson) ||
      "";

    const recordsFetched =
      typeof sapJson?.recordsFetched === "number" ? sapJson.recordsFetched : rows.length;

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `ses-fetch: ${statusLine}`,
    });

    return {
      data: rows,
      recordsFetched,
      message: sapMessage,
      fetched_at: new Date().toISOString(),
      error: null as string | null,
    };
  });

/** SES release (SES_RELEASE_API) — one call per selected entry sheet. */
const RELEASE_CONFIG_NAME = "SES_RELEASE_API";

export const releaseServiceEntrySheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z
          .array(
            z.object({
              entrySheet: z.string().trim().min(1).max(20),
              releaseCode: z.string().trim().min(1).max(10),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type Result = { entrySheet: string; ok: boolean; message: string };
    const fail = (error: string) => ({ results: [] as Result[], error });

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", RELEASE_CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      return fail(
        `SAP API config "${RELEASE_CONFIG_NAME}" not found. Configure it in Admin → SAP API Settings.`,
      );
    if (!cfg.is_active) return fail(`SAP API config "${RELEASE_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;
    if (useProxy && !middlewareUrl)
      return fail("Proxy mode is on but no middleware URL is configured.");

    const baseHeaders: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (useProxy) {
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env["MIDDLEWARE_SHARED_SECRET"];
      if (secret) baseHeaders["x-shared-secret"] = secret;
    } else if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
      baseHeaders.Authorization =
        "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
    }
    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      baseHeaders[k] = v;
    }

    const target = useProxy
      ? `${middlewareUrl!.replace(/\/$/, "")}/sap/invoke`
      : cfg.endpoint_url;

    const results: Result[] = [];

    for (const item of data.items) {
      const inputs: Record<string, string> = {
        ACTION: "RELEASE",
        ENTRY_SHEET: item.entrySheet,
        RELEASE_CODE: item.releaseCode,
      };
      const body = useProxy
        ? JSON.stringify({ configId: cfg.id, inputs })
        : JSON.stringify(inputs);

      const t0 = Date.now();
      let res: Response;
      try {
        res = await fetch(target, { method: "POST", headers: baseHeaders, body });
      } catch (e) {
        const errMsg = (e as Error).message || "fetch failed";
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms: Date.now() - t0,
          message: `ses-release network: ${errMsg}`,
        });
        results.push({ entrySheet: item.entrySheet, ok: false, message: `Could not reach SAP. ${errMsg}.` });
        continue;
      }

      const text = await res.text().catch(() => "");
      const latency_ms = Date.now() - t0;

      if (!res.ok) {
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms,
          message: `ses-release: ${res.status} ${res.statusText} ${text.slice(0, 500)}`,
        });
        results.push({
          entrySheet: item.entrySheet,
          ok: false,
          message: `SAP returned ${res.status} ${res.statusText}: ${text.slice(0, 300)}`,
        });
        continue;
      }

      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        results.push({ entrySheet: item.entrySheet, ok: false, message: text.slice(0, 300) || "Invalid JSON from SAP." });
        continue;
      }
      const sapJson: any = useProxy ? (json?.data ?? json ?? {}) : json;

      // Success array form: [{ status: true, message, code, entrySheet }]
      const first = Array.isArray(sapJson) ? sapJson[0] : sapJson;
      const entrySheet =
        (typeof first?.entrySheet === "string" && first.entrySheet) ||
        (typeof first?.ENTRY_SHEET === "string" && first.ENTRY_SHEET) ||
        item.entrySheet;

      const okFlag =
        first?.status === true ||
        first?.success === true ||
        String(first?.status ?? "").toUpperCase() === "TRUE";

      const message =
        (typeof first?.message === "string" && first.message.trim()) ||
        extractFalseStatusMessage(sapJson) ||
        extractMessagesArrayError(sapJson) ||
        extractSapMessage(sapJson) ||
        text.slice(0, 300);

      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: okFlag ? "ok" : "error",
        latency_ms,
        rows_processed: 1,
        message: `ses-release ${item.entrySheet}: ${String(message).slice(0, 400)}`,
      });

    results.push({ entrySheet, ok: !!okFlag, message: String(message || "") });
  }

  return { results, error: null as string | null };
});

/** SES reject (SES_REJECT_API) — one call per selected entry sheet. */
const REJECT_CONFIG_NAME = "SES_REJECT_API";

export const rejectServiceEntrySheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z
          .array(
            z.object({
              entrySheet: z.string().trim().min(1).max(20),
              releaseCode: z.string().trim().min(1).max(10),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type Result = { entrySheet: string; ok: boolean; message: string };
    const fail = (error: string) => ({ results: [] as Result[], error });

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", REJECT_CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      return fail(
        `SAP API config "${REJECT_CONFIG_NAME}" not found. Configure it in Admin → SAP API Settings.`,
      );
    if (!cfg.is_active) return fail(`SAP API config "${REJECT_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;
    if (useProxy && !middlewareUrl)
      return fail("Proxy mode is on but no middleware URL is configured.");

    const baseHeaders: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (useProxy) {
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env["MIDDLEWARE_SHARED_SECRET"];
      if (secret) baseHeaders["x-shared-secret"] = secret;
    } else if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
      baseHeaders.Authorization =
        "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
    }
    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      baseHeaders[k] = v;
    }

    const target = useProxy
      ? `${middlewareUrl!.replace(/\/$/, "")}/sap/invoke`
      : cfg.endpoint_url;

    const results: Result[] = [];

    for (const item of data.items) {
      const inputs: Record<string, string> = {
        ACTION: "UNRELEASE",
        ENTRY_SHEET: item.entrySheet,
        RELEASE_CODE: item.releaseCode,
      };
      const body = useProxy
        ? JSON.stringify({ configId: cfg.id, inputs })
        : JSON.stringify(inputs);

      const t0 = Date.now();
      let res: Response;
      try {
        res = await fetch(target, { method: "POST", headers: baseHeaders, body });
      } catch (e) {
        const errMsg = (e as Error).message || "fetch failed";
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms: Date.now() - t0,
          message: `ses-reject network: ${errMsg}`,
        });
        results.push({ entrySheet: item.entrySheet, ok: false, message: `Could not reach SAP. ${errMsg}.` });
        continue;
      }

      const text = await res.text().catch(() => "");
      const latency_ms = Date.now() - t0;

      if (!res.ok) {
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms,
          message: `ses-reject: ${res.status} ${res.statusText} ${text.slice(0, 500)}`,
        });
        results.push({
          entrySheet: item.entrySheet,
          ok: false,
          message: `SAP returned ${res.status} ${res.statusText}: ${text.slice(0, 300)}`,
        });
        continue;
      }

      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        results.push({ entrySheet: item.entrySheet, ok: false, message: text.slice(0, 300) || "Invalid JSON from SAP." });
        continue;
      }
      const sapJson: any = useProxy ? (json?.data ?? json ?? {}) : json;

      // Success array form: [{ status: true, message, code, entrySheet }]
      const first = Array.isArray(sapJson) ? sapJson[0] : sapJson;
      const entrySheet =
        (typeof first?.entrySheet === "string" && first.entrySheet) ||
        (typeof first?.ENTRY_SHEET === "string" && first.ENTRY_SHEET) ||
        item.entrySheet;

      const okFlag =
        first?.status === true ||
        first?.success === true ||
        String(first?.status ?? "").toUpperCase() === "TRUE";

      const message =
        (typeof first?.message === "string" && first.message.trim()) ||
        extractFalseStatusMessage(sapJson) ||
        extractMessagesArrayError(sapJson) ||
        extractSapMessage(sapJson) ||
        text.slice(0, 300);

      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: okFlag ? "ok" : "error",
        latency_ms,
        rows_processed: 1,
        message: `ses-reject ${item.entrySheet}: ${String(message).slice(0, 400)}`,
      });

    return { results, error: null as string | null };
  });

/** SES delete (SES_DELETE_API) — one call per selected entry sheet. */
const DELETE_CONFIG_NAME = "SES_DELETE_API";

export const deleteServiceEntrySheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z
          .array(
            z.object({
              entrySheet: z.string().trim().min(1).max(20),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type Result = { entrySheet: string; ok: boolean; message: string };
    const fail = (error: string) => ({ results: [] as Result[], error });

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", DELETE_CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      return fail(
        `SAP API config "${DELETE_CONFIG_NAME}" not found. Configure it in Admin → SAP API Settings.`,
      );
    if (!cfg.is_active) return fail(`SAP API config "${DELETE_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;
    if (useProxy && !middlewareUrl)
      return fail("Proxy mode is on but no middleware URL is configured.");

    const baseHeaders: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (useProxy) {
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env["MIDDLEWARE_SHARED_SECRET"];
      if (secret) baseHeaders["x-shared-secret"] = secret;
    } else if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
      baseHeaders.Authorization =
        "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
    }
    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      baseHeaders[k] = v;
    }

    const target = useProxy
      ? `${middlewareUrl!.replace(/\/$/, "")}/sap/invoke`
      : cfg.endpoint_url;

    const results: Result[] = [];

    for (const item of data.items) {
      const inputs: Record<string, string> = {
        ACTION: "delete",
        ENTRY_SHEET: item.entrySheet,
      };
      const body = useProxy
        ? JSON.stringify({ configId: cfg.id, inputs })
        : JSON.stringify(inputs);

      const t0 = Date.now();
      let res: Response;
      try {
        res = await fetch(target, { method: "POST", headers: baseHeaders, body });
      } catch (e) {
        const errMsg = (e as Error).message || "fetch failed";
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms: Date.now() - t0,
          message: `ses-delete network: ${errMsg}`,
        });
        results.push({ entrySheet: item.entrySheet, ok: false, message: `Could not reach SAP. ${errMsg}.` });
        continue;
      }

      const text = await res.text().catch(() => "");
      const latency_ms = Date.now() - t0;

      if (!res.ok) {
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms,
          message: `ses-delete: ${res.status} ${res.statusText} ${text.slice(0, 500)}`,
        });
        results.push({
          entrySheet: item.entrySheet,
          ok: false,
          message: `SAP returned ${res.status} ${res.statusText}: ${text.slice(0, 300)}`,
        });
        continue;
      }

      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        results.push({ entrySheet: item.entrySheet, ok: false, message: text.slice(0, 300) || "Invalid JSON from SAP." });
        continue;
      }
      const sapJson: any = useProxy ? (json?.data ?? json ?? {}) : json;

      // Success array form: [{ status: true, message, code, entrySheet }]
      const first = Array.isArray(sapJson) ? sapJson[0] : sapJson;
      const entrySheet =
        (typeof first?.entrySheet === "string" && first.entrySheet) ||
        (typeof first?.ENTRY_SHEET === "string" && first.ENTRY_SHEET) ||
        item.entrySheet;

      const okFlag =
        first?.status === true ||
        first?.success === true ||
        String(first?.status ?? "").toUpperCase() === "TRUE";

      const message =
        (typeof first?.message === "string" && first.message.trim()) ||
        extractFalseStatusMessage(sapJson) ||
        extractMessagesArrayError(sapJson) ||
        extractSapMessage(sapJson) ||
        text.slice(0, 300);

      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: okFlag ? "ok" : "error",
        latency_ms,
        rows_processed: 1,
        message: `ses-delete ${item.entrySheet}: ${String(message).slice(0, 400)}`,
      });

      results.push({ entrySheet, ok: !!okFlag, message: String(message || "") });
    }

    return { results, error: null as string | null };
  });


