import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import { PlantSelect } from "@/components/sap/plant-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import { fetchBmwStatusReport, type BmwStatusRow } from "@/lib/sd/bmw-status-report.functions";

type Mode = "customer" | "contract" | "sales";

type ColType = "text" | "date" | "decimal3" | "currency2" | "int" | "status";
type ColGroup =
  | "core"
  | "bp"
  | "mbd"
  | "contract"
  | "release_c"
  | "ph"
  | "service_cert"
  | "ph_sales"
  | "sales"
  | "release_s"
  | "billing"
  | "extra";
type ColDef = { key: string; label: string; type: ColType; group: ColGroup; aliases?: string[] };

const CORE_COLS: ColDef[] = [
  { key: "COMPANY_CODE", label: "Company Code", type: "text", group: "core" },
  { key: "SALES_ORG", label: "Sales Org", type: "text", group: "core" },
  { key: "CUSTOMER", label: "Customer", type: "text", group: "core" },
  { key: "CUSTOMER_NAME", label: "Customer Name", type: "text", group: "core" },
  { key: "DIS_CHANNEL", label: "Dist. Channel", type: "text", group: "core" },
  { key: "DIVISION", label: "Division", type: "text", group: "core" },
];

const BP_COLS: ColDef[] = [
  { key: "BP_CUS_GROUP", label: "Cust. Group", type: "text", group: "bp" },
  { key: "BP_PRICE_GROUP", label: "Price Group", type: "text", group: "bp" },
  { key: "BP_SERVICE_VALID_FROM", aliases: ["BP_SRV_VALID_FROM"], label: "Srv Valid From", type: "date", group: "bp" },
  { key: "BP_SERVICE_VALID_TO", aliases: ["BP_SRV_VALID_TO"], label: "Srv Valid To", type: "date", group: "bp" },
  { key: "BP_SERVICE_START_DATE", aliases: ["BP_SRV_START_DATE"], label: "Srv Start Date", type: "date", group: "bp" },
  { key: "BP_REG_DATE", label: "Reg. Date", type: "date", group: "bp" },
  { key: "BP_UPPER_SLAB", label: "Upper Slab", type: "decimal3", group: "bp" },
  { key: "BP_NO_BEDS_INV", aliases: ["BP_NO_BEDS_INVOICE"], label: "Beds to Invoice", type: "int", group: "bp" },
  { key: "BP_AGR_FROM", aliases: ["BP_AGR_VALID_FROM"], label: "Agr. Valid From", type: "date", group: "bp" },
  { key: "BP_AGR_TO", aliases: ["BP_AGR_VALID_TO"], label: "Agr. Valid To", type: "date", group: "bp" },
  { key: "BP_ACTIVE_INACTIVE", label: "Status", type: "status", group: "bp" },
  { key: "BP_FIXED_RATE", label: "Fixed Rate", type: "currency2", group: "bp" },
  { key: "BP_PER_BED_RATE", label: "Per Bed Rate", type: "currency2", group: "bp" },
  { key: "BP_EXCESS_QTY_RATE", label: "Excess Qty Rate", type: "currency2", group: "bp" },
];

const MBD_COLS: ColDef[] = [
  { key: "MBD_ID", label: "MBD ID", type: "text", group: "mbd" },
  { key: "MBD_NAME", label: "MBD Name", type: "text", group: "mbd" },
];

const CONTRACT_COLS: ColDef[] = [
  { key: "CONTRACT_NO", label: "Contract No", type: "text", group: "contract" },
  { key: "CONTRACT_ITEM", label: "Item", type: "int", group: "contract" },
  { key: "CONTRACT_DATE", aliases: ["CONTRACT_CREATE_DATE"], label: "Create Date", type: "date", group: "contract" },
  { key: "CONTRACT_CREATED_BY", label: "Created By", type: "text", group: "contract" },
  { key: "MATERIAL_CODE", label: "Material Code", type: "text", group: "contract" },
  { key: "CONTRACT_NET_VALUE", aliases: ["NET_VALUE"], label: "Net Value", type: "currency2", group: "contract" },
  { key: "CONTRACT_TAX", aliases: ["TAX"], label: "Tax", type: "currency2", group: "contract" },
  { key: "CONTRACT_TOTAL", aliases: ["TOTAL"], label: "Total", type: "currency2", group: "contract" },
  { key: "CON_CUS_GROUP", label: "Con Cust. Group", type: "text", group: "contract" },
  { key: "CON_PRICE_GROUP", label: "Con Price Group", type: "text", group: "contract" },
  { key: "CON_SERVICE_VALID_FRM", aliases: ["CON_SRV_VALID_FROM"], label: "Con Srv Valid From", type: "date", group: "contract" },
  { key: "CON_SERVICE_VALID_TO", aliases: ["CON_SRV_VALID_TO"], label: "Con Srv Valid To", type: "date", group: "contract" },
  { key: "CON_SERVICE_START_DT", aliases: ["CON_SRV_START_DATE"], label: "Con Srv Start", type: "date", group: "contract" },
  { key: "CON_REG_DATE", label: "Con Reg. Date", type: "date", group: "contract" },
  { key: "CON_UPPER_SLAB", label: "Con Upper Slab", type: "decimal3", group: "contract" },
  { key: "CON_NO_BEDS_INV", aliases: ["CON_NO_BEDS_INVOICE"], label: "Con Beds to Invoice", type: "int", group: "contract" },
  { key: "CON_AGR_FROM", aliases: ["CON_AGR_VALID_FROM"], label: "Con Agr. Valid From", type: "date", group: "contract" },
  { key: "CON_AGR_TO", aliases: ["CON_AGR_VALID_TO"], label: "Con Agr. Valid To", type: "date", group: "contract" },
  { key: "CON_ACTIVE_INACTIVE", label: "Con Status", type: "status", group: "contract" },
  { key: "CON_FIXED_RATE", label: "Con Fixed Rate", type: "currency2", group: "contract" },
  { key: "CON_PER_BED_RATE", label: "Con Per Bed Rate", type: "currency2", group: "contract" },
  { key: "CON_EXCESS_QTY_RATE", label: "Con Excess Qty Rate", type: "currency2", group: "contract" },
];

function releaseCols(suffix: "_C" | "", group: ColGroup): ColDef[] {
  const out: ColDef[] = [];
  for (let n = 1; n <= 8; n++) {
    out.push({ key: `REL_${n}${suffix}`, label: `Release ${n}`, type: "text", group });
    out.push({ key: `STATUS_${n}${suffix}`, label: `Status ${n}`, type: "text", group });
    out.push({ key: `APP_REJ_DATE${n}${suffix}`, label: `Date ${n}`, type: "date", group });
    out.push({ key: `APP_REJ_REASON${n}${suffix}`, label: `Reason ${n}`, type: "text", group });
  }
  return out;
}

const PH_COLS: ColDef[] = [
  { key: "PH_APPROVE_TYPE", label: "Approve Type", type: "text", group: "ph" },
  { key: "PH_INITIATED_ID", label: "Initiated ID", type: "text", group: "ph" },
  { key: "PH_NAME", label: "Name", type: "text", group: "ph" },
  { key: "PH_INITIATED_DATE", label: "Initiated Date", type: "date", group: "ph" },
  { key: "PH_STATUS", label: "Status", type: "text", group: "ph" },
  { key: "PH_APPROVE_DATE", label: "Approve Date", type: "date", group: "ph" },
  { key: "PH_REASON", label: "Reason", type: "text", group: "ph" },
];

const SERVICE_CERT_COLS: ColDef[] = [
  { key: "SERVICE_CERT_NO", label: "Cert No", type: "text", group: "service_cert" },
  { key: "SERVICE_VALID_FROM", label: "Valid From", type: "date", group: "service_cert" },
  { key: "SERVICE_VALID_TO", label: "Valid To", type: "date", group: "service_cert" },
  { key: "ISSUE_DATE", label: "Issue Date", type: "date", group: "service_cert" },
  { key: "ISSUE_ID", label: "Issue ID", type: "text", group: "service_cert" },
];

const PH_SALES_COLS: ColDef[] = [
  { key: "PH_SALES_APPR_TYPE", label: "Approve Type", type: "text", group: "ph_sales" },
  { key: "PH_SALES_INIT_ID", label: "Initiated ID", type: "text", group: "ph_sales" },
  { key: "PH_SALES_NAME", label: "Name", type: "text", group: "ph_sales" },
  { key: "PH_SALES_INIT_DATE", label: "Initiated Date", type: "date", group: "ph_sales" },
  { key: "PH_SALES_STATUS", label: "Status", type: "text", group: "ph_sales" },
  { key: "PH_SALES_APPR_DATE", label: "Approve Date", type: "date", group: "ph_sales" },
];

const SALES_COLS: ColDef[] = [
  { key: "SALES_ORDER_NO", label: "Sales Order No", type: "text", group: "sales" },
  { key: "SALES_ITEM", label: "Item", type: "int", group: "sales" },
  { key: "SALES_CREATE_DATE", label: "Create Date", type: "date", group: "sales" },
  { key: "SALES_CREATED_BY", label: "Created By", type: "text", group: "sales" },
  { key: "SALES_MATERIAL", label: "Material", type: "text", group: "sales" },
  { key: "SALES_NET_VALUE", label: "Net Value", type: "currency2", group: "sales" },
  { key: "SALES_TAX", label: "Tax", type: "currency2", group: "sales" },
  { key: "SALES_TOTAL", label: "Total", type: "currency2", group: "sales" },
];

const BILLING_COLS: ColDef[] = [
  { key: "BILLING_DOC", label: "Billing Doc", type: "text", group: "billing" },
  { key: "ACCOUNTING_DOC", label: "Accounting Doc", type: "text", group: "billing" },
];

const CUSTOMER_SCHEMA: ColDef[] = [
  ...CORE_COLS,
  ...BP_COLS,
  ...MBD_COLS,
  ...CONTRACT_COLS,
];

const CONTRACT_SCHEMA: ColDef[] = [
  ...CUSTOMER_SCHEMA,
  ...releaseCols("_C", "release_c"),
  ...PH_COLS,
  ...SERVICE_CERT_COLS,
];

const SALES_SCHEMA: ColDef[] = [
  ...CONTRACT_SCHEMA,
  ...PH_SALES_COLS,
  ...SALES_COLS,
  ...releaseCols("", "release_s"),
  ...BILLING_COLS,
];

const SCHEMAS: Record<Mode, ColDef[]> = {
  customer: CUSTOMER_SCHEMA,
  contract: CONTRACT_SCHEMA,
  sales: SALES_SCHEMA,
};

const GROUP_META: Record<ColGroup, { label: string; className: string }> = {
  core: { label: "Core", className: "bg-muted/60" },
  bp: { label: "Business Partner", className: "bg-blue-500/10" },
  mbd: { label: "MBD", className: "bg-amber-500/10" },
  contract: { label: "Contract", className: "bg-emerald-500/10" },
  release_c: { label: "Contract Releases", className: "bg-violet-500/10" },
  ph: { label: "Pricing Head", className: "bg-fuchsia-500/10" },
  service_cert: { label: "Service Certificate", className: "bg-cyan-500/10" },
  ph_sales: { label: "PH Sales", className: "bg-pink-500/10" },
  sales: { label: "Sales Order", className: "bg-teal-500/10" },
  release_s: { label: "Sales Releases", className: "bg-indigo-500/10" },
  billing: { label: "Billing", className: "bg-orange-500/10" },
  extra: { label: "Other SAP Fields", className: "bg-muted/40" },
};

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s === "0000-00-00" || s === "--";
}

function valueForColumn(row: BmwStatusRow, col: ColDef): unknown {
  for (const key of [col.key, ...(col.aliases ?? [])]) {
    const value = row[key];
    if (!isEmpty(value)) return value;
  }
  return row[col.key];
}

function schemaWithSapExtras(schema: ColDef[], rows: BmwStatusRow[]): ColDef[] {
  const known = new Set(schema.flatMap((c) => [c.key, ...(c.aliases ?? [])]));
  const extra: ColDef[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      extra.push({ key, label: key, type: "text", group: "extra" });
    }
  }
  return extra.length ? [...schema, ...extra] : schema;
}

function formatNumber(v: unknown, decimals: number): string | null {
  if (isEmpty(v)) return null;
  const n = parseFloat(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(v: unknown): string | null {
  if (isEmpty(v)) return null;
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

type GroupSpan = { group: ColGroup; span: number };
function computeGroupSpans(schema: ColDef[]): GroupSpan[] {
  const out: GroupSpan[] = [];
  for (const c of schema) {
    const last = out[out.length - 1];
    if (last && last.group === c.group) last.span++;
    else out.push({ group: c.group, span: 1 });
  }
  return out;
}

export const Route = createFileRoute("/_authenticated/sd/bmw-status")({
  component: BmwStatusReportPage,
});

function BmwStatusReportPage() {
  const fetchFn = useServerFn(fetchBmwStatusReport);

  const [salesOrgFrom, setSalesOrgFrom] = useState("");
  const [salesOrgTo, setSalesOrgTo] = useState("");
  const [customerFrom, setCustomerFrom] = useState("");
  const [customerTo, setCustomerTo] = useState("");
  const [contractFrom, setContractFrom] = useState("");
  const [contractTo, setContractTo] = useState("");
  const [mode, setMode] = useState<Mode>("customer");

  const [rows, setRows] = useState<BmwStatusRow[]>([]);
  const [activeMode, setActiveMode] = useState<Mode>("customer");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);

  // Monotonic request id — a slower, older response can never overwrite the
  // result of a newer request (stale responses are dropped).
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
      if (res?.__reqId !== requestSeq.current) return; // stale response — ignore
      const r = Array.isArray(res?.rows) ? (res.rows as BmwStatusRow[]) : [];
      const dup = typeof res?.duplicates_removed === "number" ? res.duplicates_removed : 0;
      setRows(r);
      setDuplicatesRemoved(dup);
      setActiveMode((res?.mode as Mode) ?? mode);
      setLastFetchedAt(res?.fetched_at ?? new Date().toISOString());
      if (res?.error) toast.error(res.error);
      else
        toast.success(
          `Loaded ${r.length} record${r.length === 1 ? "" : "s"} from SAP` +
            (dup > 0 ? ` (${dup} exact duplicate row${dup === 1 ? "" : "s"} removed)` : ""),
        );
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch report"),
  });

  function execute() {
    if (mutation.isPending) return; // guard: no overlapping requests (Enter key path)
    if (!salesOrgFrom.trim()) return toast.error("Select Sales Organization From");
    setRows([]);
    setDuplicatesRemoved(0);
    setLastFetchedAt(null);
    setActiveMode(mode);
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
    setDuplicatesRemoved(0);
    setActiveMode("customer");
    setLastFetchedAt(null);
  }

  const canExecute = !!salesOrgFrom && !mutation.isPending;
  const schema = schemaWithSapExtras(SCHEMAS[activeMode], rows);



  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">BMW Status Report</h1>
        </div>
      </div>


      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Sales Organization From <span className="text-destructive">*</span>
            </Label>
            <PlantSelect value={salesOrgFrom} onChange={setSalesOrgFrom} placeholder="Select…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Sales Organization To <span className="text-destructive">*</span>
            </Label>
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
            <Label className="text-xs">Contract/sales created from</Label>
            <Input
              value={contractFrom}
              type="date"
              onChange={(e) => setContractFrom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contract/sales created to</Label>
            <Input
              value={contractTo}
              type="date"
              onChange={(e) => setContractTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
            <Label className="text-xs">
              Selection Type <span className="text-destructive">*</span>
            </Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex items-center gap-5 h-9">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="customer" id="bmw-r-cus" />
                Customer
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="contract" id="bmw-r-cont" />
                Contract
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="sales" id="bmw-r-sales" />
                Sales Order
              </label>
            </RadioGroup>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
          <Button size="sm" onClick={execute} disabled={!canExecute}>
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Execute
          </Button>
        </div>
      </Card>

      <CloudscapeApprovalTable
        title={`BMW Status Report${rows.length > 0 ? ` — ${activeMode}-wise` : ""}`}
        countLabel={`(${rows.length}${duplicatesRemoved > 0 ? ` · ${duplicatesRemoved} dup removed` : ""})`}
        rows={rows}
        rowKey={(_r, i) => String(i)}
        loading={mutation.isPending}
        emptyMessage={mutation.isPending ? "Fetching…" : "No data. Set filters and click Execute."}
        columns={buildDynamicColumns(rows)}
      />
    </div>
  );
}


