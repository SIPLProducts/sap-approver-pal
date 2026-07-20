import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchPrReleaseMultiple } from "@/lib/mm/pr-release.functions";

export const Route = createFileRoute("/_authenticated/mm/pr-release")({
  component: PrReleasePage,
});


const COLUMN_LABELS: Record<string, string> = {
  PREQ_NO: "PR Number",
  PREQ_ITEM: "PR Item",
  DOC_TYPE: "Document Type",
  PUR_GROUP: "Purchasing Group",
  CREATED_BY: "Created By",
  PREQ_NAME: "Requisitioner Name",
  PREQ_DATE: "PR Date",
  SHORT_TEXT: "Short Description",
  MATERIAL: "Material Number",
  PUR_MAT: "Purchasing Material / Mfr Part No.",
  PLANT: "Plant",
  STORE_LOC: "Storage Location",
  TRACKINGNO: "Tracking Number",
  MAT_GRP: "Material Group",
  SUPPL_PLNT: "Supplying Plant",
  QUANTITY: "Quantity",
  UNIT: "Unit of Measure",
  DEL_DATCAT: "Delivery Date Category",
  DELIV_DATE: "Delivery Date",
  REL_DATE: "Release Date",
  GR_PR_TIME: "GR Processing Time",
  C_AMT_BAPI: "Unit Price",
  PRICE_UNIT: "Price Unit",
  ITEM_CAT: "Item Category",
  ACCTASSCAT: "Account Assignment Category",
  DISTRIB: "Distribution Indicator",
  PART_INV: "Partial Invoice Indicator",
  GR_IND: "Goods Receipt Indicator",
  GR_NON_VAL: "Non-Valuated GR Indicator",
  IR_IND: "Invoice Receipt Indicator",
  DES_VENDOR: "Desired Vendor",
  FIXED_VEND: "Fixed Vendor",
  PURCH_ORG: "Purchasing Organization",
  AGREEMENT: "Outline Agreement",
  AGMT_ITEM: "Agreement Item",
  INFO_REC: "Purchasing Info Record",
  QUOTA_ARR: "Quota Arrangement",
  QUOTARRITM: "Quota Arrangement Item",
  MRP_CONTR: "MRP Controller",
  BOMEXPL_NO: "BOM Explosion Number",
  LAST_RESUB: "Last Resubmission Date",
  RESUBMIS: "Resubmission Interval",
  NO_RESUB: "No. of Resubmissions",
  VAL_TYPE: "Valuation Type",
  SPEC_STOCK: "Special Stock Indicator",
  PO_UNIT: "PO Unit",
  REV_LEV: "Revision Level",
  PCKG_NO: "Package Number",
  KANBAN_IND: "Kanban Indicator",
  PO_PRICE: "Price Determination Indicator",
  INT_OBJ_NO: "Internal Object Number",
  PROMOTION: "Promotion Number",
  BATCH: "Batch Number",
  VEND_MAT: "Vendor Material Number",
  ORDERED: "Ordered Quantity",
  CURRENCY: "Currency",
  MANUF_PROF: "Manufacturer Profile",
  MANU_MAT: "Manufacturer Material Number",
  MFR_NO: "Manufacturer Number",
  MFR_NO_EXT: "External Manufacturer Number",
  DEL_DATCAT_EXT: "Extended Delivery Date Category",
  CURRENCY_ISO: "ISO Currency Code",
  ITEM_CAT_EXT: "Extended Item Category",
  PREQ_UNIT_ISO: "ISO Unit of Measure",
  PO_UNIT_ISO: "ISO PO Unit",
  GENERAL_RELEASE: "Overall Release Indicator",
  MATERIAL_EXTERNAL: "External Material Number",
  MATERIAL_GUID: "Material GUID",
  MATERIAL_VERSION: "Material Version",
  PUR_MAT_EXTERNAL: "External Purchasing Material",
  PUR_MAT_GUID: "Purchasing Material GUID",
  PUR_MAT_VERSION: "Purchasing Material Version",
  REQ_BLOCKED: "Requisition Blocked",
  REASON_BLOCKING: "Reason for Blocking",
  PROCURING_PLANT: "Procuring Plant",
  CMMT_ITEM: "Commitment Item",
  FUNDS_CTR: "Funds Center",
  FUND: "Fund",
  RES_DOC: "Reservation Number",
  RES_ITEM: "Reservation Item",
  FUNC_AREA: "Functional Area",
  GRANT_NBR: "Grant Number",
  FUND_LONG: "Long Fund Number",
  BUDGET_PERIOD: "Budget Period",
  MATERIAL_LONG: "Long Material Number",
  PUR_MAT_LONG: "Long Purchasing Material Number",
};

function rowKey(r: Record<string, any>, idx: number) {
  const preq = r.PREQ_NO ?? "";
  const item = r.PREQ_ITEM ?? "";
  return `${preq}-${item}-${idx}`;
}

function PrReleasePage() {
  const [level, setLevel] = useState<"single" | "multiple">("single");
  const [releaseGroup, setReleaseGroup] = useState("");
  const [releaseCode, setReleaseCode] = useState("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchFn = useServerFn(fetchPrReleaseMultiple);
  const mutation = useMutation({
    mutationFn: (input: { relgroup: string; relcode: string }) =>
      fetchFn({ data: input }),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        setRows([]);
        setSelected(new Set());
        return;
      }
      setRows(res.data);
      setSelected(new Set());
      toast.success(`Loaded ${res.data.length} row(s).`);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to fetch PR Release data.");
    },
  });

  function execute() {
    if (level === "single") {
      toast.info("Single Level — not implemented yet.");
      return;
    }
    if (!releaseGroup.trim() || !releaseCode.trim()) {
      toast.error("Release Group and Release Code are required.");
      return;
    }
    mutation.mutate({ relgroup: releaseGroup.trim(), relcode: releaseCode.trim() });
  }

  function reset() {
    setLevel("single");
    setReleaseGroup("");
    setReleaseCode("");
    setRows([]);
    setSelected(new Set());
  }

  const allKeys = useMemo(() => rows.map((r, i) => rowKey(r, i)), [rows]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = selected.size > 0 && !allSelected;

  const columns = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
    return keys;
  }, [rows]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allKeys) : new Set());
  }
  function toggleRow(k: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(k);
      else next.delete(k);
      return next;
    });
  }

  function onRelease() {
    if (selected.size === 0) return;
    toast.success(`Release: ${selected.size} item(s)`);
  }
  function onReject() {
    if (selected.size === 0) return;
    toast(`Reject: ${selected.size} item(s)`);
  }

  const showResults = level === "multiple" && (mutation.isSuccess || rows.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">PR Release</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <RadioGroup
          value={level}
          onValueChange={(v) => setLevel(v as "single" | "multiple")}
          className="flex items-center gap-6 mb-4"
        >
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="single" id="pr-level-single" />
            Single Level
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="multiple" id="pr-level-multiple" />
            Multiple Level
          </label>
        </RadioGroup>

        <div className="grid gap-3 md:grid-cols-[240px_240px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Release Group</Label>
            <Input
              value={releaseGroup}
              onChange={(e) => setReleaseGroup(e.target.value)}
              placeholder="Release group"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Release Code</Label>
            <Input
              value={releaseCode}
              onChange={(e) => setReleaseCode(e.target.value)}
              placeholder="Release code"
              className="h-9 text-sm"
            />
          </div>
          <div />
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={mutation.isPending}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {showResults && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-muted-foreground">
              RESULTS · {rows.length} row(s) · {selected.size} selected
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  {columns.map((key) => (
                    <TableHead key={key} className="whitespace-nowrap text-xs">
                      {COLUMN_LABELS[key] ?? key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground py-6">
                      No data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => {
                    const k = rowKey(r, i);
                    const checked = selected.has(k);
                    return (
                      <TableRow key={k} data-state={checked ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleRow(k, v === true)}
                            aria-label={`Select row ${i + 1}`}
                          />
                        </TableCell>
                        {columns.map((key) => (
                          <TableCell key={key} className="whitespace-nowrap text-xs">
                            {r[key] === null || r[key] === undefined || r[key] === ""
                              ? "-"
                              : String(r[key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={onReject}
              disabled={selected.size === 0}
            >
              Reject
            </Button>
            <Button size="sm" onClick={onRelease} disabled={selected.size === 0}>
              Release
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
