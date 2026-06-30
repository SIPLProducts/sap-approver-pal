import { useMemo, useState } from "react";
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
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import {
  fetchBmwStatusReport,
  type BmwStatusRow,
} from "@/lib/sd/bmw-status-report.functions";

type Mode = "customer" | "contract" | "sales";

export const Route = createFileRoute("/_authenticated/sd/bmw-status")({
  component: BmwStatusReportPage,
});

function BmwStatusReportPage() {
  const fetchFn = useServerFn(fetchBmwStatusReport);

  const [salesOrgs, setSalesOrgs] = useState<string[]>([]);
  const [customerFrom, setCustomerFrom] = useState("");
  const [customerTo, setCustomerTo] = useState("");
  const [contractFrom, setContractFrom] = useState("");
  const [contractTo, setContractTo] = useState("");
  const [mode, setMode] = useState<Mode>("customer");

  const [rows, setRows] = useState<BmwStatusRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const salesOrgFrom = useMemo(() => {
    if (salesOrgs.length === 0) return "";
    return [...salesOrgs].sort()[0];
  }, [salesOrgs]);
  const salesOrgTo = useMemo(() => {
    if (salesOrgs.length === 0) return "";
    return [...salesOrgs].sort()[salesOrgs.length - 1];
  }, [salesOrgs]);

  const mutation = useMutation({
    mutationFn: async () => {
      const v: any = await fetchFn({
        data: {
          sales_org_from: salesOrgFrom,
          sales_org_to: salesOrgTo,
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
      setColumns(Array.isArray(res?.columns) ? res.columns : r.length > 0 ? Object.keys(r[0]) : []);
      setLastFetchedAt(res?.fetched_at ?? new Date().toISOString());
      if (res?.error) toast.error(res.error);
      else toast.success(`Loaded ${r.length} record${r.length === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch report"),
  });

  function execute() {
    if (salesOrgs.length === 0) return toast.error("Select at least one Sales Organization");
    mutation.mutate();
  }

  function reset() {
    setSalesOrgs([]);
    setCustomerFrom("");
    setCustomerTo("");
    setContractFrom("");
    setContractTo("");
    setMode("customer");
    setRows([]);
    setColumns([]);
    setLastFetchedAt(null);
  }

  const canExecute = salesOrgs.length > 0 && !mutation.isPending;

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
          <Badge variant="outline" className="font-mono text-xs">BMW_STATUS</Badge>
          <Badge variant="secondary" className="text-xs">Read-only</Badge>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-3 items-end">
          <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
            <Label className="text-xs">
              Sales Organization (From – To) <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect
              value={salesOrgs}
              onChange={setSalesOrgs}
              placeholder="Select sales organizations…"
            />
            {salesOrgs.length > 0 && (
              <p className="text-[11px] text-muted-foreground font-mono">
                FROM {salesOrgFrom} → TO {salesOrgTo}
              </p>
            )}
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
          <div />

          <div className="space-y-1.5">
            <Label className="text-xs">Contract From</Label>
            <Input
              value={contractFrom}
              onChange={(e) => setContractFrom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contract To</Label>
            <Input
              value={contractTo}
              onChange={(e) => setContractTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={!canExecute}>
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
          </div>
        </div>

        <div className="mt-4 -mx-4 px-4 pt-3 border-t">
          <div className="flex items-center gap-6 flex-wrap">
            <Label className="text-xs text-muted-foreground">
              Selection Type <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className="flex items-center gap-5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="customer" id="bmw-r-cus" />
                Customer-wise Selection
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="contract" id="bmw-r-cont" />
                Contract-wise Selection
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="sales" id="bmw-r-sales" />
                Sales-wise Selection
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Report Output
            </div>
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
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b sticky top-0 z-10">
                <tr>
                  <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                  {columns.map((c) => (
                    <th key={c} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    {columns.map((c) => (
                      <td key={c} className="px-3 py-2 whitespace-nowrap font-mono">
                        {r[c] == null || r[c] === "" ? "—" : String(r[c])}
                      </td>
                    ))}
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
