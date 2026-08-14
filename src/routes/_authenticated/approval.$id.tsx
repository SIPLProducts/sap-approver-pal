import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, CornerUpLeft, Check, Clock, FileQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/exec/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, formatDateTime, formatQuantity } from "@/lib/format";

import { ROLE_LABELS, DOC_TYPE_LABELS } from "@/lib/approvals/constants";
import { useServerFn } from "@tanstack/react-start";
import { decideStep } from "@/lib/sap/sap.functions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/approval/$id")({ component: ApprovalDetail });

function ApprovalDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const decide = useServerFn(decideStep);

  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "reject" | "send_back">(null);

  const {
    data: doc,
    isLoading: docLoading,
    isError: docError,
  } = useQuery({
    queryKey: ["doc", id],
    queryFn: async () => (await supabase.from("approval_documents").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: steps = [] } = useQuery({
    queryKey: ["steps", id],
    queryFn: async () => (await supabase.from("approval_steps").select("*").eq("document_id", id).order("seq")).data ?? [],
  });
  const { data: lines = [] } = useQuery({
    queryKey: ["lines", id],
    queryFn: async () => (await supabase.from("approval_line_items").select("*").eq("document_id", id).order("line_no")).data ?? [],
  });

  if (docLoading) {
    return (
      <div className="page-shell page-stack max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Card className="p-6 space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-80" />
          <Skeleton className="h-3 w-56" />
        </Card>
        <Card className="p-5">
          <SkeletonRows rows={5} columns={6} />
        </Card>
      </div>
    );
  }

  if (docError || !doc) {
    return (
      <div className="page-shell page-stack max-w-3xl mx-auto">
        <EmptyState
          icon={<FileQuestion className="h-5 w-5" aria-hidden />}
          title="Approval not found"
          description="This document may have been withdrawn, already actioned, or you no longer have access to it."
          action={
            <Button asChild variant="outline">
              <Link to="/inbox">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to inbox
              </Link>
            </Button>
          }
        />
      </div>
    );
  }


  const currentStep = steps.find((s) => s.seq === doc.current_step_seq);
  const canAct = !!currentStep && currentStep.assigned_user === user?.id && currentStep.status === "pending" && doc.status === "pending";
  const meta = DOC_TYPE_LABELS[doc.doc_type];

  async function act(action: "approve" | "reject" | "send_back") {
    if ((action === "reject" || action === "send_back") && !comments.trim()) {
      toast.error("Please add a comment");
      return;
    }
    const label = action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Send back";
    setBusy(action);
    try {
      await decide({ data: { documentId: id, action, comments: comments.trim() || undefined } });
      toast.success(`${action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Sent back"}`);
      qc.invalidateQueries();
      nav({ to: "/inbox" });
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-shell page-stack max-w-5xl mx-auto">
      <Link to="/inbox" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 mr-1" /> Back to inbox</Link>

      <PageHeader
        eyebrow={`${doc.module} · ${meta?.tcode ?? doc.sap_doc_no}`}
        title={doc.title}
        subtitle={
          <>
            SAP Doc <span className="font-mono">{doc.sap_doc_no}</span> · Raised by {doc.requester_name}{" "}
            ({doc.requester_sap_id}) on {formatDate(doc.document_date)}
          </>
        }
        meta={
          <>
            <Badge variant="outline">{doc.plant} / {doc.business_unit}</Badge>
            <StatusBadge status={doc.status} />
          </>
        }
        actions={
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(doc.total_value)}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total value</div>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <h2 className="font-semibold mb-3">Line items</h2>
          <div className="table-scroll">
            <table className="data-table text-sm">
              <thead>
                <tr><th>#</th><th>Material</th><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.line_no}</td>
                    <td className="font-mono text-xs">{l.material_code}</td>
                    <td>{l.description}</td>
                    <td className="num">{formatQuantity(l.quantity, l.uom)}</td>
                    <td className="num">{formatCurrency(l.unit_price)}</td>
                    <td className="num font-medium">{formatCurrency(l.amount)}</td>
                  </tr>
                ))}
                {!lines.length && (
                  <tr>
                    <td colSpan={6} className="py-4">
                      <EmptyState
                        title="No line items"
                        description="This document was raised without item detail in SAP."
                        className="border-0 bg-transparent py-4"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="card-pad">
          <h2 className="font-semibold mb-3">Approval trail</h2>
          {steps.length === 0 ? (
            <EmptyState
              title="No trail yet"
              description="Approval steps appear here once the workflow starts."
              className="border-0 bg-transparent py-4"
            />
          ) : (
            <ol className="space-y-3">
              {steps.map((s) => {
                const isCurrent = s.seq === doc.current_step_seq && s.status === "pending";
                const icon = s.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                  : s.status === "rejected" ? <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                  : s.status === "sent_back" ? <CornerUpLeft className="h-4 w-4 text-warning" aria-hidden />
                  : isCurrent ? <Clock className="h-4 w-4 text-primary" aria-hidden />
                  : <Check className="h-4 w-4 text-muted-foreground" aria-hidden />;
                return (
                  <li key={s.id} className={`flex items-start gap-3 p-2 rounded-md ${isCurrent ? "bg-accent" : ""}`}>
                    {icon}
                    <div className="flex-1 text-sm">
                      <div className="font-medium">Step {s.seq}: {ROLE_LABELS[s.role]}</div>
                      <div className="text-xs text-muted-foreground capitalize">{s.status}{s.decided_at ? ` • ${formatDateTime(s.decided_at)}` : ""}</div>
                      {s.comments && <div className="text-xs italic mt-1">"{s.comments}"</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {canAct && (
        <Card className="card-pad">
          <h2 className="font-semibold mb-3">Your decision</h2>
          <Textarea placeholder="Add comments (required for reject / send back)…" value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => act("approve")} disabled={!!busy} variant="success">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
            </Button>
            <Button onClick={() => act("send_back")} disabled={!!busy} variant="outline">
              <CornerUpLeft className="h-4 w-4 mr-2" /> Send back
            </Button>
            <Button onClick={() => act("reject")} disabled={!!busy} variant="destructive">
              <XCircle className="h-4 w-4 mr-2" /> Reject
            </Button>
          </div>
        </Card>
      )}
    </div>
  );

}
