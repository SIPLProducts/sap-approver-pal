import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Building2,
  FileCheck2,
  FileText,
  Landmark,
  Loader2,
  Package,
  PieChart as PieIcon,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiTile } from "@/components/exec/kpi-tile";
import { useActiveContext } from "@/hooks/use-active-context";
import { fetchBmwStatusReport, type BmwStatusRow } from "@/lib/sd/bmw-status-report.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sd/dashboard")({
  component: SdDashboardPage,
});

const CHART_COLORS = [
  "hsl(221 83% 53%)",
  "hsl(210 90% 55%)",
  "hsl(145 65% 45%)",
  "hsl(38 92% 55%)",
  "hsl(var(--destructive))",
  "hsl(262 80% 60%)",
  "hsl(190 85% 50%)",
  "hsl(24 90% 58%)",
  "hsl(340 82% 60%)",
  "hsl(160 70% 45%)",
];

const STATUS_COLORS = {
  Approved: "hsl(145 65% 45%)",
  Pending: "hsl(38 92% 55%)",
  Rejected: "hsl(var(--destructive))",
  Other: "hsl(220 10% 60%)",
} as const;

type StatusBucket = keyof typeof STATUS_COLORS;

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}
function nonEmpty(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "0000-00-00" ? null : s;
}
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (abs >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + " K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtInt(n: number): string {
  return n.toLocaleString();
}
function bucketStatus(raw: string | null): StatusBucket {
  if (!raw) return "Other";
  const s = raw.trim().toUpperCase();
  if (["A", "APPROVED", "01", "1", "APP", "R"].includes(s) && s !== "R") return "Approved";
  if (["A", "APPROVED", "01", "1", "APP"].includes(s)) return "Approved";
  if (["P", "PENDING", "00", "0", "N", "OPEN", "WAIT"].includes(s)) return "Pending";
  if (["X", "REJECTED", "REJ", "02", "2", "D", "DENIED"].includes(s)) return "Rejected";
  return "Other";
}
function relTime(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleString();
}

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "var(--shadow-elegant, 0 10px 30px -10px rgba(0,0,0,0.2))",
};

function SdDashboardPage() {
  const fetchFn = useServerFn(fetchBmwStatusReport);
  const { activePlants } = useActiveContext();

  const sorted = useMemo(() => [...activePlants].sort(), [activePlants]);
  const from = sorted[0] ?? "";
  const to = sorted[sorted.length - 1] ?? "";

  const query = useQuery({
    queryKey: ["sd-dashboard-bmw", from, to],
    enabled: !!from && !!to,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const res: any = await fetchFn({
        data: {
          sales_org_from: from,
          sales_org_to: to,
          customer_from: "",
          customer_to: "",
          contract_from: "",
          contract_to: "",
          mode: "sales" as const,
        },
      });
      return (res?.rows ?? []) as BmwStatusRow[];
    },
  });

  const rows = query.data ?? [];

  const stats = useMemo(() => {
    const customers = new Set<string>();
    const contracts = new Set<string>();
    const salesOrders = new Set<string>();
    const billingDocs = new Set<string>();
    const acctDocs = new Set<string>();
    const serviceCerts = new Set<string>();
    const bySalesOrg = new Map<string, number>();
    const byCustomerValue = new Map<string, { name: string; value: number }>();
    const byMaterialValue = new Map<string, number>();
    const byMonth = new Map<string, { contracts: Set<string>; sales: Set<string> }>();
    const releaseBuckets: Record<number, Record<StatusBucket, number>> = {};
    for (let n = 1; n <= 8; n++) releaseBuckets[n] = { Approved: 0, Pending: 0, Rejected: 0, Other: 0 };
    const phBuckets: Record<StatusBucket, number> = { Approved: 0, Pending: 0, Rejected: 0, Other: 0 };
    

    let contractValue = 0;
    let salesValue = 0;
    let activeBp = 0;
    let inactiveBp = 0;
    const seenBp = new Set<string>();
    const seenContractForValue = new Set<string>();
    const seenPhContract = new Set<string>();

    for (const r of rows) {
      const cust = nonEmpty(r.CUSTOMER);
      if (cust) customers.add(cust);
      const contract = nonEmpty(r.CONTRACT_NO);
      if (contract) contracts.add(contract);
      const so = nonEmpty(r.SALES_ORDER_NO);
      if (so) salesOrders.add(so);
      const bd = nonEmpty(r.BILLING_DOC);
      if (bd) billingDocs.add(bd);
      const ad = nonEmpty(r.ACCOUNTING_DOC);
      if (ad) acctDocs.add(ad);
      const sc = nonEmpty(r.SERVICE_CERT_NO);
      if (sc) serviceCerts.add(sc);

      const org = nonEmpty(r.SALES_ORG) ?? "—";
      bySalesOrg.set(org, (bySalesOrg.get(org) ?? 0) + 1);

      const cnv = toNum(r.CONTRACT_NET_VALUE ?? r.NET_VALUE);
      contractValue += cnv;
      salesValue += toNum(r.SALES_NET_VALUE);

      if (cust && cnv > 0) {
        const label = nonEmpty(r.CUSTOMER_NAME) ?? cust;
        const cur = byCustomerValue.get(cust) ?? { name: label, value: 0 };
        cur.value += cnv;
        cur.name = label;
        byCustomerValue.set(cust, cur);
      }

      const mat = nonEmpty(r.MATERIAL_CODE);
      if (mat && cnv > 0) byMaterialValue.set(mat, (byMaterialValue.get(mat) ?? 0) + cnv);

      // Month buckets (contracts + sales)
      const cd = nonEmpty(r.CONTRACT_DATE) ?? nonEmpty(r.CONTRACT_CREATE_DATE);
      const sd = nonEmpty(r.SALES_CREATE_DATE);
      const addMonth = (dateStr: string | null, kind: "contracts" | "sales", key: string | null) => {
        if (!dateStr || !key) return;
        const m = /^(\d{4})-(\d{2})/.exec(dateStr);
        if (!m) return;
        const mk = `${m[1]}-${m[2]}`;
        const b = byMonth.get(mk) ?? { contracts: new Set<string>(), sales: new Set<string>() };
        b[kind].add(key);
        byMonth.set(mk, b);
      };
      addMonth(cd, "contracts", contract);
      addMonth(sd, "sales", so);

      // Release pipeline (STATUS_n_C)
      for (let n = 1; n <= 8; n++) {
        const st = nonEmpty(r[`STATUS_${n}_C`]);
        if (st == null) continue;
        releaseBuckets[n][bucketStatus(st)]++;
      }

      // PH throughput — dedup per contract
      if (contract && !seenPhContract.has(contract)) {
        seenPhContract.add(contract);
        phBuckets[bucketStatus(nonEmpty(r.PH_STATUS))]++;
      }


      if (cust && !seenBp.has(cust)) {
        seenBp.add(cust);
        const st = nonEmpty(r.BP_ACTIVE_INACTIVE);
        if (st === "01") activeBp++;
        else if (st) inactiveBp++;
      }

      if (contract && !seenContractForValue.has(contract)) {
        seenContractForValue.add(contract);
      }
    }

    const salesOrgData = Array.from(bySalesOrg.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topCustomers = Array.from(byCustomerValue.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((c) => ({
        name: c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name,
        value: Math.round(c.value),
      }));

    const topMaterials = Array.from(byMaterialValue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value: Math.round(value) }));

    const monthly = Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-12)
      .map(([month, b]) => ({
        month: month.slice(2),
        contracts: b.contracts.size,
        sales: b.sales.size,
      }));

    const releaseData = Object.entries(releaseBuckets)
      .map(([n, b]) => ({
        name: `R${n}`,
        Approved: b.Approved,
        Pending: b.Pending,
        Rejected: b.Rejected,
        Other: b.Other,
        total: b.Approved + b.Pending + b.Rejected + b.Other,
      }))
      .filter((d) => d.total > 0);

    const phData = (Object.keys(phBuckets) as StatusBucket[])
      .map((k) => ({ name: k, value: phBuckets[k] }))
      .filter((d) => d.value > 0);

    const bpStatus = [
      { name: "Active", value: activeBp },
      { name: "Inactive", value: inactiveBp },
    ].filter((d) => d.value > 0);


    return {
      totalRecords: rows.length,
      customers: customers.size,
      contracts: contracts.size,
      salesOrders: salesOrders.size,
      contractValue,
      salesValue,
      activeBp,
      inactiveBp,
      billingDocs: billingDocs.size,
      acctDocs: acctDocs.size,
      serviceCerts: serviceCerts.size,
      avgContract: contracts.size ? contractValue / contracts.size : 0,
      salesOrgData,
      topCustomers,
      topMaterials,
      monthly,
      releaseData,
      phData,
      bpStatus,
    };
  }, [rows]);

  const hasContext = !!from && !!to;
  const loading = query.isFetching;
  const empty = !loading && hasContext && rows.length === 0;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <header
        className="relative overflow-hidden rounded-2xl border p-5 sm:p-6 shadow-card"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--primary) / 0.02) 55%, hsl(var(--card)))",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "var(--gradient-primary, hsl(var(--primary)))" }} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              SD Approvals · Live analytics
            </p>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              SD Dashboard
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
              Portfolio KPIs, approval throughput and trends derived directly from the BMW Status Report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasContext ? (
              <Badge variant="outline" className="font-mono text-xs h-7 px-2.5">
                <Building2 className="h-3 w-3 mr-1.5" />
                {from === to ? `Sales Org ${from}` : `${from} → ${to}`}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs h-7">
                Select a plant in the top bar
              </Badge>
            )}
            {hasContext && !loading && (
              <Badge variant="secondary" className="text-xs h-7 font-mono">
                {fmtInt(stats.totalRecords)} rows · updated {relTime(query.dataUpdatedAt)}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => query.refetch()}
              disabled={loading || !hasContext}
              className="h-8"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {!hasContext ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Select at least one plant from the top-bar plant selector to load the dashboard.
        </Card>
      ) : query.isError ? (
        <Card className="p-8 text-center text-sm text-destructive">
          Failed to load dashboard data. {(query.error as Error)?.message}
        </Card>
      ) : loading && rows.length === 0 ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* KPI row */}
          <section className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiTile
              label="Records"
              value={fmtInt(stats.totalRecords)}
              sub="Rows returned by SAP"
              icon={<Activity className="h-4 w-4" />}
              accent="primary"
              lead
            />
            <KpiTile
              label="Customers"
              value={fmtInt(stats.customers)}
              sub={`${stats.activeBp} active · ${stats.inactiveBp} inactive`}
              icon={<Users className="h-4 w-4" />}
              accent="info"
            />
            <KpiTile
              label="Contracts"
              value={fmtInt(stats.contracts)}
              sub={`avg ${fmtCompact(stats.avgContract)}`}
              icon={<FileText className="h-4 w-4" />}
              accent="gold"
            />
            <KpiTile
              label="Sales Orders"
              value={fmtInt(stats.salesOrders)}
              sub={`${fmtInt(stats.billingDocs)} billing docs`}
              icon={<ShoppingCart className="h-4 w-4" />}
              accent="success"
            />
            <KpiTile
              label="Contract Net Value"
              value={fmtCompact(stats.contractValue)}
              sub="Σ across contracts"
              icon={<Wallet className="h-4 w-4" />}
              accent="primary"
            />
            <KpiTile
              label="Sales Net Value"
              value={fmtCompact(stats.salesValue)}
              sub="Σ across sales orders"
              icon={<TrendingUp className="h-4 w-4" />}
              accent="warning"
            />
          </section>

          {/* Row A */}
          <section className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Top 10 Customers by Contract Value"
              subtitle="Aggregated across returned rows"
              icon={<Wallet className="h-4 w-4" />}
              empty={empty || stats.topCustomers.length === 0}
              height={340}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topCustomers} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <defs>
                    <linearGradient id="grad-cust" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(210 90% 55%)" stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => fmtCompact(v)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <Bar dataKey="value" fill="url(#grad-cust)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="BP Status"
              subtitle="Active vs inactive customers"
              icon={<Users className="h-4 w-4" />}
              empty={empty || stats.bpStatus.length === 0}
              height={340}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.bpStatus}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={3}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    label={(e: any) => `${e.name}: ${e.value}`}
                  >
                    {stats.bpStatus.map((d, i) => (
                      <Cell key={i} fill={d.name === "Active" ? STATUS_COLORS.Approved : STATUS_COLORS.Rejected} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          {/* Row B */}
          <section className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Contracts vs Sales Orders"
              subtitle="Last 12 months"
              icon={<TrendingUp className="h-4 w-4" />}
              empty={empty || stats.monthly.length === 0}
              height={300}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthly} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="contracts" name="Contracts" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="sales" name="Sales Orders" stroke={CHART_COLORS[2]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Records by Sales Org"
              subtitle="Row distribution"
              icon={<Building2 className="h-4 w-4" />}
              empty={empty || stats.salesOrgData.length === 0}
              height={300}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salesOrgData} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {stats.salesOrgData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          {/* Row C */}
          <section className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Contract Release Pipeline"
              subtitle="Status counts across release levels (STATUS_1_C … STATUS_8_C)"
              icon={<Workflow className="h-4 w-4" />}
              empty={empty || stats.releaseData.length === 0}
              height={320}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.releaseData} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Approved" stackId="s" fill={STATUS_COLORS.Approved} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Pending" stackId="s" fill={STATUS_COLORS.Pending} />
                  <Bar dataKey="Rejected" stackId="s" fill={STATUS_COLORS.Rejected} />
                  <Bar dataKey="Other" stackId="s" fill={STATUS_COLORS.Other} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Approval Throughput"
              subtitle="Contract PH_STATUS distribution"
              icon={<PieIcon className="h-4 w-4" />}
              empty={empty || stats.phData.length === 0}
              height={320}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.phData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    label={(e: any) => `${e.name}: ${e.value}`}
                  >
                    {stats.phData.map((d, i) => (
                      <Cell key={i} fill={STATUS_COLORS[d.name as StatusBucket]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          {/* Row D */}
          <section className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Top Materials by Contract Value"
              subtitle="Top 8 material codes"
              icon={<Package className="h-4 w-4" />}
              empty={empty || stats.topMaterials.length === 0}
              height={300}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topMaterials} margin={{ left: 0, right: 12 }}>
                  <defs>
                    <linearGradient id="grad-mat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38 92% 55%)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(24 90% 58%)" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => fmtCompact(v)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <Bar dataKey="value" fill="url(#grad-mat)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

          </section>

          {/* Footer micro-KPIs */}
          <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MicroTile label="Billing Docs" value={fmtInt(stats.billingDocs)} icon={<Receipt className="h-4 w-4" />} />
            <MicroTile label="Accounting Docs" value={fmtInt(stats.acctDocs)} icon={<Landmark className="h-4 w-4" />} />
            <MicroTile label="Service Certificates" value={fmtInt(stats.serviceCerts)} icon={<FileCheck2 className="h-4 w-4" />} />
            <MicroTile label="Avg Contract Value" value={fmtCompact(stats.avgContract)} icon={<Wallet className="h-4 w-4" />} />
          </section>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  empty,
  height,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  empty?: boolean;
  height: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-4 shadow-card transition-shadow hover:shadow-elegant", className)}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {icon && <span className="text-muted-foreground/70 shrink-0">{icon}</span>}
      </div>
      <div style={{ height }}>{empty ? <EmptyChart /> : children}</div>
    </Card>
  );
}

function MicroTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-4 flex items-center gap-3 shadow-card">
      <div
        className="h-10 w-10 rounded-lg grid place-items-center text-primary"
        style={{ background: "hsl(var(--primary) / 0.10)" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-semibold tabular-nums leading-tight">{value}</p>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[380px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[340px] rounded-xl" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground">
      No data available for the current selection.
    </div>
  );
}
