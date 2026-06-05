import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from "react";
import { DOC_TYPE_LABELS } from "@/lib/approvals/constants";

export const Route = createFileRoute("/_authenticated/inbox/$module")({
  beforeLoad: ({ params }) => {
    const m = params.module.toUpperCase();
    if (m !== "MM" && m !== "SD") throw notFound();
  },
  component: InboxPage,
});

function InboxPage() {
  const { module } = Route.useParams();
  const mod = module.toUpperCase() as "MM" | "SD";
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`inbox-${user.id}-${mod}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_steps", filter: `assigned_user=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["inbox", user.id] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["inbox", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc, mod]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["inbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mySteps } = await supabase
        .from("approval_steps")
        .select("document_id, seq, role, status")
        .eq("assigned_user", user!.id)
        .eq("status", "pending");
      const ids = (mySteps ?? []).map((s) => s.document_id);
      if (!ids.length) return [];
      const { data: docs } = await supabase
        .from("approval_documents")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return docs ?? [];
    },
  });

  const filtered = useMemo(() => rows.filter((r) =>
    r.module === mod &&
    (!q || r.sap_doc_no.toLowerCase().includes(q.toLowerCase()) || r.title.toLowerCase().includes(q.toLowerCase()) || (r.vendor_name ?? r.customer_name ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, mod]);

  const heading = mod === "MM" ? "MM Approvals" : "SD Approvals";
  const subtitle = mod === "MM"
    ? "Materials Management documents awaiting your approval, synced live from SAP."
    : "Sales & Distribution documents awaiting your approval, synced live from SAP.";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-sm" placeholder="Search by doc no, title, vendor…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-lg font-semibold">Nothing to approve right now</p>
          <p className="text-sm text-muted-foreground mt-1">Use the “Sync SAP” button to pull the latest open documents.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((d) => {
            const meta = DOC_TYPE_LABELS[d.doc_type];
            return (
              <Link key={d.id} to="/approval/$id" params={{ id: d.id }}>
                <Card className="p-4 hover:shadow-elegant transition-shadow">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{d.module}</Badge>
                        <span className="font-mono">{meta?.tcode ?? d.sap_t_code}</span>
                        <span>•</span>
                        <span>{d.plant} / {d.business_unit}</span>
                      </div>
                      <div className="mt-1 font-semibold">{d.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {d.sap_doc_no} • Raised by {d.requester_name}{d.vendor_name ? ` • Vendor: ${d.vendor_name}` : ""}{d.customer_name ? ` • Customer: ${d.customer_name}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">₹{Number(d.total_value).toLocaleString("en-IN")}</div>
                      <Badge className="mt-1" variant="secondary">Step {d.current_step_seq}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
