import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";
import { getMySapUserId } from "@/lib/sd/price-approval.functions";
import { fetchMigo, saveMigo } from "@/lib/mm/migo-release.functions";

export const Route = createFileRoute("/_authenticated/mm/migo-release")({
  component: MigoReleasePage,
});

type DataRow = Record<string, any> & { __key?: string };
type RowState = { hodApproval: boolean; hodRejection: boolean; remarks: string };

function rowKey(r: DataRow, i: number) {
  return [r.MATERIAL_DOC_NUMBER, r.MATERIAL_DOC_YEAR, r.SNO, r.MATERIAL, i].map((x) => x ?? "").join("|");
}

function toStr(v: any): string {
  if (v == null) return "";
  return String(v);
}

function MigoReleasePage() {
  const fetchFn = useServerFn(fetchMigo);
  const userIdFn = useServerFn(getMySapUserId);

  const { data: userIdData } = useQuery({
    queryKey: ["mm-migo-release", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const [userId, setUserId] = useState("");
  const [matDocNo, setMatDocNo] = useState("");
  const [matDocYear, setMatDocYear] = useState("");
  const [header, setHeader] = useState<Record<string, any> | null>(null);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [rowStates, setRowStates] = useState<Map<string, RowState>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hasResults = header !== null || rows.length > 0;

  useEffect(() => {
    if (userIdData?.sap_user_id && !userId) setUserId(userIdData.sap_user_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdData?.sap_user_id]);

  const mutation = useMutation({
    mutationFn: async (vars: { user_id: string; mat_doc_number: string; mat_doc_year: string }) => {
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
      const seeded = new Map<string, RowState>();
      res.data.forEach((r, i) => {
        seeded.set(rowKey(r, i), {
          hodApproval: String(r.HOD_APRROVAL ?? r.HOD_APPROVAL ?? "").toUpperCase() === "X",
          hodRejection: String(r.HOD_REJECTION ?? "").toUpperCase() === "X",
          remarks: toStr(r.REMARKS),
        });
      });
      setRowStates(seeded);
      if (res.error) toast.error(res.error);
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  const saveFn = useServerFn(saveMigo);
  const saveMutation = useMutation({
    mutationFn: async (vars: {
      user_id: string;
      header: Record<string, any>;
      data: Record<string, any>[];
    }) => {
      const v: any = await saveFn({ data: vars });
      return v as { ok: boolean; message: string; documentNumber: string | null };
    },
    onSuccess: (res) => {
      if (res.ok) toast.success(res.message || "Saved successfully");
      else toast.error(res.message || "Save failed");
      if (res.ok) {
        mutation.mutate({
          user_id: userId.trim(),
          mat_doc_number: matDocNo.trim(),
          mat_doc_year: matDocYear.trim(),
        });
        setSelected(new Set());
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to save"),
  });

  function onSave() {
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one row");
      return;
    }
    const items = rows
      .map((r, i) => ({ r, i, k: rowKey(r, i) }))
      .filter(({ k }) => selected.has(k))
      .map(({ r, k }) => {
        const st = rowStates.get(k) ?? { hodApproval: false, hodRejection: false, remarks: "" };
        return {
          ...r,
          HOD_APRROVAL: st.hodApproval ? "X" : "",
          HOD_REJECTION: st.hodRejection ? "X" : "",
          REMARKS: st.remarks ?? "",
        };
      });

    saveMutation.mutate({
      user_id: userId.trim(),
      header: { ...(header ?? {}) },
      data: items,
    });
  }

  function execute() {
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    if (!matDocNo.trim()) {
      toast.error("Material Document Number is required");
      return;
    }
    mutation.mutate({
      user_id: userId.trim(),
      mat_doc_number: matDocNo.trim(),
      mat_doc_year: matDocYear.trim(),
    });
  }

  function reset() {
    setUserId(userIdData?.sap_user_id ?? "");
    setMatDocNo("");
    setMatDocYear("");
    setHeader(null);
    setRows([]);
    setRowStates(new Map());
    setSelected(new Set());
  }

  function updateRow(k: string, patch: Partial<RowState>) {
    setRowStates((prev) => {
      const next = new Map(prev);
      const cur = next.get(k) ?? { hodApproval: false, hodRejection: false, remarks: "" };
      next.set(k, { ...cur, ...patch });
      return next;
    });
  }

  // Dynamic columns from row keys, plus HOD Approval / Rejection / Remarks controls.
  const columns = useMemo<CloudscapeColumn<DataRow>[]>(() => {
    const skip = new Set(["HOD_APRROVAL", "HOD_APPROVAL", "HOD_REJECTION", "REMARKS"]);
    const dataKeys: string[] = [];
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!skip.has(k) && !dataKeys.includes(k)) dataKeys.push(k);
      }
    }

    const numericHint = /(QTY|QUANTITY|AMOUNT|VALUE|PRICE|STOCK|NETWR|RLWRT)/i;

    const base: CloudscapeColumn<DataRow>[] = dataKeys.map((key) => ({
      id: key,
      header: key.replace(/_/g, " "),
      minWidth: 120,
      align: numericHint.test(key) ? ("right" as const) : undefined,
      cell: (item) => {
        const v = (item as any)[key];
        if (v == null || v === "") return "—";
        return String(v);
      },
    }));

    base.push({
      id: "HOD_APPROVAL",
      header: "HOD Approval",
      minWidth: 110,
      cell: (item) => {
        const idx = rows.indexOf(item);
        const k = rowKey(item, idx);
        const st = rowStates.get(k);
        return (
          <Checkbox
            checked={st?.hodApproval ?? false}
            onCheckedChange={(v) => updateRow(k, { hodApproval: v === true })}
          />
        );
      },
    });
    base.push({
      id: "HOD_REJECTION",
      header: "HOD Rejection",
      minWidth: 110,
      cell: (item) => {
        const idx = rows.indexOf(item);
        const k = rowKey(item, idx);
        const st = rowStates.get(k);
        return (
          <Checkbox
            checked={st?.hodRejection ?? false}
            onCheckedChange={(v) => updateRow(k, { hodRejection: v === true })}
          />
        );
      },
    });
    base.push({
      id: "REMARKS",
      header: "Remarks",
      minWidth: 200,
      cell: (item) => {
        const idx = rows.indexOf(item);
        const k = rowKey(item, idx);
        const st = rowStates.get(k);
        return (
          <div style={{ width: 200 }}>
            <Input
              value={st?.remarks ?? ""}
              onChange={(e) => updateRow(k, { remarks: e.target.value })}
              placeholder="Enter remarks"
              className="h-8 text-sm"
            />
          </div>
        );
      },
    });

    return base;
  }, [rowStates, rows]);

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
        <div className="grid gap-3 md:grid-cols-[240px_180px_200px_1fr_auto] items-end">
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
          <div className="space-y-1.5">
            <Label className="text-xs">User ID</Label>
            <Input value={userId} readOnly className="h-9 text-sm bg-muted/40" />
          </div>
          <div />
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={!userId.trim() || mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Execute
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

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={selected.size === 0 || saveMutation.isPending}
              onClick={onSave}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              Save
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
