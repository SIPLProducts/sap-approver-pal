import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import { getMySapUserId } from "@/lib/sd/price-approval.functions";
import { fetchGateProcess, createZnfa, type GateRow, type ZnfaOutput, type ZnfaAction } from "@/lib/mm/gate-process.functions";

export const Route = createFileRoute("/_authenticated/mm/gate-process")({
  component: GateProcessPage,
});

function rowKey(r: GateRow, i: number) {
  return [r.pr_number, r.rfq_number, r.ter_sub_id, i].map((x) => x ?? "").join("|");
}

function toStr(v: any): string {
  if (v == null) return "";
  return String(v);
}

function GateProcessPage() {
  const fetchFn = useServerFn(fetchGateProcess);
  const userIdFn = useServerFn(getMySapUserId);
  const createFn = useServerFn(createZnfa);

  const { data: userIdData } = useQuery({
    queryKey: ["mm-gate-process", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<GateRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [output, setOutput] = useState<ZnfaOutput | null>(null);
  const [itemRemarks, setItemRemarks] = useState<Record<number, string>>({});
  const [lastAction, setLastAction] = useState<ZnfaAction | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const outputTitle = useMemo(() => {
    switch (lastAction) {
      case "RATE":
        return "Rating Result";
      case "CHANGE":
        return "Change Result";
      case "DISPLAY":
        return "Display Result";
      default:
        return "Output";
    }
  }, [lastAction]);

  useEffect(() => {
    if (userIdData?.sap_user_id && !userId) setUserId(userIdData.sap_user_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdData?.sap_user_id]);

  const mutation = useMutation({
    mutationFn: async (vars: { user_id: string }) => {
      const v: any = await fetchFn({ data: { user_id: vars.user_id } });
      const rows = Array.isArray(v?.rows) ? (v.rows as GateRow[]) : [];
      return {
        rows,
        count: rows.length,
        error: v?.error ?? null,
        fetched_at: v?.fetched_at ?? new Date().toISOString(),
      };
    },
    onSuccess: (res) => {
      setRows(res.rows);
      setSelected(new Set());
      setOutput(null);
      setItemRemarks({});
      setLastAction(null);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  const createMutation = useMutation({
    mutationFn: async (vars: { action: ZnfaAction; user_id: string; data: GateRow[] }) => {
      const payloadData = vars.data.map((r) => ({
        CHECK: "X",
        BANFN: toStr(r.pr_number),
        ANFNR: toStr(r.rfq_number),
        TITLE: toStr(r.rfq_title),
        NAME1: toStr(r.vendor_name),
        TER_SUB_ID: toStr(r.ter_sub_id),
      }));
      const v: any = await createFn({ data: { action: vars.action, user_id: vars.user_id, data: payloadData } });
      return {
        output: (v?.output ?? null) as ZnfaOutput | null,
        error: v?.error ?? null,
      };
    },
    onSuccess: (res, vars) => {
      if (res.error) {
        toast.error(res.error);
      } else {
        setLastAction(vars.action);
        setOutput(res.output);
        const items = Array.isArray(res.output?.ITEMS) ? res.output!.ITEMS : [];
        const init: Record<number, string> = {};
        items.forEach((it, i) => (init[i] = toStr(it.REMARKS)));
        setItemRemarks(init);
        toast.success("Request submitted successfully");
        requestAnimationFrame(() => {
          outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to submit"),
  });

  function execute() {
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    mutation.mutate({ user_id: userId.trim() });
  }

  function reset() {
    setUserId(userIdData?.sap_user_id ?? "");
    setRows([]);
    setSelected(new Set());
    setOutput(null);
    setItemRemarks({});
    setLastAction(null);
  }

  function handleAction(action: ZnfaAction) {
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    const selectedRows = rows.filter((r, i) => selected.has(rowKey(r, i)));
    if (selectedRows.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    createMutation.mutate({ action, user_id: userId.trim(), data: selectedRows });
  }

  const hasResults = rows.length > 0 || output !== null;

  const actionButtons: Array<{ label: string; action: ZnfaAction; className: string }> = [
    { label: "Rating", action: "RATE", className: "bg-primary hover:bg-primary/90 text-primary-foreground" },
    { label: "Change", action: "CHANGE", className: "bg-blue-600 hover:bg-blue-700 text-white" },
    { label: "Display", action: "DISPLAY", className: "bg-amber-500 hover:bg-amber-600 text-white" },
    { label: "Attachments", action: "ATTACHMENTS", className: "bg-green-600 hover:bg-green-700 text-white" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ZNFA Rating</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-[240px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              User ID <span className="text-destructive">*</span>
            </Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              readOnly
              className="h-9 text-sm bg-muted/40"
            />
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
          <CloudscapeApprovalTable
            title="ZNFA Rating"
            countLabel={`(${rows.length})`}
            rows={rows}
            rowKey={rowKey}
            loading={mutation.isPending}
            showSelect
            selectedKeys={selected}
            onSelectionChange={setSelected}
            emptyMessage={rows.length === 0 ? "Click Execute to load ZNFA Rating records from SAP." : "No records."}
            columns={buildDynamicColumns(rows)}
            headerExtras={
              <div className="flex items-center gap-2">
                {actionButtons.map(({ label, action, className }) => (
                  <Button
                    key={action}
                    size="sm"
                    disabled={selected.size === 0 || createMutation.isPending}
                    onClick={() => handleAction(action)}
                    className={className}
                  >
                    {createMutation.isPending && createMutation.variables?.action === action ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : null}
                    {label}
                  </Button>
                ))}
              </div>
            }
          />
          <div className="text-xs text-muted-foreground -mt-2">
            <span className="font-medium text-foreground">Rating</span> triggers the <code className="text-[11px]">ZNFA_Create_API</code>.
          </div>

          {output && (
            <Card ref={outputRef} className="p-4 space-y-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
                <Filter className="h-3.5 w-3.5" /> OUTPUT
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">PR Number</Label>
                  <Input value={toStr(output.PR_NUMBER)} readOnly className="h-9 text-sm bg-muted/40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">PR Date</Label>
                  <Input value={toStr(output.PR_DATE)} readOnly className="h-9 text-sm bg-muted/40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">TER SUB ID</Label>
                  <Input value={toStr(output.TER_SUB_ID)} readOnly className="h-9 text-sm bg-muted/40" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Sr. No</TableHead>
                        <TableHead className="text-xs">Material</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs">Tender Spec</TableHead>
                        <TableHead className="text-xs">UoM</TableHead>
                        <TableHead className="text-xs">Vendor Name</TableHead>
                        <TableHead className="text-xs">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(output.ITEMS) && output.ITEMS.length > 0 ? (
                        output.ITEMS.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{toStr(item.SR_NO)}</TableCell>
                            <TableCell className="text-xs">{toStr(item.MATERIAL)}</TableCell>
                            <TableCell className="text-xs">{toStr(item.DESCRIPTION)}</TableCell>
                            <TableCell className="text-xs">{toStr(item.TENDER_SPEC)}</TableCell>
                            <TableCell className="text-xs">{toStr(item.UOM)}</TableCell>
                            <TableCell className="text-xs">{toStr(item.VENDOR_NAME)}</TableCell>
                            <TableCell className="text-xs">
                              <Input
                                value={itemRemarks[idx] ?? toStr(item.REMARKS)}
                                onChange={(e) =>
                                  setItemRemarks((prev) => ({ ...prev, [idx]: e.target.value }))
                                }
                                className="h-8 text-xs"
                                placeholder="Enter remarks"
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-4">
                            No items.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ratings</div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(output.RATINGS) && output.RATINGS.length > 0 ? (
                        output.RATINGS.map((rating, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{toStr(rating.VENDOR)}</TableCell>
                            <TableCell className="text-xs">{toStr(rating.RATE)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-4">
                            No ratings.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
