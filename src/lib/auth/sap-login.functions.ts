/**
 * Public server function invoked from the login form.
 * Calls the SAP API named "Login_API" (configured in SAP API Settings) with
 * payload { LOGIN: { USER, PASSWORD } } and returns ok/status only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sapLogin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        username: z.string().min(1).max(200),
        password: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", "Login_API")
      .eq("is_active", true)
      .maybeSingle();

    if (!cfg) {
      return {
        ok: false,
        status: 0,
        error: "Login_API is not configured in SAP API Settings",
      };
    }

    const payload = { LOGIN: { USER: data.username, PASSWORD: data.password } };
    const t0 = Date.now();
    let ok = false;
    let status = 0;
    let message = "";
    let error: string | undefined;

    try {
      if (cfg.auth_type === "proxy") {
        const { invokeViaMiddleware } = await import("@/lib/sap/sap-client.server");
        const res = await invokeViaMiddleware(cfg.id, payload);
        ok = res.ok;
        status = res.status;
        message = res.error ?? `${res.status}`;
        if (!ok) error = res.error ?? `Login failed (${res.status})`;
      } else {
        const { data: g } = await supabaseAdmin
          .from("sap_global_settings")
          .select("sap_base_url, sap_username")
          .eq("id", "default")
          .maybeSingle();
        const { data: gs } = await supabaseAdmin
          .from("sap_global_secrets")
          .select("sap_password")
          .eq("id", "default")
          .maybeSingle();
        const { data: creds } = await supabaseAdmin
          .from("sap_api_credentials")
          .select("extra_headers")
          .eq("config_id", cfg.id)
          .maybeSingle();

        const { resolveSapUrl } = await import("@/lib/sap/url");
        const target = resolveSapUrl(cfg.endpoint_url, g?.sap_base_url ?? null);
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (cfg.auth_type === "basic" && g?.sap_username && gs?.sap_password) {
          headers.Authorization =
            "Basic " + Buffer.from(`${g.sap_username}:${gs.sap_password}`).toString("base64");
        }
        for (const [k, v] of Object.entries(
          (creds?.extra_headers ?? {}) as Record<string, string>,
        )) {
          headers[k] = v;
        }

        const method = (cfg.http_method ?? "POST").toUpperCase();
        const res = await fetch(target, {
          method,
          headers,
          body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(payload),
        });
        status = res.status;
        ok = res.ok;
        message = `${res.status} ${res.statusText}`;
        if (!ok) {
          const text = await res.text().catch(() => "");
          error = `Login failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`;
        }
      }
    } catch (e) {
      message = (e as Error).message;
      error = message;
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms: Date.now() - t0,
      message: `login: ${message}`,
    });

    return { ok, status, error };
  });
