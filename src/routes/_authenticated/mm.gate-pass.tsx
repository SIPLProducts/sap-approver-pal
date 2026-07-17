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
import { fetchGatePass } from "@/lib/mm/gate-pass.functions";

export const Route = createFileRoute("/_authenticated/mm/gate-pass")({
  component: GatePassPage,
});

type DataRow = Record<string, any> & { __key?: string };

function rowKey(r: DataRow, i: number) {
  return [r.GATE_PASS_NUMBER, r.SNO, r.MATERIAL, i].map((x) => x ?? "").join("|");
}

function toStr(v: any): string {
  if (v == null) return "";
  return String(v);
}

function humanize(k: string): string {
  return k
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function GatePassPage() {
  const fetchFn = useServerFn(fetchGatePass);
  const userIdFn = useServerFn(getMySapUserId);

  const { data: userIdData } = useQuery({
    queryKey: ["mm-gate-pass", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const [userId, setUserId] = useState("");
  const [gatePassNumber, setGatePassNumber] = useState("");
  const [hodApproval, setHodApproval] = useState(false);
  const [storeApproval, setStoreApproval] = useState(false);
  const [scmHead, setScmHead] = useState("");
  const [plantHead, setPlantHead] = useState("");
  const [returnReceipt, setReturnReceipt] = useState("");

  const [header, setHeader] = useState<Record<string, any> | null>(null);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hasResults = header !== null || rows.length > 0;

  useEffect(() => {
    if (userIdData?.sap_user_id && !userId) setUserId(userIdData.sap_user_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdData?.sap_user_id]);

  const mutation = useMutation({
    mutationFn: async (vars: {
      user_id: string;
      gate_pass_number: string;
      hod_approval: boolean;
      store_approval: boolean;
      scm_head: string;
      plant_head: string;
      return_receipt: string;
    }) => {
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
      setSelected(new Set());
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
      gate_pass_number: gatePassNumber.trim(),
      hod_approval: hodApproval,
      store_approval: storeApproval,
      scm_head: scmHead.trim(),
      plant_head: plantHead.trim(),
      return_receipt: returnReceipt.trim(),
    });
  }

  function reset() {
    setUserId(userIdData?.sap_user_id ?? "");
    setGatePassNumber("");
    setHodApproval(false);
    setStoreApproval(false);
    setScmHead("");
    setPlantHead("");
    setReturnReceipt("");
    setHeader(null);
    setRows([]);
    setSelected(new Set());
  }

  const dataKeys = useMemo<string[]>(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter((k) => k !== "__key");
  }, [rows]);

  const headerKeys = useMemo<string[]>(() => {
    if (!header) return [];
    return Object.keys(header);
  }, [header]);

  const columns = useMemo<CloudscapeColumn<DataRow>[]>(() => {
    return dataKeys.map((k) => ({
      id: k,
      header: humanize(k),
      minWidth: 120,
      cell: (item) => {
        const v = (item as any)[k];
        if (v == null || v === "") return "—";
        return String(v);
      },
    }));
  }, [dataKeys]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gate Pass</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Gate Pass Number</Label>
            <Input
              value={gatePassNumber}
              onChange={(e) => setGatePassNumber(e.target.value)}
              placeholder="Gate pass number"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SCM Head</Label>
            <Input
              value={scmHead}
              onChange={(e) => setScmHead(e.target.value)}
              placeholder="SCM Head"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plant Head</Label>
            <Input
              value={plantHead}
              onChange={(e) => setPlantHead(e.target.value)}
              placeholder="Plant Head"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Return Receipt</Label>
            <Input
              value={returnReceipt}
              onChange={(e) => setReturnReceipt(e.target.value)}
              placeholder="Return receipt"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">HOD Approval</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={hodApproval}
                  onCheckedChange={(v) => setHodApproval(v === true)}
                />
                HOD Approval
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Store Approval</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={storeApproval}
                  onCheckedChange={(v) => setStoreApproval(v === true)}
                />
                Store Approval
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
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
      </Card>

      {hasResults && (
        <>
          {headerKeys.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
                <Filter className="h-3.5 w-3.5" /> HEADER
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                {headerKeys.map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs">{humanize(k)}</Label>
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
              disabled={selected.size === 0}
              onClick={() => toast.info(`Save clicked (${selected.size} selected)`)}
            >
              Save
            </Button>
          </div>

          <CloudscapeApprovalTable
            title="Gate Pass Items"
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
