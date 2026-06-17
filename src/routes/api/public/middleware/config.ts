/**
 * Public endpoint called by the standalone SAP middleware (Node.js/Express
 * service running on a customer's machine) to load a SAP API configuration.
 *
 * Protected by a shared secret header (x-shared-secret) that must match the
 * MIDDLEWARE_SHARED_SECRET env on the app side AND the middleware's .env.
 *
 * The middleware NEVER talks to Supabase directly — it goes through this
 * route, which uses the service-role admin client server-side. This keeps
 * SAP credentials behind RLS (anon key cannot read sap_api_credentials).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-shared-secret",
};

function checkSecret(req: Request): boolean {
  const expected = process.env.MIDDLEWARE_SHARED_SECRET;
  const got = req.headers.get("x-shared-secret");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const Body = z.union([
  z.object({ configId: z.string().uuid() }),
  z.object({ name: z.string().min(1).max(120) }),
]);

export const Route = createFileRoute("/api/public/middleware/config")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        if (!checkSecret(request)) {
          return Response.json(
            { ok: false, error: "Invalid or missing x-shared-secret" },
            { status: 401, headers: CORS },
          );
        }

        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message ?? "Invalid body" },
            { status: 400, headers: CORS },
          );
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const lookupKey = "configId" in parsed ? parsed.configId : parsed.name;
        const lookupCol = "configId" in parsed ? "id" : "name";

        const { data: cfg, error } = await supabaseAdmin
          .from("sap_api_configs")
          .select("*")
          .eq(lookupCol, lookupKey)
          .maybeSingle();

        if (error) {
          return Response.json(
            { ok: false, error: `Load config failed: ${error.message}` },
            { status: 500, headers: CORS },
          );
        }
        if (!cfg) {
          return Response.json(
            { ok: false, error: `Config not found: ${lookupKey}` },
            { status: 404, headers: CORS },
          );
        }
        if (!cfg.is_active) {
          return Response.json(
            { ok: false, error: `Config is inactive: ${lookupKey}` },
            { status: 409, headers: CORS },
          );
        }

        const [credsRes, reqFieldsRes, resFieldsRes, globalRes, globalSecretRes] = await Promise.all([
          supabaseAdmin
            .from("sap_api_credentials")
            .select("*")
            .eq("config_id", cfg.id)
            .maybeSingle(),
          supabaseAdmin
            .from("sap_api_request_fields")
            .select("*")
            .eq("config_id", cfg.id)
            .order("sort_order"),
          supabaseAdmin
            .from("sap_api_response_fields")
            .select("*")
            .eq("config_id", cfg.id)
            .order("sort_order"),
          supabaseAdmin
            .from("sap_global_settings")
            .select("sap_base_url, sap_username")
            .eq("id", "default")
            .maybeSingle(),
          supabaseAdmin
            .from("sap_global_secrets")
            .select("sap_password")
            .eq("id", "default")
            .maybeSingle(),
        ]);

        const creds = credsRes.data;
        const { resolveSapUrl } = await import("@/lib/sap/url");
        let resolvedUrl: string | null = null;
        try {
          resolvedUrl = resolveSapUrl(cfg.endpoint_url, globalRes.data?.sap_base_url ?? null);
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 422, headers: CORS },
          );
        }
        const nonEmpty = (v: string | null | undefined) =>
          typeof v === "string" && v.trim() !== "" ? v : null;
        const perCfgUser = nonEmpty(creds?.username);
        const perCfgPass = nonEmpty(creds?.password_encrypted);
        const globalUser = nonEmpty(globalRes.data?.sap_username);
        const globalPass = nonEmpty(globalSecretRes.data?.sap_password);
        // Pair semantics: only use the per-config pair when a username was
        // actually entered for this config. A standalone per-config password
        // must NOT be paired with the global username (that produces 401).
        const useOverride = perCfgUser !== null;
        const username = useOverride ? perCfgUser : globalUser;
        const password = useOverride ? perCfgPass : globalPass;
        const resolved = {
          id: cfg.id,
          name: cfg.name,
          module: cfg.module,
          endpoint_url: resolvedUrl,
          http_method: cfg.http_method,
          auth_type: cfg.auth_type,
          is_active: cfg.is_active,
          updated_at: cfg.updated_at,
          credentials: {
            username,
            password,
            extra_headers: creds?.extra_headers ?? {},
          },
          requestFields: reqFieldsRes.data ?? [],
          responseFields: resFieldsRes.data ?? [],
        };


        return Response.json({ ok: true, config: resolved }, { headers: CORS });
      },
    },
  },
});
