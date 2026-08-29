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
  SapResponseDialog,
  type SapResponseDialogState,
} from "@/components/mm/sap-response-dialog";
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
import { formatSapDateDMY } from "@/lib/format";
import { getMySapUserId } from "@/lib/sd/price-approval.functions";
import { fetchGateProcess, createZnfa, saveZnfa, type GateRow, type ZnfaOutput, type ZnfaAction } from "@/lib/mm/gate-process.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PageHeader } from "@/components/exec/page-header";

const RATING_OPTIONS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "NQ"];

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
  const saveFn = useServerFn(saveZnfa);
  

  const { data: userIdData } = useQuery({
    queryKey: ["mm-gate-process", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<GateRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [output, setOutput] = useState<ZnfaOutput | null>(null);
  const [header, setHeader] = useState<{ PR_NUMBER: string; PR_DATE: string; TER_SUB_ID: string }>({
    PR_NUMBER: "",
    PR_DATE: "",
    TER_SUB_ID: "",
  });
  type ItemFields = {
    SR_NO: string;
    MATERIAL: string;
    DESCRIPTION: string;
    TENDER_SPEC: string;
    UOM: string;
    VENDOR_NAME: string;
    REMARKS: string;
  };
  type RatingFields = { VENDOR: string; RATE: string };
  const [items, setItems] = useState<Record<number, ItemFields>>({});
  const [ratings, setRatings] = useState<Record<number, RatingFields>>({});
  const [lastAction, setLastAction] = useState<ZnfaAction | null>(null);
  const [messageDialog, setMessageDialog] = useState<SapResponseDialogState | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const isEditable = lastAction === "RATE" || lastAction === "CHANGE";

  const ratingOptions: string[] = RATING_OPTIONS;

  const outputTitle = useMemo(() => {
    switch (lastAction) {
      case "RATE":
        return "Rating Result";
      case "CHANGE":
        return "Change Result";
      case "DISPLAY":
        return "Display Result";
      case "ATTACHMENTS":
        return "Attachments Result";
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
      setHeader({ PR_NUMBER: "", PR_DATE: "", TER_SUB_ID: "" });
      setItems({});
      setRatings({});
      setLastAction(null);
      if (res.error) {
        setMessageDialog({
          open: true,
          title: "ZNFA Rating",
          refLabel: "Document",
          results: [{ ref: "", message: res.error, ok: false }],
        });
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
        setOutput(null);
        setItems({});
        setRatings({});
        setLastAction(null);
        setMessageDialog({
          open: true,
          title: "ZNFA Rating",
          refLabel: "Document",
          results: [{ ref: "", message: res.error, ok: false }],
        });

      } else {
        setLastAction(vars.action);
        setOutput(res.output);
        setHeader({
          PR_NUMBER: toStr(res.output?.PR_NUMBER),
          PR_DATE: toStr(res.output?.PR_DATE),
          TER_SUB_ID: toStr(res.output?.TER_SUB_ID),
        });
        const itemsArr = Array.isArray(res.output?.ITEMS) ? res.output!.ITEMS! : [];
        const itemsInit: Record<number, ItemFields> = {};
        itemsArr.forEach((it, i) => {
          itemsInit[i] = {
            SR_NO: toStr(it.SR_NO),
            MATERIAL: toStr(it.MATERIAL),
            DESCRIPTION: toStr(it.DESCRIPTION),
            TENDER_SPEC: toStr(it.TENDER_SPEC),
            UOM: toStr(it.UOM),
            VENDOR_NAME: toStr(it.VENDOR_NAME),
            REMARKS: toStr(it.REMARKS),
          };
        });
        setItems(itemsInit);
        const ratingsArr = Array.isArray(res.output?.RATINGS) ? res.output!.RATINGS! : [];
        const ratingsInit: Record<number, RatingFields> = {};
        ratingsArr.forEach((rt, i) => {
          ratingsInit[i] = { VENDOR: toStr(rt.VENDOR), RATE: toStr(rt.RATE) };
        });
        setRatings(ratingsInit);
        toast.success("Request submitted successfully");
        requestAnimationFrame(() => {
          outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to submit"),
  });

  const saveMutation = useMutation({
    mutationFn: async (vars: {
      action: "RATE" | "CHANGE";
      user_id: string;
      pr_number: string;
      pr_date: string;
      ter_sub_id: string;
      items: Array<{ SR_NO: string; MATERIAL: string; DESCRIPTION: string; TENDER_SPEC: string; UOM: string; VENDOR_NAME: string; REMARKS: string }>;
      ratings: Array<{ VENDOR: string; RATE: string }>;
    }) => {
      const v: any = await saveFn({ data: vars });
      return v as { ok: boolean; ter_sub_id: string | null; message: string | null; error: string | null };
    },
    onSuccess: (res) => {
      if (res.ok) {
        if (res.ter_sub_id) setHeader((p) => ({ ...p, TER_SUB_ID: res.ter_sub_id! }));
        setMessageDialog({
          open: true,
          title: "ZNFA Rating",
          refLabel: "Document",
          results: [{ ref: "", message: res.message ?? "Saved successfully", ok: true }],
        });
      } else {
        setMessageDialog({
          open: true,
          title: "ZNFA Rating",
          refLabel: "Document",
          results: [{ ref: "", message: res.error ?? "Save failed", ok: false }],
        });
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to save"),
  });

  function handleSave() {
    if (lastAction !== "RATE" && lastAction !== "CHANGE") return;
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    void doSave();
  }

  async function doSave() {
    if (lastAction !== "RATE" && lastAction !== "CHANGE") return;
    const itemsArr = Array.isArray(output?.ITEMS) ? output!.ITEMS!.map((it, idx) => {
      const f = items[idx];
      return {
        SR_NO: f?.SR_NO ?? toStr(it.SR_NO),
        MATERIAL: f?.MATERIAL ?? toStr(it.MATERIAL),
        DESCRIPTION: f?.DESCRIPTION ?? toStr(it.DESCRIPTION),
        TENDER_SPEC: f?.TENDER_SPEC ?? toStr(it.TENDER_SPEC),
        UOM: f?.UOM ?? toStr(it.UOM),
        VENDOR_NAME: f?.VENDOR_NAME ?? toStr(it.VENDOR_NAME),
        REMARKS: f?.REMARKS ?? toStr(it.REMARKS),
      };
    }) : [];
    const ratingsArr = Array.isArray(output?.RATINGS) ? output!.RATINGS!.map((rt, idx) => {
      const f = ratings[idx];
      return {
        VENDOR: f?.VENDOR ?? toStr(rt.VENDOR),
        RATE: f?.RATE ?? toStr(rt.RATE),
      };
    }) : [];
    saveMutation.mutate({
      action: lastAction,
      user_id: userId.trim(),
      pr_number: header.PR_NUMBER,
      pr_date: header.PR_DATE,
      ter_sub_id: header.TER_SUB_ID,
      items: itemsArr,
      ratings: ratingsArr,
    });
  }

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
    setHeader({ PR_NUMBER: "", PR_DATE: "", TER_SUB_ID: "" });
    setItems({});
    setRatings({});
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

  const actionButtons: Array<{ label: string; action: ZnfaAction; variant: "default" | "outline" | "secondary" | "success" }> = [
    { label: "Rating", action: "RATE", variant: "default" },
    { label: "Change", action: "CHANGE", variant: "secondary" },
    { label: "Display", action: "DISPLAY", variant: "outline" },
    { label: "Attachments", action: "ATTACHMENTS", variant: "success" },
  ];

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="MM Approvals" title="ZNFA Rating" subtitle="Rate, change and review ZNFA tender records." />

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
            columns={buildDynamicColumns(rows).map((c) => ({
              ...c,
              cell: (r: any) => {
                const v = c.cell(r);
                return typeof v === "string" ? formatSapDateDMY(v) : v;
              },
            }))}
            headerExtras={
              <div className="flex items-center gap-2">
                {actionButtons.map(({ label, action, variant }) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={variant}
                    disabled={selected.size === 0 || createMutation.isPending}
                    onClick={() => handleAction(action)}
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

          {output && isEditable && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="success"
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          )}

          {output && (
            <Card ref={outputRef} className="p-4 space-y-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
                <Filter className="h-3.5 w-3.5" /> {outputTitle}
              </div>

              {lastAction === "ATTACHMENTS" ? (
                <div className="space-y-2">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-xs">Object Description</TableHead>
                          <TableHead className="text-xs">Created By</TableHead>
                          <TableHead className="text-xs">Created Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(output.ATTACHMENTS) && output.ATTACHMENTS.length > 0 ? (
                          output.ATTACHMENTS.map((att, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs">{toStr(att.OBJDES)}</TableCell>
                              <TableCell className="text-xs">{toStr(att.OWNNAM)}</TableCell>
                              <TableCell className="text-xs">{toStr(att.CRDAT)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">
                              No attachments.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">PR Number</Label>
                      <Input
                        value={header.PR_NUMBER}
                        onChange={(e) => setHeader((p) => ({ ...p, PR_NUMBER: e.target.value }))}
                        readOnly={!isEditable}
                        className={`h-9 text-sm ${isEditable ? "" : "bg-muted/40"}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">PR Date</Label>
                      <Input
                        value={header.PR_DATE}
                        onChange={(e) => setHeader((p) => ({ ...p, PR_DATE: e.target.value }))}
                        readOnly={!isEditable}
                        className={`h-9 text-sm ${isEditable ? "" : "bg-muted/40"}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">TER SUB ID</Label>
                      <Input
                        value={header.TER_SUB_ID}
                        onChange={(e) => setHeader((p) => ({ ...p, TER_SUB_ID: e.target.value }))}
                        readOnly={!isEditable}
                        className={`h-9 text-sm ${isEditable ? "" : "bg-muted/40"}`}
                      />
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
                            output.ITEMS.map((item, idx) => {
                              const it = items[idx] ?? {
                                SR_NO: toStr(item.SR_NO),
                                MATERIAL: toStr(item.MATERIAL),
                                DESCRIPTION: toStr(item.DESCRIPTION),
                                TENDER_SPEC: toStr(item.TENDER_SPEC),
                                UOM: toStr(item.UOM),
                                VENDOR_NAME: toStr(item.VENDOR_NAME),
                                REMARKS: toStr(item.REMARKS),
                              };
                              const setField = (k: keyof ItemFields, val: string) =>
                                setItems((prev) => ({ ...prev, [idx]: { ...it, ...prev[idx], [k]: val } }));
                              const renderCell = (k: keyof ItemFields, editable: boolean, placeholder?: string) =>
                                editable ? (
                                  <Input
                                    value={it[k]}
                                    onChange={(e) => setField(k, e.target.value)}
                                    className="h-8 text-xs"
                                    placeholder={placeholder}
                                  />
                                ) : (
                                  <span>{it[k] || "—"}</span>
                                );
                              return (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs">{renderCell("SR_NO", isEditable)}</TableCell>
                                  <TableCell className="text-xs">{renderCell("MATERIAL", isEditable)}</TableCell>
                                  <TableCell className="text-xs">{renderCell("DESCRIPTION", isEditable)}</TableCell>
                                  <TableCell className="text-xs">{renderCell("TENDER_SPEC", isEditable)}</TableCell>
                                  <TableCell className="text-xs">{renderCell("UOM", isEditable)}</TableCell>
                                  <TableCell className="text-xs">{renderCell("VENDOR_NAME", isEditable)}</TableCell>
                                  <TableCell className="text-xs">{renderCell("REMARKS", isEditable, "Enter remarks")}</TableCell>
                                </TableRow>
                              );
                            })
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
                            output.RATINGS.map((rating, idx) => {
                              const rt = ratings[idx] ?? { VENDOR: toStr(rating.VENDOR), RATE: toStr(rating.RATE) };
                              const setField = (k: keyof RatingFields, val: string) =>
                                setRatings((prev) => ({ ...prev, [idx]: { ...rt, ...prev[idx], [k]: val } }));
                              const renderCell = (k: keyof RatingFields) =>
                                isEditable ? (
                                  <Input
                                    value={rt[k]}
                                    onChange={(e) => setField(k, e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                ) : (
                                  <span>{rt[k] || "—"}</span>
                                );
                              const renderRateCell = () => {
                                if (!isEditable) return <span>{rt.RATE || "—"}</span>;
                                return (
                                  <Select value={rt.RATE || undefined} onValueChange={(v) => setField("RATE", v)}>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select rate" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ratingOptions.map((opt) => (
                                        <SelectItem key={opt} value={opt} className="text-xs">
                                          {opt}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                );
                              };
                              return (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs">{renderCell("VENDOR")}</TableCell>
                                  <TableCell className="text-xs">{renderRateCell()}</TableCell>
                                </TableRow>
                              );
                            })
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
                </>
              )}
            </Card>
          )}
        </>
      )}

      <SapResponseDialog
        dialog={messageDialog}
        onOpenChange={(open) => setMessageDialog((prev) => (prev ? { ...prev, open } : prev))}
        defaultTitle="ZNFA Rating"
      />
    </div>
  );
}
