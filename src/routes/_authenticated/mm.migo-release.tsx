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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchMigo, saveMigo, checkMigo, postMigo } from "@/lib/mm/migo-release.functions";
import Swal from "sweetalert2";

const STCK_TYPE_OPTIONS = [
  { value: "1", label: "1 Unrestricted" },
  { value: "2", label: "2 Quality Inspection" },
  { value: "3", label: "3 Blocked" },
];

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

  const [matDocNo, setMatDocNo] = useState("");
  const [matDocYear, setMatDocYear] = useState("");
  const [header, setHeader] = useState<Record<string, any> | null>(null);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [edits, setEdits] = useState<Map<string, Record<string, any>>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customFields, setCustomFields] = useState<Record<string, any> | null>(null);
  const hasResults = header !== null || rows.length > 0;

  const mutation = useMutation({
    mutationFn: async (vars: { mat_doc_number: string; mat_doc_year: string }) => {
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
      if (res.error) toast.error(res.error);
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  const postFn = useServerFn(postMigo);

  const postMutation = useMutation({
    mutationFn: async (vars: {
      header: Record<string, any>;
      data: Record<string, any>[];
    }) => {
      const v: any = await postFn({ data: vars });
      return v as { ok: boolean; type: string; message: string; mat_doc: string; doc_year: number; raw: any };
    },
    onSuccess: (res) => {
      Swal.fire({
        icon: res.ok ? "success" : "error",
        title: res.ok ? "Success" : "Failed",
        text: res.message,
        confirmButtonColor: res.ok ? "#16a34a" : "#dc2626",
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
    });
  }

  function reset() {
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
        toast.error(res.error);
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
          header: key.replace(/_/g, " "),
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
          header: key.replace(/_/g, " "),
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
          header: key.replace(/_/g, " "),
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
        header: key.replace(/_/g, " "),
        minWidth: 120,
        align: numericHint.test(key) ? ("right" as const) : undefined,
        cell: (item: DataRow) => {
          const v = (item as any)[key];
          if (v == null || v === "") return "—";
          return String(v);
        },
      } as CloudscapeColumn<DataRow>;
    });
  }, [rows, edits]);

  const headerFields = useMemo(() => Object.keys(header ?? {}), [header]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MIGO Release</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
          <div className="grid gap-3 md:grid-cols-[240px_180px_auto] items-end">
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
                onClick={check}
                disabled={!hasResults || checkMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white"
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
                    <Label className="text-xs">{k.replace(/_/g, " ")}</Label>
                    <Input
                      value={toStr(header?.[k])}
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
                    <Label className="text-xs">{k.replace(/_/g, " ")}</Label>
                    <Input
                      value={toStr(customFields?.[k])}
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
              disabled={selected.size === 0 || postMutation.isPending}
              onClick={onPost}
              className="bg-green-600 hover:bg-green-700 text-white"
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

    </div>
  );
}
