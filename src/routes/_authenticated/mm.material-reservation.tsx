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
import { fetchMaterialReservation } from "@/lib/mm/material-reservation.functions";

export const Route = createFileRoute("/_authenticated/mm/material-reservation")({
  component: MaterialReservationPage,
});

type DataRow = Record<string, any> & { __key?: string };
type RowState = { hodApproval: boolean; hodRejection: boolean; remarks: string };

function rowKey(r: DataRow, i: number) {
  return [r.DOCUMENT_NUMBER, r.SNO, r.MATERIAL, i].map((x) => x ?? "").join("|");
}

function toStr(v: any): string {
  if (v == null) return "";
  return String(v);
}

const HEADER_FIELDS: Array<{ key: string; label: string }> = [
  { key: "DOCUMENT_NUMBER", label: "Document Number" },
  { key: "DOCUMENT_DATE", label: "Document Date" },
  { key: "MOVEMENT_TYPE", label: "Movement Type" },
  { key: "PLANT", label: "Plant" },
  { key: "MATERIAL_TYPE", label: "Material Type" },
];

const DATA_COLUMNS: Array<{ key: string; header: string; align?: "right"; minWidth?: number }> = [
  { key: "SNO", header: "S.No", minWidth: 70 },
  { key: "GOODS_RECEPIENT", header: "Goods Recipient", minWidth: 140 },
  { key: "MATERIAL", header: "Material", minWidth: 120 },
  { key: "MATERIAL_DESCRIPTION", header: "Material Description", minWidth: 220 },
  { key: "UOM", header: "UoM", minWidth: 80 },
  { key: "ORDER_NUMBER", header: "Order Number", minWidth: 120 },
  { key: "COST_CENTER", header: "Cost Center", minWidth: 130 },
  { key: "REQUESTED_QUANTITY", header: "Requested Qty", align: "right", minWidth: 130 },
  { key: "APPROVED_QUANTITY", header: "Approved Qty", align: "right", minWidth: 130 },
  { key: "ISSUED_QUANTITY", header: "Issued Qty", align: "right", minWidth: 120 },
  { key: "STORAGE_LOCATION", header: "Storage Location", minWidth: 140 },
  { key: "TOTAL_STOCK", header: "Total Stock", align: "right", minWidth: 120 },
  { key: "COST_CENT_DESC", header: "Cost Center Desc", minWidth: 180 },
];

function MaterialReservationPage() {
  const fetchFn = useServerFn(fetchMaterialReservation);
  const userIdFn = useServerFn(getMySapUserId);

  const { data: userIdData } = useQuery({
    queryKey: ["mm-material-reservation", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const [userId, setUserId] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [hodApprove, setHodApprove] = useState(false);
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
    mutationFn: async (vars: { user_id: string; document_number: string; hod_approve: boolean }) => {
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

  function execute() {
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    mutation.mutate({
      user_id: userId.trim(),
      document_number: docNumber.trim(),
      hod_approve: hodApprove,
    });
  }

  function reset() {
    setUserId(userIdData?.sap_user_id ?? "");
    setDocNumber("");
    setHodApprove(false);
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

  const columns = useMemo<CloudscapeColumn<DataRow>[]>(() => {
    const base: CloudscapeColumn<DataRow>[] = DATA_COLUMNS.map((c) => ({
      id: c.key,
      header: c.header,
      minWidth: c.minWidth,
      align: c.align,
      cell: (item) => {
        const v = (item as any)[c.key];
        if (v == null || v === "") return "—";
        return String(v);
      },
    }));

    base.push({
      id: "HOD_APPROVAL",
      header: "HOD Approval",
      minWidth: 110,
      cell: (item) => {
        const k = (item as any).__key as string;
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
        const k = (item as any).__key as string;
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
        const k = (item as any).__key as string;
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
  }, [rowStates]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Material Reservation</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-[240px_200px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Document Number</Label>
            <Input
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="Document number"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">HOD Approve</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={hodApprove}
                  onCheckedChange={(v) => setHodApprove(v === true)}
                />
                HOD Approve
              </label>
            </div>
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
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
              <Filter className="h-3.5 w-3.5" /> HEADER
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              {HEADER_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    value={toStr(header?.[f.key])}
                    readOnly
                    className="h-9 text-sm bg-muted/40"
                  />
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={selected.size === 0}
              onClick={() => toast.info(`Save clicked (${selected.size} selected)`)}
            >
              Save
            </Button>
          </div>

          <CloudscapeApprovalTable
            title="Material Reservation Items"
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
