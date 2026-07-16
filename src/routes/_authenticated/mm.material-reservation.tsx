import { useEffect, useState } from "react";
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
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import { getMySapUserId } from "@/lib/sd/price-approval.functions";
import { fetchMaterialReservation } from "@/lib/mm/material-reservation.functions";

export const Route = createFileRoute("/_authenticated/mm/material-reservation")({
  component: MaterialReservationPage,
});

function rowKey(r: Record<string, any>, i: number) {
  return [r.DOC_NUMBER, r.RESERVATION_NO, r.MATERIAL, i].map((x) => x ?? "").join("|");
}

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
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hasResults = rows.length > 0;

  useEffect(() => {
    if (userIdData?.sap_user_id && !userId) setUserId(userIdData.sap_user_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdData?.sap_user_id]);

  const mutation = useMutation({
    mutationFn: async (vars: { user_id: string; doc_number: string; hod_approve: boolean }) => {
      const v: any = await fetchFn({ data: vars });
      const rows = Array.isArray(v?.rows) ? (v.rows as Record<string, any>[]) : [];
      return { rows, count: rows.length, error: v?.error ?? null };
    },
    onSuccess: (res) => {
      setRows(res.rows);
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
    mutation.mutate({ user_id: userId.trim(), doc_number: docNumber.trim(), hod_approve: hodApprove });
  }

  function reset() {
    setUserId(userIdData?.sap_user_id ?? "");
    setDocNumber("");
    setHodApprove(false);
    setRows([]);
    setSelected(new Set());
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Material Reservation</h1>
      </div>

      {!hasResults && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
            <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
          </div>
          <div className="grid gap-3 md:grid-cols-[240px_200px_180px_1fr_auto] items-end">
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
            <div className="space-y-1.5">
              <Label className="text-xs">
                User ID <span className="text-destructive">*</span>
              </Label>
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
      )}

      {hasResults && (
        <CloudscapeApprovalTable
          title="Material Reservation"
          countLabel={`(${rows.length})`}
          rows={rows}
          rowKey={rowKey}
          loading={mutation.isPending}
          showSelect
          selectedKeys={selected}
          onSelectionChange={setSelected}
          emptyMessage="No records."
          headerExtras={
            <Button variant="ghost" size="sm" onClick={reset}>
              Back to Search
            </Button>
          }
          columns={buildDynamicColumns(rows)}
        />
      )}
    </div>
  );
}
