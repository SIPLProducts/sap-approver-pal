/**
 * SAP integration layer.
 *
 * Phase 1: returns deterministic mock data for each T-code.
 * Phase 2: each function will swap to a real OData / Z-service fetch against
 *          SAP Gateway (URL/credentials from process.env, server-side only).
 *
 * Shapes mirror what real SAP responses look like so the swap is drop-in.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import {
  sapEnabled,
  fetchOpenApprovals,
  postDecision,
  type SapApprovalItem,
} from "@/lib/sap/sap-client.server";
import { sendPushToUser } from "@/lib/push/push.server";

const DOC_TYPES = [
  "ZNFA", "ZNFA_TER", "PR", "PO", "SR", "MIGO", "ZGP", "ZMM_REV",
  "BMW_PRICE", "BMW_CONTRACT", "BMW_SO", "BMW_ZERO_WASTE", "BMW_SC_ISSUE",
  "IWM_PRICE", "SD_VK11", "SD_ZV13", "SD_ZREP_SCR",
] as const;

const STRATEGY: Record<string, { roles: string[]; sapTCode: string; module: "MM" | "SD" }> = {
  ZNFA:           { roles: ["F1","F6","M1","M3","M5","MD"],            sapTCode: "ZNFA",            module: "MM" },
  ZNFA_TER:       { roles: ["T4"],                                      sapTCode: "ZNFA_TER",        module: "MM" },
  PR:             { roles: ["IC","M1","M2","M3","T1","T4","T6"],        sapTCode: "ME54N",           module: "MM" },
  PO:             { roles: ["ZZ","F3","F6","T6","S4"],                  sapTCode: "ME29N",           module: "MM" },
  SR:             { roles: ["SR","F1","M3","M4"],                       sapTCode: "ML81N",           module: "MM" },
  MIGO:           { roles: ["PlantHead"],                               sapTCode: "MIGO",            module: "MM" },
  ZGP:            { roles: ["HOD","StoreHOD","SCMHead","PlantHead","StoreHOD"], sapTCode: "ZGP",     module: "MM" },
  ZMM_REV:        { roles: ["HOD"],                                     sapTCode: "ZMM_REV",         module: "MM" },
  BMW_PRICE:      { roles: ["ProjectHead"],                             sapTCode: "ZBMW_VK11_APP",   module: "SD" },
  BMW_CONTRACT:   { roles: ["FinanceHead","ProjectHead"],               sapTCode: "ZBMW_CONTRACT_APP", module: "SD" },
  BMW_SO:         { roles: ["FinanceHead","ProjectHead"],               sapTCode: "ZSD_BMW_SO_APP",  module: "SD" },
  BMW_ZERO_WASTE: { roles: ["ProjectHead"],                             sapTCode: "ZBMW_COCKPIT",    module: "SD" },
  BMW_SC_ISSUE:   { roles: ["ProjectHead"],                             sapTCode: "ZBMW_SC_ISSUE_PH",module: "SD" },
  IWM_PRICE:      { roles: ["ProjectHead"],                             sapTCode: "ZIWM_APPROVE",    module: "SD" },
  SD_VK11:        { roles: ["MBD"],                                     sapTCode: "VK11",            module: "SD" },
  SD_ZV13:        { roles: ["MBD"],                                     sapTCode: "ZV13",            module: "SD" },
  SD_ZREP_SCR:    { roles: ["FA"],                                      sapTCode: "ZREP_SCR",        module: "SD" },
};

const PLANTS = ["RES-HYD-01","RES-MUM-02","RES-BLR-03","RES-DEL-04"];
const BUS = ["IWM","BMW","Recycling","ISS"];
const VENDORS = ["Acme Industrial Pvt Ltd","Greentech Recyclers","Veolia India","Bharat Sustainable Co","Eco-Logix Ltd"];
const CUSTOMERS = ["Tata Steel","Reliance","ITC Ltd","Aditya Birla","Mahindra"];

function rng(seed: number) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

function generateMockBatch(now: Date) {
  const out: Array<{
    doc: any;
    steps: Array<{ seq: number; role: string }>;
    lines: Array<{ line_no: number; description: string; quantity: number; uom: string; unit_price: number; amount: number; material_code: string }>;
  }> = [];

  let i = 0;
  for (const dt of DOC_TYPES) {
    const r = rng(dt.length * 1000 + dt.charCodeAt(0));
    const count = 2 + Math.floor(r() * 3);
    for (let n = 0; n < count; n++) {
      i++;
      const strat = STRATEGY[dt];
      const isSD = strat.module === "SD";
      const value = Math.round((10000 + r() * 9_000_000) * 100) / 100;
      const plant = PLANTS[Math.floor(r() * PLANTS.length)];
      const bu = isSD ? (r() < 0.5 ? "BMW" : "IWM") : BUS[Math.floor(r() * BUS.length)];
      const sapDocNo = `${dt}-${String(100000 + i * 17).padStart(7,"0")}`;
      const title = isSD
        ? `${dt.replace("_"," ")} for ${CUSTOMERS[Math.floor(r() * CUSTOMERS.length)]}`
        : `${dt.replace("_"," ")} – ${VENDORS[Math.floor(r() * VENDORS.length)]}`;
      const days = Math.floor(r() * 6);
      const ddate = new Date(now.getTime() - days * 24 * 3600 * 1000);

      const linesCount = 1 + Math.floor(r() * 4);
      const lines = Array.from({ length: linesCount }, (_, li) => {
        const qty = 1 + Math.floor(r() * 20);
        const price = Math.round((value / linesCount / Math.max(qty,1)) * 100) / 100;
        return {
          line_no: li + 1,
          material_code: `M-${(100000 + Math.floor(r()*900000))}`,
          description: isSD
            ? ["Hazardous waste handling","Scrap collection","Service certificate","Plant maintenance"][li % 4]
            : ["Industrial bearings","Safety gloves – pack of 50","Hydraulic oil drum","HDPE liner roll"][li % 4],
          quantity: qty,
          uom: ["EA","KG","LTR","ROLL"][li % 4],
          unit_price: price,
          amount: Math.round(qty * price * 100) / 100,
        };
      });

      out.push({
        doc: {
          module: strat.module,
          doc_type: dt,
          sap_t_code: strat.sapTCode,
          sap_doc_no: sapDocNo,
          title,
          description: isSD ? "Sales-side approval routed from SAP cockpit." : "Procurement document pending release.",
          plant,
          business_unit: bu,
          company_code: isSD ? bu : "1000",
          vendor_name: isSD ? null : VENDORS[Math.floor(r() * VENDORS.length)],
          customer_name: isSD ? CUSTOMERS[Math.floor(r() * CUSTOMERS.length)] : null,
          requester_name: ["A. Rao","S. Kumar","N. Iyer","R. Singh","P. Mehta"][Math.floor(r()*5)],
          requester_sap_id: `EMP${String(1000 + Math.floor(r()*9000))}`,
          total_value: value,
          currency: "INR",
          document_date: ddate.toISOString().slice(0,10),
          current_step_seq: 1,
          status: "pending" as const,
          sap_payload: { source: "MOCK", t_code: strat.sapTCode },
        },
        steps: strat.roles.map((role, idx) => ({ seq: idx + 1, role })),
        lines,
      });
    }
  }
  return out;
}

/**
 * Sync open documents from SAP (mocked).
 * Upserts documents and (re)creates step chain, assigning step.assigned_user
 * to a user that has the required role (first match in user_roles).
 */
export const syncFromSAP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // Phase 2: when SAP_USE_REAL=true, pull from the real Gateway. Otherwise
    // fall back to the mock generator so demo flows keep working.
    let batch: Array<{
      doc: any;
      steps: Array<{ seq: number; role: string }>;
      lines: any[];
    }>;
    if (sapEnabled()) {
      const items = await fetchOpenApprovals();
      batch = items.map(mapSapItem);
    } else {
      batch = generateMockBatch(new Date());
    }

    // Map role -> list of user ids
    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const list = roleMap.get(r.role) ?? [];
      list.push(r.user_id);
      roleMap.set(r.role, list);
    }

    let inserted = 0;
    for (const item of batch) {
      // Skip if already exists
      const { data: existing } = await supabaseAdmin
        .from("approval_documents")
        .select("id")
        .eq("doc_type", item.doc.doc_type)
        .eq("sap_doc_no", item.doc.sap_doc_no)
        .maybeSingle();
      if (existing) continue;

      const { data: doc, error: docErr } = await supabaseAdmin
        .from("approval_documents")
        .insert(item.doc)
        .select()
        .single();
      if (docErr || !doc) continue;
      inserted++;

      // Insert lines
      if (item.lines.length) {
        await supabaseAdmin.from("approval_line_items").insert(
          item.lines.map((l) => ({ ...l, document_id: doc.id })),
        );
      }

      // Build steps; first step pending, rest waiting
      const steps = item.steps.map((s, idx) => {
        const candidates = roleMap.get(s.role) ?? [];
        const assigned = candidates[0] ?? null;
        return {
          document_id: doc.id,
          seq: s.seq,
          role: s.role as any,
          assigned_user: assigned,
          status: (idx === 0 ? "pending" : "waiting") as any,
        };
      });
      await supabaseAdmin.from("approval_steps").insert(steps);

      // Notify the first-step assignee
      const firstAssignee = steps[0]?.assigned_user;
      if (firstAssignee) {
        await supabaseAdmin.from("notifications").insert({
          user_id: firstAssignee,
          document_id: doc.id,
          title: `New approval: ${doc.sap_doc_no}`,
          body: `${doc.title} — ₹${doc.total_value.toLocaleString("en-IN")}`,
          kind: "assignment",
        });
      }

      await supabaseAdmin.from("audit_log").insert({
        document_id: doc.id,
        actor: null,
        actor_name: "SAP Sync",
        action: "imported",
        details: { sap_t_code: doc.sap_t_code },
      });
    }

    return { inserted, total_pulled: batch.length };
  });

/**
 * Approve / Reject / Send-back the current step of a document.
 */
const ActionInput = z.object({
  documentId: z.string().uuid(),
  action: z.enum(["approve", "reject", "send_back"]),
  comments: z.string().max(2000).optional(),
});

export const decideStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ActionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    // Load the current pending step for this user
    const { data: doc, error: docErr } = await userClient
      .from("approval_documents")
      .select("*")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Document not found or not visible");

    const { data: steps } = await userClient
      .from("approval_steps")
      .select("*")
      .eq("document_id", doc.id)
      .order("seq", { ascending: true });
    if (!steps?.length) throw new Error("No approval chain found");

    const current = steps.find((s) => s.seq === doc.current_step_seq);
    if (!current) throw new Error("No active step");
    if (current.assigned_user !== userId) throw new Error("Not your step to action");
    if (current.status !== "pending") throw new Error("Step already decided");

    const now = new Date().toISOString();
    const newStatus =
      data.action === "approve" ? "approved" :
      data.action === "reject" ? "rejected" : "sent_back";

    // Update current step (RLS lets the assignee update their own)
    await userClient
      .from("approval_steps")
      .update({ status: newStatus as any, decided_at: now, comments: data.comments ?? null })
      .eq("id", current.id);

    // Document + downstream housekeeping needs admin (bypass RLS)
    if (data.action === "approve") {
      const next = steps.find((s) => s.seq === current.seq + 1);
      if (next) {
        await supabaseAdmin.from("approval_steps").update({ status: "pending" }).eq("id", next.id);
        await supabaseAdmin.from("approval_documents").update({ current_step_seq: next.seq }).eq("id", doc.id);
        if (next.assigned_user) {
          await supabaseAdmin.from("notifications").insert({
            user_id: next.assigned_user,
            document_id: doc.id,
            title: `Approval pending: ${doc.sap_doc_no}`,
            body: `${doc.title} — your action required`,
            kind: "assignment",
          });
        }
      } else {
        await supabaseAdmin.from("approval_documents").update({ status: "approved" }).eq("id", doc.id);
        if (doc.raised_by_user) {
          await supabaseAdmin.from("notifications").insert({
            user_id: doc.raised_by_user,
            document_id: doc.id,
            title: `Approved: ${doc.sap_doc_no}`,
            body: `${doc.title} is fully approved.`,
            kind: "outcome",
          });
        }
      }
    } else {
      await supabaseAdmin
        .from("approval_documents")
        .update({ status: newStatus as any })
        .eq("id", doc.id);
      if (doc.raised_by_user) {
        await supabaseAdmin.from("notifications").insert({
          user_id: doc.raised_by_user,
          document_id: doc.id,
          title: `${newStatus.toUpperCase()}: ${doc.sap_doc_no}`,
          body: data.comments ?? "",
          kind: "outcome",
        });
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      document_id: doc.id,
      actor: userId,
      actor_name: null,
      action: data.action,
      details: { comments: data.comments ?? null, step_seq: current.seq, role: current.role },
    });

    // TODO Phase 2: POST decision back to SAP via OData here.
    return { ok: true };
  });
