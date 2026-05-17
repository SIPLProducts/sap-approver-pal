/**
 * Public cron endpoint: pg_cron calls this every few minutes to pull open
 * approvals from SAP. Protected by a shared secret header (CRON_SECRET) so
 * casual visitors can't trigger a sync.
 *
 * NOTE: When SAP_USE_REAL is not "true", this still runs and refreshes mock
 * data, which is fine for demos.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sapEnabled,
  fetchOpenApprovals,
  type SapApprovalItem,
} from "@/lib/sap/sap-client.server";
import { sendPushToUser } from "@/lib/push/push.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-cron-secret",
};

export const Route = createFileRoute("/api/public/hooks/sap-sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const header = request.headers.get("x-cron-secret");
        if (!secret || header !== secret) {
          return new Response("Unauthorized", { status: 401, headers: CORS });
        }

        if (!sapEnabled()) {
          return Response.json(
            { ok: true, skipped: "SAP_USE_REAL=false" },
            { headers: CORS },
          );
        }

        const items: SapApprovalItem[] = await fetchOpenApprovals();

        // Build role -> [user_id] map once
        const { data: roleRows } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, role");
        const roleMap = new Map<string, string[]>();
        for (const r of roleRows ?? []) {
          const list = roleMap.get(r.role) ?? [];
          list.push(r.user_id);
          roleMap.set(r.role, list);
        }

        let inserted = 0;
        for (const it of items) {
          const { data: existing } = await supabaseAdmin
            .from("approval_documents")
            .select("id")
            .eq("doc_type", it.doc_type as any)
            .eq("sap_doc_no", it.sap_doc_no)
            .maybeSingle();
          if (existing) continue;

          const { data: doc } = await supabaseAdmin
            .from("approval_documents")
            .insert({
              module: it.module,
              doc_type: it.doc_type as any,
              sap_t_code: it.sap_t_code,
              sap_doc_no: it.sap_doc_no,
              title: it.title,
              description: it.description ?? null,
              plant: it.plant ?? null,
              business_unit: it.business_unit ?? null,
              company_code: it.company_code ?? null,
              vendor_name: it.vendor_name ?? null,
              customer_name: it.customer_name ?? null,
              requester_name: it.requester_name,
              requester_sap_id: it.requester_sap_id ?? null,
              total_value: it.total_value,
              currency: it.currency || "INR",
              document_date: it.document_date,
              current_step_seq: 1,
              status: "pending" as const,
              sap_payload: { source: "SAP_CRON", t_code: it.sap_t_code },
            })
            .select()
            .single();
          if (!doc) continue;
          inserted++;

          if (it.lines?.length) {
            await supabaseAdmin.from("approval_line_items").insert(
              it.lines.map((l) => ({ ...l, document_id: doc.id })),
            );
          }

          const steps = it.steps.map((s, idx) => ({
            document_id: doc.id,
            seq: s.seq,
            role: s.role as any,
            assigned_user: (roleMap.get(s.role) ?? [])[0] ?? null,
            status: (idx === 0 ? "pending" : "waiting") as any,
          }));
          await supabaseAdmin.from("approval_steps").insert(steps);

          const firstAssignee = steps[0]?.assigned_user;
          if (firstAssignee) {
            await supabaseAdmin.from("notifications").insert({
              user_id: firstAssignee,
              document_id: doc.id,
              title: `New approval: ${doc.sap_doc_no}`,
              body: `${doc.title} — ₹${Number(doc.total_value).toLocaleString("en-IN")}`,
              kind: "assignment",
            });
            await sendPushToUser(firstAssignee, {
              title: `New approval: ${doc.sap_doc_no}`,
              body: doc.title,
              url: `/approval/${doc.id}`,
              tag: `doc-${doc.id}`,
            });
          }
        }

        return Response.json(
          { ok: true, inserted, pulled: items.length },
          { headers: CORS },
        );
      },
    },
  },
});
