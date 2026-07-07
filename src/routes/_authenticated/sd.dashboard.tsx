import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Building2,
  FileText,
  Loader2,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
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
import { KpiTile } from "@/components/exec/kpi-tile";
import { useActiveContext } from "@/hooks/use-active-context";
import { fetchBmwStatusReport, type BmwStatusRow } from "@/lib/sd/bmw-status-report.functions";

export const Route = createFileRoute("/_authenticated/sd/dashboard")({
  component: SdDashboardPage,
});

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info, 210 90% 55%))",
  "hsl(var(--success, 145 65% 45%))",
  "hsl(var(--warning, 38 92% 55%))",
  "hsl(var(--destructive))",
  "hsl(262 80% 60%)",
  "hsl(190 85% 50%)",
  "hsl(24 90% 58%)",
  "hsl(340 82% 60%)",
  "hsl(160 70% 45%)",
];

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

function SdDashboardPage() {
  const fetchFn = useServerFn(fetchBmwStatusReport);
  const { activePlants } = useActiveContext();

  const sorted = useMemo(() => [...activePlants].sort(), [activePlants]);
  const from = sorted[0] ?? "";
  const to = sorted[sorted.length - 1] ?? "";

  const query = useQuery({
    queryKey: ["sd-dashboard-bmw", from, to],
    enabled: !!from && !!to,
    staleTime: 60_000,
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
    const bySalesOrg = new Map<string, number>();
    const byCustomerValue = new Map<string, { name: string; value: number }>();
    const byContractMonth = new Map<string, number>();
    let contractValue = 0;
    let salesValue = 0;
    let activeBp = 0;
    let inactiveBp = 0;
    const seenBp = new Set<string>();

    for (const r of rows) {
      const cust = nonEmpty(r.CUSTOMER);
      if (cust) customers.add(cust);
      const contract = nonEmpty(r.CONTRACT_NO);
      if (contract) contracts.add(contract);
      const so = nonEmpty(r.SALES_ORDER_NO);
      if (so) salesOrders.add(so);

      const org = nonEmpty(r.SALES_ORG) ?? "—";
      bySalesOrg.set(org, (bySalesOrg.get(org) ?? 0) + 1);

      const cnv = toNum(r.CONTRACT_NET_VALUE ?? r.NET_VALUE);
      contractValue += cnv;
      salesValue += toNum(r.SALES_NET_VALUE);

      if (cust) {
        const label =
          nonEmpty(r.CUSTOMER_NAME) ?? cust;
        const cur = byCustomerValue.get(cust) ?? { name: label, value: 0 };
        cur.value += cnv;
        cur.name = label;
        byCustomerValue.set(cust, cur);
      }

      const cd = nonEmpty(r.CONTRACT_DATE) ?? nonEmpty(r.CONTRACT_CREATE_DATE);
      if (cd) {
        const m = /^(\d{4})-(\d{2})/.exec(cd);
        if (m) {
          const key = `${m[1]}-${m[2]}`;
          byContractMonth.set(key, (byContractMonth.get(key) ?? 0) + 1);
        }
      }

      if (cust && !seenBp.has(cust)) {
        seenBp.add(cust);
        const st = nonEmpty(r.BP_ACTIVE_INACTIVE);
        if (st === "01") activeBp++;
        else if (st) inactiveBp++;
      }
    }

    const salesOrgData = Array.from(bySalesOrg.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topCustomers = Array.from(byCustomerValue.values())
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((c) => ({
        name: c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name,
        value: Math.round(c.value),
      }));

    const monthly = Array.from(byContractMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

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
      salesOrgData,
      topCustomers,
      monthly,
      bpStatus,
    };
  }, [rows]);

  const hasContext = !!from && !!to;
  const loading = query.isFetching;
  const empty = !loading && hasContext && rows.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            SD Approvals · Analytics
          </p>
          <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            SD Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Live KPIs, trends and portfolio breakdowns from the BMW Status Report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasContext ? (
            <Badge variant="outline" className="font-mono text-xs">
              {from === to ? `Sales Org ${from}` : `${from} → ${to}`}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Select a plant in the top bar
            </Badge>
          )}
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Refreshing…
            </span>
          )}
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
      ) : (
        <>
          <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
              sub={`${fmtCompact(stats.contractValue)} net value`}
              icon={<FileText className="h-4 w-4" />}
              accent="gold"
            />
            <KpiTile
              label="Sales Orders"
              value={fmtInt(stats.salesOrders)}
              sub={`${fmtCompact(stats.salesValue)} net value`}
              icon={<ShoppingCart className="h-4 w-4" />}
              accent="success"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Top 10 Customers by Contract Value</h2>
                  <p className="text-xs text-muted-foreground">Aggregated across returned rows</p>
                </div>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="h-[320px]">
                {empty || stats.topCustomers.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topCustomers} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/50" />
                      <XAxis type="number" tickFormatter={fmtCompact} className="text-[10px]" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        className="text-[10px]"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(v: number) => fmtCompact(v)}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">BP Status</h2>
                  <p className="text-xs text-muted-foreground">Active vs inactive customers</p>
                </div>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="h-[320px]">
                {empty || stats.bpStatus.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.bpStatus}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        label={(e: any) => `${e.name}: ${e.value}`}
                      >
                        {stats.bpStatus.map((_, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? CHART_COLORS[2] : CHART_COLORS[4]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Records by Sales Org</h2>
                  <p className="text-xs text-muted-foreground">Row distribution</p>
                </div>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="h-[280px]">
                {empty || stats.salesOrgData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.salesOrgData} margin={{ left: 0, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" className="text-[10px]" />
                      <YAxis allowDecimals={false} className="text-[10px]" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stats.salesOrgData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Contracts by Month</h2>
                  <p className="text-xs text-muted-foreground">Last 12 months (contract create date)</p>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="h-[280px]">
                {empty || stats.monthly.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.monthly} margin={{ left: 0, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="month" className="text-[10px]" />
                      <YAxis allowDecimals={false} className="text-[10px]" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </section>
        </>
      )}
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
