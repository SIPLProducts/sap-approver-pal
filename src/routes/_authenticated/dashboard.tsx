import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/exec/page-header";
import { KpiTile } from "@/components/exec/kpi-tile";
import {
  Inbox, Clock3, Gauge, TrendingUp, ArrowUpRight, AlertTriangle, CheckCircle2,
  Filter, Package, Truck, Tag, FileText, FileCheck2, ShoppingCart,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: CeoDashboard,
});

type Doc = {
  id: string;
  module: "MM" | "SD";
  doc_type: string;
  sap_doc_no: string;
  title: string;
  vendor_name: string | null;
  customer_name: string | null;
  total_value: number | string;
  status: string;
  current_step_seq: number;
  created_at: string;
  updated_at: string;
  plant: string | null;
  business_unit: string | null;
};

const fmtCr = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr`
  : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L`
  : `₹${Math.round(n).toLocaleString("en-IN")}`;

type Range = "7d" | "30d" | "90d";
type ModuleFilter = "ALL" | "MM" | "SD";

function CeoDashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("30d");
  const [mod, setMod] = useState<ModuleFilter>("ALL");

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["ceo-dashboard", since],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("approval_documents")
        .select("id,module,doc_type,sap_doc_no,title,vendor_name,customer_name,total_value,status,current_step_seq,created_at,updated_at,plant,business_unit")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      return (data ?? []) as Doc[];
    },
    refetchInterval: 60_000,
  });

  const rows = useMemo(() => mod === "ALL" ? docs : docs.filter((d) => d.module === mod), [docs, mod]);
  const now = Date.now();

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const rejected = rows.filter((r) => r.status === "rejected");
  const overdue = pending.filter((r) => now - new Date(r.created_at).getTime() > 48 * 3600_000);

  const pendingValue = pending.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const approvedValue = approved.reduce((s, r) => s + Number(r.total_value || 0), 0);

  // Trend buckets by day
  const trend = useMemo(() => {
    const buckets: { date: string; approved: number; rejected: number; raised: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({ date: key, approved: 0, rejected: 0, raised: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.date, i]));
    for (const r of rows) {
      const raisedKey = r.created_at.slice(0, 10);
      if (idx.has(raisedKey)) buckets[idx.get(raisedKey)!].raised += 1;
      if (r.status !== "pending") {
        const k = (r.updated_at ?? r.created_at).slice(0, 10);
        if (idx.has(k)) {
          if (r.status === "approved") buckets[idx.get(k)!].approved += 1;
          if (r.status === "rejected") buckets[idx.get(k)!].rejected += 1;
        }
      }
    }
    return buckets.map((b) => ({ ...b, date: b.date.slice(5) }));
  }, [rows, days]);

  // Value by doc type
  const byType = useMemo(() => {
    const m = new Map<string, { name: string; value: number; count: number }>();
    for (const r of rows) {
      const key = r.doc_type;
      const cur = m.get(key) ?? { name: key, value: 0, count: 0 };
      cur.value += Number(r.total_value || 0);
      cur.count += 1;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [rows]);

  // Module split
  const modSplit = useMemo(() => {
    const mm = docs.filter((d) => d.module === "MM").length;
    const sd = docs.filter((d) => d.module === "SD").length;
    return [
      { name: "MM", value: mm },
      { name: "SD", value: sd },
    ];
  }, [docs]);

  // Top stuck (oldest pending, highest value)
  const topStuck = useMemo(() => {
    return [...pending]
      .sort((a, b) => {
        const ageDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (Math.abs(ageDiff) > 6 * 3600_000) return ageDiff;
        return Number(b.total_value) - Number(a.total_value);
      })
      .slice(0, 6);
  }, [pending]);

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--gold))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

  const quickFilters: { label: string; to: any; params?: any; icon: any; desc: string }[] = [
    { label: "MM Inbox", to: "/inbox/$module", params: { module: "mm" }, icon: Package, desc: "Materials approvals" },
    { label: "SD Sales Orders", to: "/sd/sales-order", icon: ShoppingCart, desc: "SO release" },
    { label: "SD Contracts", to: "/sd/contract", icon: FileText, desc: "Contract release" },
    { label: "SD Pricing", to: "/sd/price", icon: Tag, desc: "Price approvals" },
    { label: "Service Cert & SO", to: "/sd/sc-so", icon: FileCheck2, desc: "SC approvals" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Executive · CEO Dashboard"
        title="Approvals Command Center"
        subtitle="Real-time view of SAP approvals, SLA risk and pipeline value across MM and SD."
        meta={
          <>
            <Badge variant="outline" className="font-mono">Live · SAP synced</Badge>
            <Badge variant="secondary">{docs.length} docs · last {days}d</Badge>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-card p-0.5">
              {(["ALL", "MM", "SD"] as ModuleFilter[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMod(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[5px] transition-colors ${mod === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {m === "ALL" ? "All modules" : m}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border bg-card p-0.5">
              {(["7d", "30d", "90d"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[5px] transition-colors tabular-nums ${range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiTile
          lead accent="gold"
          label="Pending decisions"
          value={pending.length}
          icon={<Inbox className="h-4 w-4" />}
          sub={`${fmtCr(pendingValue)} at risk`}
        />
        <KpiTile
          accent="destructive"
          label="Overdue · >48h"
          value={overdue.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          sub="Breaching internal SLA"
        />
        <KpiTile
          accent="success"
          label={`Approved · ${range}`}
          value={approved.length}
          delta={{ value: fmtCr(approvedValue), trend: "up" }}
          icon={<CheckCircle2 className="h-4 w-4" />}
          sub="Cleared from queue"
        />
        <KpiTile
          accent="info"
          label={`Throughput · ${range}`}
          value={`${approved.length + rejected.length}`}
          icon={<Gauge className="h-4 w-4" />}
          sub={`${rejected.length} rejected · ${rows.length ? Math.round((approved.length / Math.max(1, approved.length + rejected.length)) * 100) : 0}% approval rate`}
        />
      </div>

      {/* Quick filters */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick jump · pending & overdue queues</div>
        </div>
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {quickFilters.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.label}
                to={f.to}
                params={f.params as any}
                className="group flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-foreground/30 hover:shadow-card transition"
              >
                <span className="h-8 w-8 grid place-items-center rounded-md bg-secondary text-foreground/70 group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate">{f.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{f.desc}</div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground" />
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Trend + module split */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Decision trend</div>
              <div className="font-display text-lg font-semibold">Approvals vs rejections · last {days} days</div>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gApp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRej" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="raised" name="Raised" stroke="hsl(var(--info))" fill="url(#gRai)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="approved" name="Approved" stroke="hsl(var(--success))" fill="url(#gApp)" strokeWidth={2} />
                <Area type="monotone" dataKey="rejected" name="Rejected" stroke="hsl(var(--destructive))" fill="url(#gRej)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Module mix</div>
          <div className="font-display text-lg font-semibold mb-2">MM vs SD volume</div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={modSplit} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {modSplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} stroke="hsl(var(--background))" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            {modSplit.map((s, i) => (
              <div key={s.name} className="rounded-md border p-2">
                <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  {s.name}
                </div>
                <div className="font-display text-xl font-semibold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Value by doc type + top stuck */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Pipeline value</div>
          <div className="font-display text-lg font-semibold mb-3">Value by document type</div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={(v) => v >= 1e7 ? `${(v / 1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : `${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => fmtCr(Number(v))}
                />
                <Bar dataKey="value" name="Value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Top stuck approvals</div>
            <Badge variant="destructive" className="h-5">{topStuck.length}</Badge>
          </div>
          {topStuck.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nothing stuck — queue is clear.</div>
          ) : (
            <ul className="divide-y">
              {topStuck.map((d) => {
                const ageH = Math.max(0, Math.round((now - new Date(d.created_at).getTime()) / 36e5));
                const ageLabel = ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d`;
                return (
                  <li key={d.id}>
                    <Link to="/approval/$id" params={{ id: d.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="font-mono text-[9px] h-4 px-1">{d.module}</Badge>
                          <span className="font-mono truncate">{d.sap_doc_no}</span>
                        </div>
                        <div className="mt-0.5 text-[12px] font-medium truncate">{d.title}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-semibold tabular-nums">{fmtCr(Number(d.total_value))}</div>
                        <div className="text-[10px] text-destructive font-medium tabular-nums">{ageLabel} old</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {isLoading && <div className="text-center text-xs text-muted-foreground">Loading live data…</div>}
    </div>
  );
}
