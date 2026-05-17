/**
 * Web Push sender (server-only). Uses VAPID. Pulls subscriptions for a user
 * and fires a push to each endpoint. Stale subscriptions (404/410) are
 * pruned automatically.
 */
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:notify@resustainability.local";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string; url?: string; tag?: string },
) {
  try {
    configure();
  } catch (e) {
    console.warn("Push not configured:", (e as Error).message);
    return { sent: 0, removed: 0 };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subs?.length) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  const json = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("Push send failed", status, (err as Error).message);
        }
      }
    }),
  );

  return { sent, removed };
}
