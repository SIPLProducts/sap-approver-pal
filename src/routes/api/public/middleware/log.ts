/**
 * Public endpoint called by the standalone SAP middleware to insert a
 * sync-log row. Same shared-secret gate as /config.
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

const Body = z.object({
  configId: z.string().uuid(),
  status: z.enum(["ok", "error"]),
  latency_ms: z.number().int().nonnegative().optional(),
  message: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/public/middleware/log")({
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

        const { error } = await supabaseAdmin
          .from("sap_api_sync_log")
          .insert({
            config_id: parsed.configId,
            status: parsed.status,
            latency_ms: parsed.latency_ms ?? null,
            message: parsed.message ?? null,
          });

        if (error) {
          return Response.json(
            { ok: false, error: error.message },
            { status: 500, headers: CORS },
          );
        }
        return Response.json({ ok: true }, { headers: CORS });
      },
    },
  },
});
