import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";
import { formatSapDateDMY, isSapDateKey } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchMigo, saveMigo, checkMigo, postMigo } from "@/lib/mm/migo-release.functions";

import { PageHeader } from "@/components/exec/page-header";
import { SapResponseDialog, type SapResponseDialogState } from "@/components/mm/sap-response-dialog";

const STCK_TYPE_OPTIONS = [
  { value: "1", label: "1 Unrestricted" },
  { value: "2", label: "2 Quality Inspection" },
  { value: "3", label: "3 Blocked" },
];

const TRANSACTION_TYPE_OPTIONS = [
  { value: "release", label: "Release" },
  { value: "display", label: "Display" },
  { value: "cancel", label: "Cancel" },
];

/** SAP key → business label shown in the UI (values/payloads unchanged). */
const FIELD_LABELS: Record<string, string> = {
  DOC_DATE: "Document Date",
  PSTNG_DATE: "Posting Date",
  DELIV_NOTE: "Delivery Note Number",
  VENDOR_NAME: "Vendor Name",
  HEADER_TEXT: "Header Text",
  GAT_NO: "Gate Entry Number",
  GAT_DATE: "Gate Entry Date",
  GIR_NO: "Goods Inspection Report Number",
  GIR_DATE: "Goods Inspection Report Date",
  VEHICLE_NO: "Vehicle Number",
  INVOICE_NO: "Invoice Number",
  TRANSPORT_NO: "Transport Number",
  ZINSP: "Inspection Date",
  ZNSP: "Inspection Status",
  ZMTSNR: "Material Test Serial Number",
  MAT_DOC: "Material Document Number",
  DOC_YEAR: "Material Document Year",
  MATDOC_ITM: "Material Document Item",
  MATERIAL: "Material Number",
  WARRANTY: "Warranty Information",
  OK: "Selection Indicator",
  PLANT: "Plant",
  DESCRIPTION: "Material Description",
  STGE_LOC: "Storage Location",
  BATCH: "Batch Number",
  MOVE_TYPE: "Movement Type",
  STCK_TYPE: "Stock Type",
  SPEC_STOCK: "Special Stock Indicator",
  VENDOR: "Vendor Number",
  CUSTOMER: "Customer Number",
  SALES_ORD: "Sales Order Number",
  S_ORD_ITEM: "Sales Order Item",
  SCHED_LINE: "Schedule Line",
  ENTRY_QNT: "Entry Quantity",
  ENTRY_UOM: "Unit of Measure",
  PO_PR_QNT: "Purchase Order Quantity",
  ORDERPR_UN: "Purchase Order Unit",
  PO_NUMBER: "Purchase Order Number",
  PO_ITEM: "Purchase Order Item",
  ITEM_TEXT: "Item Text",
  PROFIT_CTR: "Profit Center",
  CURRENCY: "Currency",
  REF_DOC_YR: "Reference Document Year",
  REF_DOC: "Reference Material Document",
  REF_DOC_IT: "Reference Document Item",
  CMMT_ITEM_LONG: "Commitment Item",
  LINE_ID: "Line",
};

function fieldLabel(key: string) {
  return FIELD_LABELS[key.toUpperCase()] ?? key.replace(/_/g, " ");
}

function isStckTypeKey(k: string) {
  const u = k.toUpperCase();
  return u === "STCK_TYPE" || u === "STCKTYPE";
}


export const Route = createFileRoute("/_authenticated/mm/migo-release")({
  component: MigoReleasePage,
});

type DataRow = Record<string, any> & { __key?: string };

function rowKey(r: DataRow, i: number) {
  return [r.MAT_DOC, r.DOC_YEAR, r.MATDOC_ITM, r.MATERIAL, r.LINE_ID, i].map((x) => x ?? "").join("|");
}

function toStr(v: any): string {
  if (v == null) return "";
  return String(v);
}

function isCheckboxKey(k: string) {
  const u = k.toUpperCase();
  return u === "WARRANTY" || u === "OK";
}

function isEditableTextKey(k: string) {
  const u = k.toUpperCase();
  return u === "STGE_LOC" || u === "STGELOC" || u === "LGORT";
}

function isLineIdKey(k: string) {
  const u = k.toUpperCase();
  return u === "LINE_ID" || u === "LINEID";
}

function MigoReleasePage() {
  const fetchFn = useServerFn(fetchMigo);
  const checkFn = useServerFn(checkMigo);

  const [transactionType, setTransactionType] = useState<"release" | "display" | "cancel">("release");
  const [matDocNo, setMatDocNo] = useState("");
  const [matDocYear, setMatDocYear] = useState("");
  const [header, setHeader] = useState<Record<string, any> | null>(null);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [edits, setEdits] = useState<Map<string, Record<string, any>>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customFields, setCustomFields] = useState<Record<string, any> | null>(null);
  const hasResults = header !== null || rows.length > 0;
  const [resultDialog, setResultDialog] = useState<SapResponseDialogState | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: { mat_doc_number: string; mat_doc_year: string; transaction_type: "release" | "display" | "cancel" }) => {
      const v: any = await fetchFn({ data: vars });
      const data = Array.isArray(v?.data) ? (v.data as DataRow[]) : [];
      return {
        header: (v?.header ?? null) as Record<string, any> | null,
        data,
        count: data.length,
        error: v?.error ?? null,
      };
    },
    onSuccess: (res) => {
      setHeader(res.header);
      setRows(res.data);
      const seeded = new Map<string, Record<string, any>>();
      res.data.forEach((r, i) => {
        seeded.set(rowKey(r, i), { ...r });
      });
      setEdits(seeded);
      setCustomFields(null);
      if (res.error)
        setResultDialog({
          open: true,
          title: "MIGO Response",
          refLabel: "Material Doc",
          results: [{ ref: "MIGO", message: res.error, ok: false }],
        });
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  const postFn = useServerFn(postMigo);

  const postMutation = useMutation({
    mutationFn: async (vars: {
      header: Record<string, any>;
      data: Record<string, any>[];
      custom?: Record<string, any> | null;
    }) => {
      const v: any = await postFn({ data: vars });
      return v as { ok: boolean; type: string; message: string; mat_doc: string; doc_year: number; raw: any };
    },
    onSuccess: (res) => {
      const infoLines = [
        res.mat_doc ? `Material Document: ${res.mat_doc}` : null,
        res.doc_year ? `Document Year: ${res.doc_year}` : null,
      ].filter(Boolean) as string[];

      setResultDialog({
        open: true,
        title: res.ok ? "MIGO Post Response" : "MIGO Post Failed",
        refLabel: "Material Doc",
        results: [
          {
            ref: res.mat_doc ? String(res.mat_doc) : "MIGO",
            message: [res.message, ...infoLines].filter(Boolean).join("\n"),
            ok: !!res.ok,
            response: res.raw ?? res,
          },
        ],
      });
      if (res.ok) {
        toast.success(res.message || "Posted successfully");
        setMatDocNo("");
        setMatDocYear("");
        setHeader(null);
        setRows([]);
        setEdits(new Map());
        setSelected(new Set());
        setCustomFields(null);
      } else {
        toast.error(res.message || "Post failed");
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to post"),
  });

  function onPost() {
    if (selected.size === 0) {
      toast.error("Select at least one row");
      return;
    }
    const items = rows
      .map((r, i) => ({ r, i, k: rowKey(r, i) }))
      .filter(({ k }) => selected.has(k))
      .map(({ r, k }) => ({ ...r, ...(edits.get(k) ?? {}) }));

    postMutation.mutate({
      header: { ...(header ?? {}) },
      data: items,
      custom: customFields ?? null,
    });
  }

  function execute() {
    if (!matDocNo.trim()) {
      toast.error("Material Document Number is required");
      return;
    }
    mutation.mutate({
      mat_doc_number: matDocNo.trim(),
      mat_doc_year: matDocYear.trim(),
      transaction_type: transactionType,
    });
  }

  function reset() {
    setTransactionType("release");
    setMatDocNo("");
    setMatDocYear("");
    setHeader(null);
    setRows([]);
    setEdits(new Map());
    setSelected(new Set());
    setCustomFields(null);
  }

  const checkMutation = useMutation({
    mutationFn: async (vars: { mat_doc_number: string; mat_doc_year: string }) => {
      const v: any = await checkFn({ data: vars });
      return v as { fields: Record<string, any> | null; raw: any[]; error: string | null };
    },
    onSuccess: (res) => {
      if (res.error) {
        setResultDialog({
          open: true,
          title: "MIGO Check Response",
          refLabel: "Material Doc",
          results: [{ ref: "MIGO Check", message: res.error, ok: false, response: res.raw }],
        });
        return;
      }
      setCustomFields(res.fields ?? {});
      toast.success("Check completed");
    },
    onError: (e: Error) => toast.error(e.message ?? "Check failed"),
  });

  function check() {
    if (!matDocNo.trim()) {
      toast.error("Material Document Number is required");
      return;
    }
    checkMutation.mutate({
      mat_doc_number: matDocNo.trim(),
      mat_doc_year: matDocYear.trim(),
    });
  }



  function updateCell(k: string, field: string, value: any) {
    setEdits((prev) => {
      const next = new Map(prev);
      const cur = next.get(k) ?? {};
      next.set(k, { ...cur, [field]: value });
      return next;
    });
  }

  const columns = useMemo<CloudscapeColumn<DataRow>[]>(() => {
    const dataKeys: string[] = [];
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!dataKeys.includes(k)) dataKeys.push(k);
      }
    }

    const lineIdKeys = dataKeys.filter(isLineIdKey);
    const materialKey = dataKeys.find((k) => k.toUpperCase() === "MATERIAL");
    const entryQtyKey = dataKeys.find((k) => k.toUpperCase() === "ENTRY_QNT");
    const priorityKeys = [...lineIdKeys, ...(materialKey ? [materialKey] : []), ...(entryQtyKey ? [entryQtyKey] : [])];
    const otherKeys = dataKeys.filter((k) => !priorityKeys.includes(k));
    const orderedKeys = [...priorityKeys, ...otherKeys];

    const numericHint = /(QTY|QUANTITY|AMOUNT|VALUE|PRICE|STOCK|NETWR|RLWRT|QNT)/i;

    return orderedKeys.map((key) => {
      if (isCheckboxKey(key)) {
        return {
          id: key,
          header: fieldLabel(key),
          minWidth: 100,
          cell: (item: DataRow) => {
            const idx = rows.indexOf(item);
            const k = rowKey(item, idx);
            const cur = edits.get(k) ?? item;
            const checked = String(cur?.[key] ?? "").toUpperCase() === "X";
            return (
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => updateCell(k, key, v === true ? "X" : "")}
              />
            );
          },
        } as CloudscapeColumn<DataRow>;
      }
      if (isEditableTextKey(key)) {
        return {
          id: key,
          header: fieldLabel(key),
          minWidth: 140,
          cell: (item: DataRow) => {
            const idx = rows.indexOf(item);
            const k = rowKey(item, idx);
            const cur = edits.get(k) ?? item;
            return (
              <Input
                value={toStr(cur?.[key])}
                onChange={(e) => updateCell(k, key, e.target.value)}
                className="h-8 text-xs"
              />
            );
          },
        } as CloudscapeColumn<DataRow>;
      }
      if (isStckTypeKey(key)) {
        return {
          id: key,
          header: fieldLabel(key),
          minWidth: 200,
          cell: (item: DataRow) => {
            const idx = rows.indexOf(item);
            const k = rowKey(item, idx);
            const cur = edits.get(k) ?? item;
            const val = toStr(cur?.[key]);
            return (
              <Select value={val} onValueChange={(v) => updateCell(k, key, v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {STCK_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          },
        } as CloudscapeColumn<DataRow>;
      }
      return {
        id: key,
        header: fieldLabel(key),
        minWidth: 120,
        align: numericHint.test(key) ? ("right" as const) : undefined,
        cell: (item: DataRow) => {
          const v = (item as any)[key];
          if (v == null || v === "") return "—";
          if (isSapDateKey(key)) return formatSapDateDMY(v, "—");
          return String(v);
        },
      } as CloudscapeColumn<DataRow>;
    });
  }, [rows, edits]);

  const headerFields = useMemo(() => Object.keys(header ?? {}), [header]);

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="MM Approvals" title="MIGO Release" subtitle="Review, check and post goods movement documents." />

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
          <div className="grid gap-3 md:grid-cols-[200px_240px_180px_auto] items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Transaction Type</Label>
              <Select value={transactionType} onValueChange={(v) => setTransactionType(v as "release" | "display" | "cancel")}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Material Document Number</Label>
              <Input
                value={matDocNo}
                onChange={(e) => setMatDocNo(e.target.value)}
                placeholder="Material document number"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Material Document Year</Label>
              <Input
                value={matDocYear}
                onChange={(e) => setMatDocYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="YYYY"
                inputMode="numeric"
                maxLength={4}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={execute} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Get Details
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={check}
                disabled={!hasResults || checkMutation.isPending}
              >
                {checkMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : null}
                Check
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>

      </Card>

      {hasResults && (
        <>
          {headerFields.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
                <Filter className="h-3.5 w-3.5" /> HEADER
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {headerFields.map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs">{fieldLabel(k)}</Label>
                    <Input
                      value={isSapDateKey(k) ? formatSapDateDMY(header?.[k]) : toStr(header?.[k])}
                      readOnly
                      className="h-9 text-sm bg-muted/40"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {customFields && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
                <Filter className="h-3.5 w-3.5" /> CUSTOM FIELDS
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {["GAT_NO","GAT_DATE","GIR_NO","GIR_DATE","VEHICLE_NO","INVOICE_NO","TRANSPORT_NO","ZINSP","ZNSP","ZMTSNR"].map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs">{fieldLabel(k)}</Label>
                    <Input
                      value={
                        // ZINSP is Inspection Date but has no "DATE" in its key.
                        isSapDateKey(k) || k === "ZINSP"
                          ? formatSapDateDMY(customFields?.[k])
                          : toStr(customFields?.[k])
                      }
                      readOnly
                      className="h-9 text-sm bg-muted/40"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}


          <div className="flex justify-end">
            <Button
              size="sm"
              variant="success"
              disabled={selected.size === 0 || postMutation.isPending}
              onClick={onPost}
            >
              {postMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              Post
            </Button>
          </div>

          <CloudscapeApprovalTable
            title="MIGO Items"
            countLabel={`(${rows.length})`}
            rows={rows}
            rowKey={rowKey}
            loading={mutation.isPending}
            emptyMessage="No line items."
            showSelect
            selectedKeys={selected}
            onSelectionChange={setSelected}
            columns={columns}
          />
        </>
      )}

      <SapResponseDialog
        dialog={resultDialog}
        onOpenChange={(open) => setResultDialog((prev) => (prev ? { ...prev, open } : prev))}
        defaultTitle="MIGO Response"
      />
    </div>
  );
}
