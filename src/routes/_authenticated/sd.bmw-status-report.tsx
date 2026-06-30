import { useEffect, useMemo, useState } from "react";
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
import { useActiveContext } from "@/hooks/use-active-context";
import {
  fetchBmwStatusReport,
  type BmwStatusRow,
} from "@/lib/sd/bmw-status-report.functions";

export const Route = createFileRoute("/_authenticated/sd/bmw-status-report")({
  component: BmwStatusReportPage,
});

type Selection = "customer" | "contract" | "sales";

const COLUMNS: { label: string; keys: string[]; align?: "right"; date?: boolean; num?: boolean }[] = [
  { label: "Company Code", keys: ["COMPANY_CODE", "BUKRS"] },
  { label: "Sales Organization", keys: ["SALES_ORG", "VKORG", "PLANT"] },
  { label: "Customer Number", keys: ["CUSTOMER", "KUNNR", "CUSTOMER_NO"] },
  { label: "Customer Name", keys: ["CUSTOMER_NAME", "NAME1"] },
  { label: "Distribution Channel", keys: ["DIS_CHANEL", "DIS_CHANNEL", "VTWEG"] },
  { label: "Division", keys: ["DIVISION", "SPART"] },
  { label: "BP Customer Group", keys: ["BP_CUSTOMER_GROUP", "BP_CUST_GROUP", "KDGRP"] },
  { label: "BP Price Group", keys: ["BP_PRICE_GROUP", "KONDA"] },
  { label: "BP Service Valid From", keys: ["BP_SERV_VALID_FROM", "BP_SERVICE_VALID_FROM"], date: true },
  { label: "BP Service Valid To", keys: ["BP_SERV_VALID_TO", "BP_SERVICE_VALID_TO"], date: true },
  { label: "BP Service Start Date", keys: ["BP_SERV_START_DATE", "BP_SERVICE_START_DATE"], date: true },
  { label: "BP Registration Date", keys: ["BP_REG_DATE", "BP_REGISTRATION_DATE"], date: true },
  { label: "BP Upper Slab Qty", keys: ["BP_UPPER_SLAB_QTY", "BP_UPPER_SLAB"], align: "right", num: true },
  { label: "BP Beds to Invoice", keys: ["BP_BEDS_TO_INVOICE", "BP_NO_BEDS"], align: "right", num: true },
  { label: "BP Agreement Valid From", keys: ["BP_AGREE_VALID_FROM", "BP_AGREEMENT_FROM"], date: true },
  { label: "BP Agreement Valid To", keys: ["BP_AGREE_VALID_TO", "BP_AGREEMENT_TO"], date: true },
  { label: "BP Active/Inactive", keys: ["BP_ACTIVE", "BP_STATUS"] },
  { label: "BP Fixed Rate", keys: ["BP_FIXED_RATE"], align: "right", num: true },
  { label: "BP Per Bed Rate", keys: ["BP_PER_BED_RATE"], align: "right", num: true },
  { label: "BP Excess Qty Rate", keys: ["BP_EXCESS_QTY_RATE"], align: "right", num: true },
  { label: "Contract Number", keys: ["CONTRACT_NO", "CONTRACT", "VBELN"] },
  { label: "Contract Item No", keys: ["CONTRACT_ITEM", "POSNR"] },
  { label: "Contract Creation Date", keys: ["CONTRACT_CREATION_DATE", "ERDAT"], date: true },
  { label: "Contract Created By", keys: ["CONTRACT_CREATED_BY", "ERNAM"] },
  { label: "Material Code", keys: ["MATERIAL", "MATNR"] },
  { label: "Net Value", keys: ["NET_VALUE", "NETWR"], align: "right", num: true },
  { label: "Tax Amount", keys: ["TAX_VALUE", "TAX_AMOUNT", "MWSBP"], align: "right", num: true },
  { label: "Total Amount", keys: ["TOTAL_AMOUNT", "TOTAL_VALUE"], align: "right", num: true },
  { label: "Contract Customer Group", keys: ["CONTRACT_CUSTOMER_GROUP", "CONT_CUST_GROUP"] },
  { label: "Contract Price Group", keys: ["CONTRACT_PRICE_GROUP", "CONT_PRICE_GROUP"] },
  { label: "Contract Service Valid From", keys: ["CONT_SERV_VALID_FROM", "CONTRACT_SERVICE_VALID_FROM"], date: true },
  { label: "Contract Service Valid To", keys: ["CONT_SERV_VALID_TO", "CONTRACT_SERVICE_VALID_TO"], date: true },
  { label: "Contract Service Start Date", keys: ["CONT_SERV_START_DATE", "CONTRACT_SERVICE_START_DATE"], date: true },
  { label: "Contract Registration Date", keys: ["CONT_REG_DATE", "CONTRACT_REGISTRATION_DATE"], date: true },
  { label: "Contract Upper Slab Qty", keys: ["CONT_UPPER_SLAB_QTY"], align: "right", num: true },
  { label: "Contract Beds to Invoice", keys: ["CONT_BEDS_TO_INVOICE", "CONT_NO_BEDS"], align: "right", num: true },
  { label: "Contract Agreement Valid From", keys: ["CONT_AGREE_VALID_FROM", "CONTRACT_AGREEMENT_FROM"], date: true },
  { label: "Contract Agreement Valid To", keys: ["CONT_AGREE_VALID_TO", "CONTRACT_AGREEMENT_TO"], date: true },
  { label: "Contract Active/Inactive", keys: ["CONT_ACTIVE", "CONTRACT_STATUS"] },
  { label: "Contract Fixed Rate", keys: ["CONT_FIXED_RATE"], align: "right", num: true },
  { label: "Contract Per Bed Rate", keys: ["CONT_PER_BED_RATE"], align: "right", num: true },
  { label: "Contract Excess Qty Rate", keys: ["CONT_EXCESS_QTY_RATE"], align: "right", num: true },
];

function pick(row: any, keys: string[]): string | number | null {
  if (!row || typeof row !== "object") return null;
  const map = new Map<string, any>();
  for (const k of Object.keys(row)) map.set(k.toLowerCase(), row[k]);
  for (const k of keys) {
    const v = map.get(k.toLowerCase());
    if (v != null && v !== "") return v;
  }
  return null;
}

function fmtNum(v: string | number | null) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: string | number | null) {
  if (v == null || v === "") return "—";
  const s = String(v);
  if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
  const d = new Date(s);
  if (!isNaN(+d)) return d.toLocaleDateString("en-GB").replaceAll("/", ".");
  return s;
}

function BmwStatusReportPage() {
  const fetchFn = useServerFn(fetchBmwStatusReport);
  const { activePlant } = useActiveContext();

  const [plants, setPlants] = useState<string[]>(activePlant ? [activePlant] : []);
  useEffect(() => {
    if (activePlant && plants.length === 0) setPlants([activePlant]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlant]);

  const [selection, setSelection] = useState<Selection>("customer");
  const [customer, setCustomer] = useState("");
  const [contract, setContract] = useState("");
  const [salesDoc, setSalesDoc] = useState("");
  const [rows, setRows] = useState<BmwStatusRow[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      fetchFn({
        data: {
          plants,
          selection,
          customer: customer.trim(),
          contract: contract.trim(),
          sales_document: salesDoc.trim(),
        },
      }),
    onSuccess: (res: any) => {
      const list: BmwStatusRow[] = Array.isArray(res?.rows) ? res.rows : [];
      setRows(list);
      setLastFetchedAt(res?.fetched_at ?? new Date().toISOString());
      if (res?.error) toast.error(res.error);
      else toast.success(`Loaded ${list.length} record${list.length === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  function execute() {
    if (plants.length === 0) return toast.error("Select at least one Sales Organization");
    if (selection === "customer" && !customer.trim()) return toast.error("Enter a Customer");
    if (selection === "contract" && !contract.trim()) return toast.error("Enter a Contract Number");
    if (selection === "sales" && !salesDoc.trim()) return toast.error("Enter a Sales Document");
    mutation.mutate();
  }

  function reset() {
    setPlants([]);
    setSelection("customer");
    setCustomer("");
    setContract("");
    setSalesDoc("");
    setRows([]);
    setLastFetchedAt(null);
  }

  function onSelectionChange(s: Selection) {
    setSelection(s);
    if (s !== "customer") setCustomer("");
    if (s !== "contract") setContract("");
    if (s !== "sales") setSalesDoc("");
  }

  const canExecute = useMemo(() => {
    if (plants.length === 0 || mutation.isPending) return false;
    if (selection === "customer") return !!customer.trim();
    if (selection === "contract") return !!contract.trim();
    return !!salesDoc.trim();
  }, [plants, selection, customer, contract, salesDoc, mutation.isPending]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">BMW Status Report</h1>
          <p className="text-sm text-muted-foreground">
            Fetch BMW status data live from SAP via BMW_Status_Report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">ZBMW_STATUS_RPT</Badge>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Sales Organization <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder={selection === "customer" ? "required" : "—"}
              disabled={selection !== "customer"}
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contract Number</Label>
            <Input
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder={selection === "contract" ? "required" : "—"}
              disabled={selection !== "contract"}
              className="h-9 font-mono"
            />
          </div>
          {selection === "sales" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sales Document</Label>
              <Input
                value={salesDoc}
                onChange={(e) => setSalesDoc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && execute()}
                placeholder="required"
                className="h-9 font-mono"
              />
            </div>
          )}
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
              Selection <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={selection}
              onValueChange={(v) => onSelectionChange(v as Selection)}
              className="flex items-center gap-5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="customer" id="sel-customer" />
                Customer-wise Selection
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="contract" id="sel-contract" />
                Contract-wise Selection
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="sales" id="sel-sales" />
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
              Output
            </div>
            <div className="text-xs text-muted-foreground">
              {rows.length} record{rows.length === 1 ? "" : "s"}
              {lastFetchedAt ? ` · fetched ${new Date(lastFetchedAt).toLocaleTimeString()}` : ""}
            </div>
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b sticky top-0 z-10">
              <tr>
                <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.label}
                    className={`px-3 py-2 font-semibold whitespace-nowrap ${
                      c.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mutation.isPending ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Fetching from SAP…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                    No data. Select Sales Organization, choose a selection mode, then click Execute.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    {COLUMNS.map((c) => {
                      const raw = pick(r, c.keys);
                      const display = c.date ? fmtDate(raw) : c.num ? fmtNum(raw) : raw == null || raw === "" ? "—" : String(raw);
                      return (
                        <td
                          key={c.label}
                          className={`px-3 py-2 whitespace-nowrap ${
                            c.align === "right" ? "text-right tabular-nums" : ""
                          } ${c.num || c.date ? "font-mono" : ""}`}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
