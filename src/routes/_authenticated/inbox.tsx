import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from "react";
import { DOC_TYPE_LABELS } from "@/lib/approvals/constants";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/inbox")({ component: InboxPage });

function InboxPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"ALL" | "MM" | "SD">("ALL");

  // Phase 3: live-refresh inbox when steps or notifications change for me.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_steps", filter: `assigned_user=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["inbox", user.id] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["inbox", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["inbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Documents where the current pending step is assigned to me
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
    (tab === "ALL" || r.module === tab) &&
    (!q || r.sap_doc_no.toLowerCase().includes(q.toLowerCase()) || r.title.toLowerCase().includes(q.toLowerCase()) || (r.vendor_name ?? r.customer_name ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, tab]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Inbox</h1>
        <p className="text-sm text-muted-foreground">Documents awaiting your approval, synced live from SAP.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="ALL">All ({rows.length})</TabsTrigger>
            <TabsTrigger value="MM">MM</TabsTrigger>
            <TabsTrigger value="SD">SD</TabsTrigger>
          </TabsList>
        </Tabs>
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
