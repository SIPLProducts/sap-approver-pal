import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Filter,
  RotateCcw,
  Loader2,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Wallet,
  Receipt,
  Landmark,
  ShoppingCart,
  LayoutList,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlantSelect } from "@/components/sap/plant-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import { KpiTile } from "@/components/exec/kpi-tile";
import { fetchBmwStatusReport, type BmwStatusRow } from "@/lib/sd/bmw-status-report.functions";

type Mode = "customer" | "contract" | "sales";

export const Route = createFileRoute("/_authenticated/sd/bmw-status-dashboard")({
  head: () => ({
    meta: [
      { title: "BMW Status Dashboard" },
      {
        name: "description",
        content: "Interactive analytics on BMW status: KPIs, sales-org, customer and contract breakdowns.",
      },
    ],
  }),
  component: BmwStatusDashboardPage,
});

/* ------------------------------- helpers ------------------------------- */

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s === "0000-00-00" || s === "--";
}

function pick(row: BmwStatusRow, ...keys: string[]): string | number | null {
  for (const k of keys) {
    const v = row[k];
    if (!isEmpty(v)) return v as string | number;
  }
  return null;
}

function toNumber(v: unknown): number {
  if (isEmpty(v)) return 0;
  const n = parseFloat(String(v).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(v: unknown): "Active" | "Inactive" | "Unknown" {
  if (isEmpty(v)) return "Unknown";
  const s = String(v).trim().toUpperCase();
  if (s === "X" || s === "A" || s.startsWith("ACT")) return "Active";
  if (s === "I" || s.startsWith("INA")) return "Inactive";
  return s === "ACTIVE" ? "Active" : s === "INACTIVE" ? "Inactive" : "Unknown";
}

function parseSapDate(v: unknown): Date | null {
  if (isEmpty(v)) return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}

function fmtInr(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtInrShort(n: number) {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

/* ------------------------------- page ---------------------------------- */

function BmwStatusDashboardPage() {
  const fetchFn = useServerFn(fetchBmwStatusReport);

  // Selection screen state
  const [salesOrgFrom, setSalesOrgFrom] = useState("");
  const [salesOrgTo, setSalesOrgTo] = useState("");
  const [customerFrom, setCustomerFrom] = useState("");
  const [customerTo, setCustomerTo] = useState("");
  const [contractFrom, setContractFrom] = useState("");
  const [contractTo, setContractTo] = useState("");
  const [mode, setMode] = useState<Mode>("customer");

  // Loaded data
  const [rows, setRows] = useState<BmwStatusRow[]>([]);
  const [activeMode, setActiveMode] = useState<Mode>("customer");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // Interactive filters (post-fetch)
  const [fSalesOrg, setFSalesOrg] = useState<string>("all");
  const [fCustomer, setFCustomer] = useState<string>("all");
  const [fContract, setFContract] = useState<string>("all");
  const [fStatus, setFStatus] = useState<"all" | "Active" | "Inactive">("all");

  const requestSeq = useRef(0);
  const mutation = useMutation({
    mutationFn: async () => {
      const reqId = ++requestSeq.current;
      const v: any = await fetchFn({
        data: {
          sales_org_from: salesOrgFrom.trim(),
          sales_org_to: (salesOrgTo || salesOrgFrom).trim(),
          customer_from: customerFrom.trim(),
          customer_to: customerTo.trim(),
          contract_from: contractFrom.trim(),
          contract_to: contractTo.trim(),
          mode,
        },
      });
      return { ...v, __reqId: reqId };
    },
    onSuccess: (res: any) => {
      if (res?.__reqId !== requestSeq.current) return;
      const r = Array.isArray(res?.rows) ? (res.rows as BmwStatusRow[]) : [];
      setRows(r);
      setActiveMode((res?.mode as Mode) ?? mode);
      setLastFetchedAt(res?.fetched_at ?? new Date().toISOString());
      setFSalesOrg("all");
      setFCustomer("all");
      setFContract("all");
      setFStatus("all");
      if (res?.error) toast.error(res.error);
      else toast.success(`Loaded ${r.length} record${r.length === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch report"),
  });

  function execute() {
    if (mutation.isPending) return;
    if (!salesOrgFrom.trim()) return toast.error("Select Sales Organization From");
    if (!salesOrgTo.trim() && !salesOrgFrom.trim()) return toast.error("Select Sales Organization To");
    mutation.mutate();
  }
  function reset() {
    setSalesOrgFrom("");
    setSalesOrgTo("");
    setCustomerFrom("");
    setCustomerTo("");
    setContractFrom("");
    setContractTo("");
    setMode("customer");
    setRows([]);
    setLastFetchedAt(null);
    setFSalesOrg("all");
    setFCustomer("all");
    setFContract("all");
    setFStatus("all");
  }
  function clearInteractive() {
    setFSalesOrg("all");
    setFCustomer("all");
    setFContract("all");
    setFStatus("all");
  }

  /* ---------------- distinct values for interactive filters -------------- */
  const distinct = useMemo(() => {
    const so = new Set<string>();
    const cus = new Map<string, string>(); // code -> "code — name"
    const con = new Set<string>();
    for (const r of rows) {
      const s = pick(r, "SALES_ORG");
      if (s) so.add(String(s));
      const c = pick(r, "CUSTOMER");
      if (c) {
        const name = pick(r, "CUSTOMER_NAME");
        cus.set(String(c), name ? `${c} — ${name}` : String(c));
      }
      const cn = pick(r, "CONTRACT_NO");
      if (cn) con.add(String(cn));
    }
    return {
      salesOrgs: Array.from(so).sort(),
      customers: Array.from(cus.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      contracts: Array.from(con).sort(),
    };
  }, [rows]);

  /* --------------------------- filtered rows ---------------------------- */
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fSalesOrg !== "all" && String(pick(r, "SALES_ORG") ?? "") !== fSalesOrg) return false;
      if (fCustomer !== "all" && String(pick(r, "CUSTOMER") ?? "") !== fCustomer) return false;
      if (fContract !== "all" && String(pick(r, "CONTRACT_NO") ?? "") !== fContract) return false;
      if (fStatus !== "all") {
        const s = normalizeStatus(pick(r, "CON_ACTIVE_INACTIVE", "BP_ACTIVE_INACTIVE"));
        if (s !== fStatus) return false;
      }
      return true;
    });
  }, [rows, fSalesOrg, fCustomer, fContract, fStatus]);

  /* ------------------------------ aggregates ---------------------------- */
  const agg = useMemo(() => {
    const uniqCustomers = new Set<string>();
    const uniqContracts = new Set<string>();
    const uniqSalesOrders = new Set<string>();
    let active = 0;
    let inactive = 0;
    let net = 0;
    let tax = 0;
    let total = 0;
    let salesNet = 0;
    let salesTotal = 0;

    const bySalesOrgContracts = new Map<string, Set<string>>();
    const bySalesOrgValue = new Map<string, number>();
    const byCustomerValue = new Map<string, { name: string; value: number }>();
    const byMonth = new Map<string, number>();
    const topContracts: { contract: string; customer: string; value: number }[] = [];
    const contractSeen = new Set<string>();

    for (const r of filtered) {
      const cus = String(pick(r, "CUSTOMER") ?? "");
      if (cus) uniqCustomers.add(cus);
      const cno = String(pick(r, "CONTRACT_NO") ?? "");
      if (cno) uniqContracts.add(cno);
      const so = String(pick(r, "SALES_ORG") ?? "—");
      const sono = String(pick(r, "SALES_ORDER_NO") ?? "");
      if (sono) uniqSalesOrders.add(sono);

      const status = normalizeStatus(pick(r, "CON_ACTIVE_INACTIVE", "BP_ACTIVE_INACTIVE"));
      if (status === "Active") active++;
      else if (status === "Inactive") inactive++;

      const cn = toNumber(pick(r, "CONTRACT_NET_VALUE", "NET_VALUE"));
      const ct = toNumber(pick(r, "CONTRACT_TAX", "TAX"));
      const cT = toNumber(pick(r, "CONTRACT_TOTAL", "TOTAL"));
      net += cn;
      tax += ct;
      total += cT;

      salesNet += toNumber(pick(r, "SALES_NET_VALUE"));
      salesTotal += toNumber(pick(r, "SALES_TOTAL"));

      if (!bySalesOrgContracts.has(so)) bySalesOrgContracts.set(so, new Set());
      if (cno) bySalesOrgContracts.get(so)!.add(cno);
      bySalesOrgValue.set(so, (bySalesOrgValue.get(so) ?? 0) + cT);

      if (cus) {
        const name = String(pick(r, "CUSTOMER_NAME") ?? cus);
        const prev = byCustomerValue.get(cus) ?? { name, value: 0 };
        prev.value += cT;
        byCustomerValue.set(cus, prev);
      }

      const d = parseSapDate(pick(r, "CONTRACT_DATE", "CONTRACT_CREATE_DATE"));
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, (byMonth.get(key) ?? 0) + (cno && !contractSeen.has(cno + key) ? 1 : 0));
        contractSeen.add(cno + key);
      }

      if (cno) {
        topContracts.push({
          contract: cno,
          customer: String(pick(r, "CUSTOMER_NAME") ?? pick(r, "CUSTOMER") ?? "—"),
          value: cT,
        });
      }
    }

    const contractsBySalesOrg = Array.from(bySalesOrgContracts.entries())
      .map(([so, set]) => ({ name: so, value: set.size }))
      .sort((a, b) => b.value - a.value);
    const valueBySalesOrg = Array.from(bySalesOrgValue.entries())
      .map(([so, v]) => ({ name: so, value: v }))
      .sort((a, b) => b.value - a.value);
    const topCustomers = Array.from(byCustomerValue.entries())
      .map(([code, v]) => ({ name: v.name.length > 22 ? v.name.slice(0, 22) + "…" : v.name, code, value: v.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const monthTrend = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ month: k, contracts: v }));
    // Dedup contracts, keep max value
    const tcMap = new Map<string, { contract: string; customer: string; value: number }>();
    for (const t of topContracts) {
      const prev = tcMap.get(t.contract);
      if (!prev || t.value > prev.value) tcMap.set(t.contract, t);
    }
    const topContractsList = Array.from(tcMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      totalRecords: filtered.length,
      uniqCustomers: uniqCustomers.size,
      uniqContracts: uniqContracts.size,
      uniqSalesOrders: uniqSalesOrders.size,
      active,
      inactive,
      net,
      tax,
      total,
      salesNet,
      salesTotal,
      contractsBySalesOrg,
      valueBySalesOrg,
      statusPie: [
        { name: "Active", value: active },
        { name: "Inactive", value: inactive },
      ].filter((x) => x.value > 0),
      topCustomers,
      monthTrend,
      topContractsList,
    };
  }, [filtered]);

  const hasData = rows.length > 0;
  const showContractFilter = activeMode !== "customer";

  const colors = {
    primary: "hsl(var(--primary))",
    success: "hsl(var(--success, 142 71% 45%))",
    destructive: "hsl(var(--destructive))",
    info: "hsl(var(--info, 199 89% 48%))",
    warning: "hsl(var(--warning, 38 92% 50%))",
    muted: "hsl(var(--muted-foreground))",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="outline" size="icon" aria-label="Back to BMW Status Report">
            <Link to="/sd/bmw-status">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">BMW Status Dashboard</h1>
            <p className="text-xs text-muted-foreground truncate">
              {lastFetchedAt
                ? `Last refreshed ${new Date(lastFetchedAt).toLocaleString()} · ${rows.length} raw records`
                : "Select filters and click Execute to load live data from SAP."}
            </p>
          </div>
        </div>
      </div>

      {/* Selection screen */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Sales Organization From <span className="text-destructive">*</span></Label>
            <PlantSelect value={salesOrgFrom} onChange={setSalesOrgFrom} placeholder="Select…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sales Organization To <span className="text-destructive">*</span></Label>
            <PlantSelect value={salesOrgTo} onChange={setSalesOrgTo} placeholder="Select…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer From</Label>
            <CustomerSelect
              value={customerFrom}
              onChange={setCustomerFrom}
              plants={salesOrgFrom ? [salesOrgFrom] : []}
              onEnter={execute}
              placeholder="Select customer…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer To</Label>
            <CustomerSelect
              value={customerTo}
              onChange={setCustomerTo}
              plants={salesOrgFrom ? [salesOrgFrom] : []}
              onEnter={execute}
              placeholder="Select customer…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Created From</Label>
            <Input type="date" value={contractFrom} onChange={(e) => setContractFrom(e.target.value)} className="h-9 font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Created To</Label>
            <Input type="date" value={contractTo} onChange={(e) => setContractTo(e.target.value)} className="h-9 font-mono" />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">Selection Type <span className="text-destructive">*</span></Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex flex-wrap gap-4 h-9 items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="customer" /> Customer
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="contract" /> Contract
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="sales" /> Sales
              </label>
            </RadioGroup>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={execute} disabled={!salesOrgFrom || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            Execute
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
        </div>
      </Card>

      {/* Empty state */}
      {!hasData && !mutation.isPending && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Select filters and click <strong>Execute</strong> to load dashboard data from SAP.
        </Card>
      )}

      {/* Loading skeleton */}
      {mutation.isPending && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-5 h-28 animate-pulse bg-muted/30" />
          ))}
        </div>
      )}

      {hasData && !mutation.isPending && (
        <>
          {/* Interactive filters */}
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
              <Filter className="h-3.5 w-3.5" /> DASHBOARD FILTERS
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Sales Organization</Label>
                <Select value={fSalesOrg} onValueChange={setFSalesOrg}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({distinct.salesOrgs.length})</SelectItem>
                    {distinct.salesOrgs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Customer</Label>
                <Select value={fCustomer} onValueChange={setFCustomer}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">All ({distinct.customers.length})</SelectItem>
                    {distinct.customers.map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {showContractFilter && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Contract Number</Label>
                  <Select value={fContract} onValueChange={setFContract}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="all">All ({distinct.contracts.length})</SelectItem>
                      {distinct.contracts.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={fStatus} onValueChange={(v) => setFStatus(v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button variant="ghost" size="sm" onClick={clearInteractive}>Clear filters</Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Mode: {activeMode}</Badge>
              <Badge variant="outline">{filtered.length} of {rows.length} records</Badge>
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            <KpiTile label="Total Records" value={agg.totalRecords.toLocaleString()} icon={<LayoutList className="h-4 w-4" />} accent="primary" />
            <KpiTile label="Unique Customers" value={agg.uniqCustomers.toLocaleString()} icon={<Users className="h-4 w-4" />} accent="info" />
            <KpiTile label="Unique Contracts" value={agg.uniqContracts.toLocaleString()} icon={<FileText className="h-4 w-4" />} accent="gold" />
            <KpiTile label="Active" value={agg.active.toLocaleString()} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
            <KpiTile label="Inactive" value={agg.inactive.toLocaleString()} icon={<XCircle className="h-4 w-4" />} accent="destructive" />
            <KpiTile label="Net Value" value={fmtInrShort(agg.net)} sub={`₹${fmtInr(agg.net)}`} icon={<Wallet className="h-4 w-4" />} accent="primary" />
            <KpiTile label="Tax" value={fmtInrShort(agg.tax)} sub={`₹${fmtInr(agg.tax)}`} icon={<Receipt className="h-4 w-4" />} accent="warning" />
            <KpiTile label="Grand Total" value={fmtInrShort(agg.total)} sub={`₹${fmtInr(agg.total)}`} icon={<Landmark className="h-4 w-4" />} accent="gold" lead />
            {activeMode === "sales" && (
              <>
                <KpiTile label="Sales Orders" value={agg.uniqSalesOrders.toLocaleString()} icon={<ShoppingCart className="h-4 w-4" />} accent="info" />
                <KpiTile label="Sales Total" value={fmtInrShort(agg.salesTotal)} sub={`₹${fmtInr(agg.salesTotal)}`} icon={<Wallet className="h-4 w-4" />} accent="success" />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Contracts by Sales Organization</h3>
                <p className="text-xs text-muted-foreground">Distinct contract count per sales org</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agg.contractsBySalesOrg}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: colors.muted }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Contracts" fill={colors.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Net Value by Sales Organization</h3>
                <p className="text-xs text-muted-foreground">Sum of contract totals per sales org</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agg.valueBySalesOrg}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickFormatter={fmtInrShort} />
                    <Tooltip formatter={(v: any) => `₹${fmtInr(Number(v))}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Total Value" fill={colors.info} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Active vs Inactive</h3>
                <p className="text-xs text-muted-foreground">Contract status distribution</p>
              </div>
              <div className="h-64">
                {agg.statusPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agg.statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {agg.statusPie.map((entry, i) => (
                          <Cell key={i} fill={entry.name === "Active" ? colors.success : colors.destructive} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">No status data</div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Contract Creation Trend</h3>
                <p className="text-xs text-muted-foreground">Contracts created per month</p>
              </div>
              <div className="h-64">
                {agg.monthTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={agg.monthTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: colors.muted }} />
                      <YAxis tick={{ fontSize: 11, fill: colors.muted }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="contracts" stroke={colors.primary} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">No date data</div>
                )}
              </div>
            </Card>

            <Card className="p-4 lg:col-span-2">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Top 10 Customers by Total Value</h3>
                <p className="text-xs text-muted-foreground">Highest-value customers in the filtered dataset</p>
              </div>
              <div className="h-80">
                {agg.topCustomers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agg.topCustomers} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: colors.muted }} tickFormatter={fmtInrShort} />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: colors.muted }} />
                      <Tooltip formatter={(v: any) => `₹${fmtInr(Number(v))}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" fill={colors.primary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">No customer data</div>
                )}
              </div>
            </Card>

            <Card className="p-4 lg:col-span-2">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Top 10 Contracts by Value</h3>
              </div>
              {agg.topContractsList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                        <th className="py-2 px-3">Contract</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3 text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agg.topContractsList.map((c) => (
                        <tr key={c.contract} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 font-mono text-xs">{c.contract}</td>
                          <td className="py-2 px-3">{c.customer}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">₹{fmtInr(c.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contracts to show.</p>
              )}
            </Card>
          </div>

          {filtered.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No records match the current dashboard filters.
            </Card>
          )}
        </>
      )}
    </div>
  );
}
