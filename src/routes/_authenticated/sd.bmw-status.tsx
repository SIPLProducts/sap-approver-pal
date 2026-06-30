import { useState } from "react";
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
import { PlantSelect } from "@/components/sap/plant-select";
import { fetchBmwStatusReport, type BmwStatusRow } from "@/lib/sd/bmw-status-report.functions";

type Mode = "customer" | "contract" | "sales";

type ColType = "text" | "date" | "decimal3" | "currency2" | "int" | "status";
type ColGroup = "core" | "bp" | "contract";
type ColDef = { key: string; label: string; type: ColType; group: ColGroup };

const COLUMN_SCHEMA: ColDef[] = [
  { key: "COMPANY_CODE", label: "Company Code", type: "text", group: "core" },
  { key: "SALES_ORG", label: "Sales Org", type: "text", group: "core" },
  { key: "CUSTOMER", label: "Customer", type: "text", group: "core" },
  { key: "CUSTOMER_NAME", label: "Customer Name", type: "text", group: "core" },
  { key: "DIS_CHANNEL", label: "Dist. Channel", type: "text", group: "core" },
  { key: "DIVISION", label: "Division", type: "text", group: "core" },

  { key: "BP_CUS_GROUP", label: "Cust. Group", type: "text", group: "bp" },
  { key: "BP_PRICE_GROUP", label: "Price Group", type: "text", group: "bp" },
  { key: "BP_SRV_VALID_FROM", label: "Srv Valid From", type: "date", group: "bp" },
  { key: "BP_SRV_VALID_TO", label: "Srv Valid To", type: "date", group: "bp" },
  { key: "BP_SRV_START_DATE", label: "Srv Start Date", type: "date", group: "bp" },
  { key: "BP_REG_DATE", label: "Reg. Date", type: "date", group: "bp" },
  { key: "BP_UPPER_SLAB", label: "Upper Slab Qty", type: "decimal3", group: "bp" },
  { key: "BP_NO_BEDS_INVOICE", label: "Beds to Invoice", type: "int", group: "bp" },
  { key: "BP_AGR_VALID_FROM", label: "Agr. Valid From", type: "date", group: "bp" },
  { key: "BP_AGR_VALID_TO", label: "Agr. Valid To", type: "date", group: "bp" },
  { key: "BP_ACTIVE_INACTIVE", label: "Status", type: "status", group: "bp" },
  { key: "BP_FIXED_RATE", label: "Fixed Rate", type: "decimal3", group: "bp" },
  { key: "BP_PER_BED_RATE", label: "Per Bed Rate", type: "decimal3", group: "bp" },
  { key: "BP_EXCESS_QTY_RATE", label: "Excess Qty Rate", type: "decimal3", group: "bp" },

  { key: "CONTRACT_NO", label: "Contract No", type: "text", group: "contract" },
  { key: "CONTRACT_ITEM", label: "Item", type: "int", group: "contract" },
  { key: "CONTRACT_CREATE_DATE", label: "Create Date", type: "date", group: "contract" },
  { key: "CONTRACT_CREATED_BY", label: "Created By", type: "text", group: "contract" },
  { key: "MATERIAL_CODE", label: "Material Code", type: "text", group: "contract" },
  { key: "NET_VALUE", label: "Net Value", type: "currency2", group: "contract" },
  { key: "TAX", label: "Tax", type: "currency2", group: "contract" },
  { key: "TOTAL", label: "Total", type: "currency2", group: "contract" },
  { key: "CON_CUS_GROUP", label: "Con Cust. Group", type: "text", group: "contract" },
  { key: "CON_PRICE_GROUP", label: "Con Price Group", type: "text", group: "contract" },
  { key: "CON_SRV_VALID_FROM", label: "Con Srv Valid From", type: "date", group: "contract" },
  { key: "CON_SRV_VALID_TO", label: "Con Srv Valid To", type: "date", group: "contract" },
  { key: "CON_SRV_START_DATE", label: "Con Srv Start", type: "date", group: "contract" },
  { key: "CON_REG_DATE", label: "Con Reg. Date", type: "date", group: "contract" },
  { key: "CON_UPPER_SLAB", label: "Con Upper Slab", type: "decimal3", group: "contract" },
  { key: "CON_NO_BEDS_INVOICE", label: "Con Beds to Invoice", type: "int", group: "contract" },
  { key: "CON_AGR_VALID_FROM", label: "Con Agr. Valid From", type: "date", group: "contract" },
  { key: "CON_AGR_VALID_TO", label: "Con Agr. Valid To", type: "date", group: "contract" },
  { key: "CON_ACTIVE_INACTIVE", label: "Con Status", type: "status", group: "contract" },
  { key: "CON_FIXED_RATE", label: "Con Fixed Rate", type: "decimal3", group: "contract" },
  { key: "CON_PER_BED_RATE", label: "Con Per Bed Rate", type: "decimal3", group: "contract" },
  { key: "CON_EXCESS_QTY_RATE", label: "Con Excess Qty Rate", type: "decimal3", group: "contract" },
];

const GROUP_META: Record<ColGroup, { label: string; className: string }> = {
  core: { label: "Core", className: "bg-muted/60" },
  bp: { label: "Business Partner", className: "bg-blue-500/10" },
  contract: { label: "Contract", className: "bg-emerald-500/10" },
};

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s === "0000-00-00";
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
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
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
      return v;
    },
    onSuccess: (res: any) => {
      const r = Array.isArray(res?.rows) ? (res.rows as BmwStatusRow[]) : [];
      setRows(r);
      setLastFetchedAt(res?.fetched_at ?? new Date().toISOString());
      if (res?.error) toast.error(res.error);
      else toast.success(`Loaded ${r.length} record${r.length === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch report"),
  });

  function execute() {
    if (!salesOrgFrom.trim()) return toast.error("Select Sales Organization From");
    if (!salesOrgTo.trim()) return toast.error("Select Sales Organization To");
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
  }

  const canExecute = !!salesOrgFrom && !!salesOrgTo && !mutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">BMW Status Report</h1>
          <p className="text-sm text-muted-foreground">
            Customer / Contract / Sales-wise BMW status report fetched live from SAP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            BMW_STATUS
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Read-only
          </Badge>
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
            <Input
              value={customerFrom}
              onChange={(e) => setCustomerFrom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="e.g. 1060002"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer To</Label>
            <Input
              value={customerTo}
              onChange={(e) => setCustomerTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Contract/sales created from</Label>
            <Input
              value={contractFrom}
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

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Report Output</div>
            <div className="text-xs text-muted-foreground">
              {rows.length} record{rows.length === 1 ? "" : "s"}
              {lastFetchedAt ? ` · fetched ${new Date(lastFetchedAt).toLocaleTimeString()}` : ""}
            </div>
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {mutation.isPending ? "Fetching…" : "No data. Set filters and click Execute."}
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th rowSpan={2} className="text-left font-semibold px-3 py-2 w-10 bg-muted/70 border-b align-bottom">
                    #
                  </th>
                  {(["core", "bp", "contract"] as ColGroup[]).map((g) => {
                    const span = COLUMN_SCHEMA.filter((c) => c.group === g).length;
                    const meta = GROUP_META[g];
                    return (
                      <th
                        key={g}
                        colSpan={span}
                        className={`text-center font-semibold px-3 py-1.5 border-b border-l text-[11px] uppercase tracking-wide ${meta.className}`}
                      >
                        {meta.label}
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-muted/50">
                  {COLUMN_SCHEMA.map((c, idx) => {
                    const prev = COLUMN_SCHEMA[idx - 1];
                    const groupBoundary = !prev || prev.group !== c.group;
                    const align =
                      c.type === "decimal3" || c.type === "currency2" || c.type === "int" ? "text-right" : "text-left";
                    return (
                      <th
                        key={c.key}
                        className={`${align} font-semibold px-3 py-2 whitespace-nowrap border-b ${groupBoundary ? "border-l" : ""}`}
                        title={c.key}
                      >
                        {c.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    {COLUMN_SCHEMA.map((c, idx) => {
                      const prev = COLUMN_SCHEMA[idx - 1];
                      const groupBoundary = !prev || prev.group !== c.group;
                      const raw = r[c.key];
                      let content: React.ReactNode = "—";
                      let align = "text-left";
                      if (c.type === "date") {
                        const f = formatDate(raw);
                        if (f) content = f;
                      } else if (c.type === "decimal3") {
                        align = "text-right tabular-nums";
                        const f = formatNumber(raw, 3);
                        if (f) content = f;
                      } else if (c.type === "currency2") {
                        align = "text-right tabular-nums";
                        const f = formatNumber(raw, 2);
                        if (f) content = f;
                      } else if (c.type === "int") {
                        align = "text-right tabular-nums";
                        if (!isEmpty(raw)) {
                          const n = parseInt(String(raw).trim(), 10);
                          if (Number.isFinite(n)) content = String(n);
                        }
                      } else if (c.type === "status") {
                        if (!isEmpty(raw)) {
                          const s = String(raw).trim();
                          const active = s === "01";
                          content = (
                            <Badge variant={active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                              {active ? "Active" : "Inactive"}
                            </Badge>
                          );
                        }
                      } else {
                        if (!isEmpty(raw)) content = String(raw).trim();
                      }
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-2 whitespace-nowrap ${align} ${groupBoundary ? "border-l" : ""}`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
