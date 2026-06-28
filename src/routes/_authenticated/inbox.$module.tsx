import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from "react";
import { DOC_TYPE_LABELS } from "@/lib/approvals/constants";
import { PageHeader } from "@/components/exec/page-header";
import { KpiTile } from "@/components/exec/kpi-tile";
import { Search, Inbox, Clock3, Gauge, TrendingUp, ChevronRight } from "lucide-react";
import { useActiveContext } from "@/hooks/use-active-context";

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
  const { activePlant } = useActiveContext();
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

  const moduleRows = useMemo(() => rows.filter((r) => r.module === mod && (!activePlant || r.plant === activePlant)), [rows, mod, activePlant]);
  const filtered = useMemo(() => moduleRows.filter((r) =>
    !q || r.sap_doc_no.toLowerCase().includes(q.toLowerCase())
      || r.title.toLowerCase().includes(q.toLowerCase())
      || (r.vendor_name ?? r.customer_name ?? "").toLowerCase().includes(q.toLowerCase())
  ), [moduleRows, q]);

  const totalValue = moduleRows.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const now = Date.now();
  const overdue = moduleRows.filter((r) => now - new Date(r.created_at).getTime() > 1000 * 60 * 60 * 24 * 2).length;
  const fmtCr = (n: number) => n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

  const heading = mod === "MM" ? "MM Approvals" : "SD Approvals";
  const subtitle = mod === "MM"
    ? "Materials Management documents awaiting your decision."
    : "Sales & Distribution documents awaiting your decision.";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${mod} Inbox · Executive`}
        title={heading}
        subtitle={subtitle}
        meta={
          <>
            <Badge variant="outline" className="font-mono">{mod === "MM" ? "ME21N / FBV1" : "VA01 / VK11"}</Badge>
            <Badge variant="secondary">{moduleRows.length} pending</Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiTile lead accent="gold" label="Pending decisions" value={moduleRows.length} icon={<Inbox className="h-4 w-4" />} sub={`${mod} · live from SAP`} />
        <KpiTile accent="destructive" label="Overdue · >48h" value={overdue} icon={<Clock3 className="h-4 w-4" />} sub="Breaching internal SLA" />
        <KpiTile accent="info" label="Cumulative value" value={fmtCr(totalValue)} icon={<Gauge className="h-4 w-4" />} sub="Across pending queue" />
        <KpiTile accent="success" label="Approved · 7d" value="184" delta={{ value: "+12%", trend: "up" }} icon={<TrendingUp className="h-4 w-4" />} sub="vs prior week" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="h-10 pl-9" placeholder="Search by doc no, title, vendor or customer…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {moduleRows.length}
        </div>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">Loading inbox…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-secondary grid place-items-center mb-4">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-display text-lg font-semibold">Nothing to approve right now</p>
          <p className="text-sm text-muted-foreground mt-1.5">Use “Sync SAP” to pull the latest open documents.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b bg-muted/30">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pending queue</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">{filtered.length} record{filtered.length === 1 ? "" : "s"}</div>
          </div>
          <ul className="divide-y">
            {filtered.map((d) => {
              const meta = DOC_TYPE_LABELS[d.doc_type];
              const ageH = Math.max(0, Math.round((now - new Date(d.created_at).getTime()) / 36e5));
              const ageLabel = ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d ${ageH % 24}h`;
              const isOverdue = ageH > 48;
              return (
                <li key={d.id}>
                  <Link
                    to="/approval/$id"
                    params={{ id: d.id }}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-5 py-4 hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="font-mono text-[10px] h-5">{meta?.tcode ?? d.sap_t_code}</Badge>
                        <span className="font-mono">{d.sap_doc_no}</span>
                        <span>·</span>
                        <span className="truncate">{d.plant} / {d.business_unit}</span>
                      </div>
                      <div className="mt-1.5 font-display text-[15px] font-semibold truncate">{d.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground truncate">
                        Raised by <span className="text-foreground/80">{d.requester_name}</span>
                        {d.vendor_name ? <> · Vendor <span className="text-foreground/80">{d.vendor_name}</span></> : null}
                        {d.customer_name ? <> · Customer <span className="text-foreground/80">{d.customer_name}</span></> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                      <div className="text-right">
                        <div className="font-display text-lg sm:text-xl font-semibold tabular-nums">₹{Number(d.total_value).toLocaleString("en-IN")}</div>
                        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px]">
                          <Badge variant="secondary" className="h-5">Step {d.current_step_seq}</Badge>
                          <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>{ageLabel}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
