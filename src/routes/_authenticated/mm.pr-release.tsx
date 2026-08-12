import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlantSelect } from "@/components/sap/plant-select";
import { ReleaseKeySelect } from "@/components/mm/release-key-select";
import { useActiveContext, releaseKeysFor } from "@/hooks/use-active-context";
import { fetchPrReleaseMultiple, releasePrItems, rejectPrItems } from "@/lib/mm/pr-release.functions";
import { PageHeader } from "@/components/exec/page-header";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

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
  REMARKS: "Remarks",
};

function rowKey(r: Record<string, any>, idx: number) {
  const preq = r.PREQ_NO ?? "";
  const item = r.PREQ_ITEM ?? "";
  return `${preq}-${item}-${idx}`;
}

function PrReleasePage() {
  const { plants: assignedPlants, activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants.slice(0, 1));
  const [releaseGroup, setReleaseGroup] = useState("");
  const [releaseCode, setReleaseCode] = useState("");
  const prKeys = useMemo(
    () => releaseKeysFor(assignedPlants, "pr", plants),
    [assignedPlants, plants],
  );
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const { confirm, confirmDialog } = useConfirm();
  const silentRefreshRef = useRef(false);
  const [responseDialog, setResponseDialog] = useState<
    | {
        open: boolean;
        title: string;
        results: Array<{
          preq: string;
          message: string;
          ok: boolean;
          response?: any;
        }>;
      }
    | null
  >(null);

  useEffect(() => {
    setPlants((prev) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = prev.filter((c) => allowed.has(c)).slice(0, 1);
      return kept.length === 0 ? activePlants.slice(0, 1) : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  const fetchFn = useServerFn(fetchPrReleaseMultiple);
  const mutation = useMutation({
    mutationFn: (input: { relgroup: string; relcode: string; plants: string[] }) =>
      fetchFn({ data: input }),
    onSuccess: (res) => {
      const silent = silentRefreshRef.current;
      silentRefreshRef.current = false;
      const fetched = Array.isArray(res.data) ? res.data : [];

      if (res.error || fetched.length === 0) {
        setRows([]);
        setSelected(new Set());
        setRemarks({});
        if (!silent) {
          setResponseDialog({
            open: true,
            title: "PR Release",
            results: [
              {
                preq: "",
                message: res.error || "No data available.",
                ok: false,
              },
            ],
          });
        }
        return;
      }
      setRows(fetched);
      setSelected(new Set());
      setRemarks({});
      if (!silent) toast.success(`Loaded ${fetched.length} row(s).`);
    },
    onError: (e: any) => {
      const silent = silentRefreshRef.current;
      silentRefreshRef.current = false;
      setRows([]);
      setSelected(new Set());
      setRemarks({});
      if (silent) return;
      setResponseDialog({
        open: true,
        title: "PR Release",
        results: [
          {
            preq: "",
            message: e?.message ?? "Failed to fetch PR Release data.",
            ok: false,
          },
        ],
      });
    },
  });

  function execute() {
    if (plants.length === 0) {
      toast.error("Select a plant.");
      return;
    }
    if (!releaseGroup.trim() || !releaseCode.trim()) {
      toast.error("Release Group and Release Code are required.");
      return;
    }
    mutation.mutate({ relgroup: releaseGroup.trim(), relcode: releaseCode.trim(), plants });
  }

  function reset() {
    setPlants(activePlants.slice(0, 1));
    setReleaseGroup("");
    setReleaseCode("");
    setRows([]);
    setSelected(new Set());
    setRemarks({});
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withIdx = rows.map((r, i) => ({ r, i }));
    if (!q) return withIdx;
    return withIdx.filter(({ r }) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const allKeys = useMemo(
    () => filteredRows.map(({ r, i }) => rowKey(r, i)),
    [filteredRows],
  );
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
    if (!seen.has("REMARKS")) keys.push("REMARKS");
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

  const releaseFn = useServerFn(releasePrItems);
  const releaseMutation = useMutation({
    mutationFn: (input: {
      relgroup: string;
      relcode: string;
      items: { PREQ_NO: string; PREQ_ITEM: string; REMARKS?: string }[];
    }) => releaseFn({ data: input }),
    onSuccess: (res) => {
      const releasedKeys = new Set<string>();
      for (const r of res.results) if (r.ok) releasedKeys.add(`${r.preq_no}-${r.preq_item}`);

      setResponseDialog({
        open: true,
        title: "PR Release — SAP Response",
        results: res.results.map((r: any) => ({
          preq: `${r.preq_no}/${r.preq_item}`,
          message: r.msgtxt || r.MSGTXT || r.error || (r.ok ? "Released" : "Failed"),
          ok: !!r.ok,
          response: r.response,
        })),
      });

      if (releasedKeys.size > 0) {
        setRows((prev) =>
          prev.filter(
            (r) => !releasedKeys.has(`${String(r.PREQ_NO ?? "")}-${String(r.PREQ_ITEM ?? "")}`),
          ),
        );
        setSelected(new Set());
        setRemarks({});
      }
      // Refresh the pending list so released rows disappear.
      if (releaseGroup.trim() && releaseCode.trim()) {
        silentRefreshRef.current = true;
        mutation.mutate({ relgroup: releaseGroup.trim(), relcode: releaseCode.trim(), plants });
      }
    },
    onError: (e: any) => {
      setResponseDialog({
        open: true,
        title: "PR Release — SAP Response",
        results: [{ preq: "", message: e?.message ?? "Release failed.", ok: false }],
      });
    },
  });

  function onRelease() {
    if (selected.size === 0) return;
    if (!releaseGroup.trim() || !releaseCode.trim()) {
      toast.error("Release Group and Release Code are required.");
      return;
    }
    const items = rows
      .map((r, i) => ({ r, k: rowKey(r, i) }))
      .filter(({ k }) => selected.has(k))
      .map(({ r, k }) => ({
        PREQ_NO: String(r.PREQ_NO ?? ""),
        PREQ_ITEM: String(r.PREQ_ITEM ?? ""),
        REMARKS: remarks[k] ?? (r.REMARKS == null ? "" : String(r.REMARKS)),
      }))
      .filter((it) => it.PREQ_NO && it.PREQ_ITEM);
    if (items.length === 0) return;
    void (async () => {
      if (
        !(await confirm({
          title: `Release ${items.length} selected item(s)?`,
          description: "This posts the release to SAP and cannot be undone.",
          confirmLabel: "Release",
          destructive: false,
        }))
      )
        return;
      releaseMutation.mutate({
        relgroup: releaseGroup.trim(),
        relcode: releaseCode.trim(),
        items,
      });
    })();
  }
  const rejectFn = useServerFn(rejectPrItems);
  const rejectMutation = useMutation({
    mutationFn: (input: {
      relgroup: string;
      relcode: string;
      items: { PREQ_NO: string; PREQ_ITEM: string; REMARKS?: string }[];
    }) => rejectFn({ data: input }),
    onSuccess: (res) => {
      const rejectedKeys = new Set<string>();
      for (const r of res.results) {
        const label = `PR ${r.preq_no}/${r.preq_item}`;
        const msg = r.msgtxt || r.error || (r.ok ? "Rejected" : "Failed");
        if (r.ok) {
          toast.success(`${label}: ${msg}`);
          rejectedKeys.add(`${r.preq_no}-${r.preq_item}`);
        } else {
          toast.error(`${label}: ${msg}`);
        }
      }
      if (rejectedKeys.size > 0) {
        setRows((prev) =>
          prev.filter(
            (r) => !rejectedKeys.has(`${String(r.PREQ_NO ?? "")}-${String(r.PREQ_ITEM ?? "")}`),
          ),
        );
        setSelected(new Set());
        setRemarks({});
      }
      if (releaseGroup.trim() && releaseCode.trim()) {
        mutation.mutate({ relgroup: releaseGroup.trim(), relcode: releaseCode.trim(), plants });
      }
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Reject failed.");
    },
  });

  function onReject() {
    if (selected.size === 0) return;
    if (!releaseGroup.trim() || !releaseCode.trim()) {
      toast.error("Release Group and Release Code are required.");
      return;
    }
    const items = rows
      .map((r, i) => ({ r, k: rowKey(r, i) }))
      .filter(({ k }) => selected.has(k))
      .map(({ r, k }) => ({
        PREQ_NO: String(r.PREQ_NO ?? ""),
        PREQ_ITEM: String(r.PREQ_ITEM ?? ""),
        REMARKS: remarks[k] ?? (r.REMARKS == null ? "" : String(r.REMARKS)),
      }))
      .filter((it) => it.PREQ_NO);
    if (items.length === 0) return;
    void (async () => {
      if (
        !(await confirm({
          title: `Reject ${items.length} selected item(s)?`,
          description: "This posts the rejection to SAP and cannot be undone.",
          confirmLabel: "Reject",
        }))
      )
        return;
      rejectMutation.mutate({
        relgroup: releaseGroup.trim(),
        relcode: releaseCode.trim(),
        items,
      });
    })();
  }

  const showResults = mutation.isSuccess || rows.length > 0;

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="MM Approvals" title="PR Release" subtitle="Release or reject pending purchase requisitions." />

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid gap-3 md:grid-cols-[280px_240px_240px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantSelect
              value={plants[0] ?? ""}
              onChange={(v) => setPlants(v ? [v] : [])}
              source="user-plant"
            />
          </div>
          <ReleaseKeySelect
            keys={prKeys}
            group={releaseGroup}
            code={releaseCode}
            onGroupChange={setReleaseGroup}
            onCodeChange={setReleaseCode}
            disabled={mutation.isPending}
          />

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

      <div className="flex justify-end gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onReject}
          disabled={selected.size === 0 || rejectMutation.isPending}
        >
          {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Reject
        </Button>
        <Button
          variant="success"
          size="sm"
          onClick={onRelease}
          disabled={selected.size === 0 || releaseMutation.isPending}
        >
          {releaseMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Release
        </Button>
      </div>

      {mutation.isPending && !showResults && <SkeletonRows columns={6} />}

      {showResults && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="text-xs font-semibold text-muted-foreground">
              RESULTS · {filteredRows.length}
              {search.trim() ? ` / ${rows.length}` : ""} row(s) · {selected.size} selected
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search results..."
                className="h-9 text-sm pl-8"
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No data available" description="Run the selection above to load PR release items." />
          ) : (
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
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground py-6">
                        No results match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map(({ r, i }) => {
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
                              {key === "REMARKS" ? (
                                <Input
                                  value={remarks[k] ?? (r.REMARKS == null ? "" : String(r.REMARKS))}
                                  onChange={(e) =>
                                    setRemarks((prev) => ({ ...prev, [k]: e.target.value }))
                                  }
                                  placeholder="Remarks"
                                  className="h-8 text-xs min-w-[180px]"
                                />
                              ) : r[key] === null || r[key] === undefined || r[key] === "" ? (
                                "-"
                              ) : (
                                String(r[key])
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
      {confirmDialog}
    </div>
  );
}
