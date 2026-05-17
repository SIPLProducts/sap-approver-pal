import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, CornerUpLeft, Check, Clock } from "lucide-react";
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

  const { data: doc } = useQuery({
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

  if (!doc) return <Card className="p-8 text-center text-muted-foreground">Loading…</Card>;

  const currentStep = steps.find((s) => s.seq === doc.current_step_seq);
  const canAct = currentStep?.assigned_user === user?.id && currentStep.status === "pending" && doc.status === "pending";
  const meta = DOC_TYPE_LABELS[doc.doc_type];

  async function act(action: "approve" | "reject" | "send_back") {
    if ((action === "reject" || action === "send_back") && !comments.trim()) {
      toast.error("Please add a comment");
      return;
    }
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
    <div className="max-w-5xl mx-auto space-y-5">
      <Link to="/inbox" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 mr-1" /> Back to inbox</Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{doc.module}</Badge>
              <span className="font-mono">{meta?.tcode ?? doc.sap_t_code}</span>
              <span>•</span><span>{doc.plant} / {doc.business_unit}</span>
            </div>
            <h1 className="text-2xl font-bold mt-1">{doc.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">SAP Doc: <span className="font-mono">{doc.sap_doc_no}</span> • Raised by {doc.requester_name} ({doc.requester_sap_id}) on {doc.document_date}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">₹{Number(doc.total_value).toLocaleString("en-IN")}</div>
            <Badge variant={doc.status === "pending" ? "secondary" : doc.status === "approved" ? "default" : "destructive"} className="mt-1">{doc.status.toUpperCase()}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-3">Line items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr><th className="text-left py-2">#</th><th className="text-left">Material</th><th className="text-left">Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2">{l.line_no}</td>
                    <td className="font-mono text-xs">{l.material_code}</td>
                    <td>{l.description}</td>
                    <td className="text-right">{l.quantity} {l.uom}</td>
                    <td className="text-right">₹{Number(l.unit_price).toLocaleString("en-IN")}</td>
                    <td className="text-right font-medium">₹{Number(l.amount).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {!lines.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No line items</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Approval trail</h2>
          <ol className="space-y-3">
            {steps.map((s) => {
              const isCurrent = s.seq === doc.current_step_seq && s.status === "pending";
              const icon = s.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-success" />
                : s.status === "rejected" ? <XCircle className="h-4 w-4 text-destructive" />
                : s.status === "sent_back" ? <CornerUpLeft className="h-4 w-4 text-warning" />
                : isCurrent ? <Clock className="h-4 w-4 text-primary" />
                : <Check className="h-4 w-4 text-muted-foreground" />;
              return (
                <li key={s.id} className={`flex items-start gap-3 p-2 rounded-md ${isCurrent ? "bg-accent" : ""}`}>
                  {icon}
                  <div className="flex-1 text-sm">
                    <div className="font-medium">Step {s.seq}: {ROLE_LABELS[s.role]}</div>
                    <div className="text-xs text-muted-foreground capitalize">{s.status}{s.decided_at ? ` • ${new Date(s.decided_at).toLocaleString()}` : ""}</div>
                    {s.comments && <div className="text-xs italic mt-1">"{s.comments}"</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      {canAct && (
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Your decision</h2>
          <Textarea placeholder="Add comments (required for reject / send back)…" value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => act("approve")} disabled={!!busy} className="bg-success hover:bg-success/90 text-success-foreground">
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
