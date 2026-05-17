/**
 * Integration status + test endpoints (admin-only). Never returns secret
 * values — only booleans indicating whether each env var is configured.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { sapEnabled, fetchOpenApprovals } from "@/lib/sap/sap-client.server";
import { sendPushToUser } from "@/lib/push/push.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "Admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const has = (k: string) => Boolean(process.env[k] && process.env[k]!.length > 0);
    return {
      sap: {
        configured: has("SAP_BASE_URL") && has("SAP_USER") && has("SAP_PASSWORD"),
        liveMode: sapEnabled(),
        baseUrlSet: has("SAP_BASE_URL"),
        userSet: has("SAP_USER"),
        passwordSet: has("SAP_PASSWORD"),
        useRealFlag: process.env.SAP_USE_REAL ?? "false",
      },
      push: {
        publicKeySet: has("VAPID_PUBLIC_KEY"),
        privateKeySet: has("VAPID_PRIVATE_KEY"),
        subjectSet: has("VAPID_SUBJECT"),
        publicKey: process.env.VAPID_PUBLIC_KEY ?? "", // public by design
      },
      cron: {
        secretSet: has("CRON_SECRET"),
      },
    };
  });

export const testSapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    if (!process.env.SAP_BASE_URL || !process.env.SAP_USER || !process.env.SAP_PASSWORD) {
      return { ok: false, message: "SAP credentials not configured" };
    }
    try {
      const items = await fetchOpenApprovals();
      return { ok: true, message: `Connected. Pulled ${items.length} open document(s).` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const target = data.userId ?? context.userId;
    const res = await sendPushToUser(target, {
      title: "Test push from Resustainability Approvals",
      body: "If you can read this, web push is working end-to-end.",
      url: "/inbox",
      tag: "test-push",
    });
    return res;
  });
