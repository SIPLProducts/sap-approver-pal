import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  fetchPriceApprovals,
  getMySapUserId,
  submitPriceDecision,
  type PriceRow,
} from "@/lib/sd/price-approval.functions";

export const Route = createFileRoute("/_authenticated/sd/price")({
  component: PricePage,
});

function rowKey(r: PriceRow, i: number) {
  return [r.key_combination, r.condition_type, r.customer, r.material, r.plant, i]
    .map((x) => x ?? "")
    .join("|");
}

function fmtNum(v: string | number | null) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  // SAP often returns YYYYMMDD or YYYY-MM-DD; render as-is when not parseable.
  const s = String(v);
  if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
  const d = new Date(s);
  if (!isNaN(+d)) return d.toLocaleDateString("en-GB").replaceAll("/", ".");
  return s;
}

function PricePage() {
  const fetchFn = useServerFn(fetchPriceApprovals);
  const userIdFn = useServerFn(getMySapUserId);
  const decisionFn = useServerFn(submitPriceDecision);

  const { data: userIdData } = useQuery({
    queryKey: ["sd-price", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const { activePlant } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlant ? [activePlant] : []);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    if (activePlant && plants.length === 0) setPlants([activePlant]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlant]);

  useEffect(() => {
    if (userIdData?.sap_user_id && !userId) setUserId(userIdData.sap_user_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdData?.sap_user_id]);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);


  type SapMsg = { CUSTOMER?: string; TYPE?: string; MESSAGE?: string };
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<{
    action: "accepted" | "rejected";
    messages: SapMsg[];
    total: number;
  }>({ action: "accepted", messages: [], total: 0 });

  const mutation = useMutation({
    mutationFn: async (vars: { plants: string[]; user_id: string }) => {
      const v: any = await fetchFn({
        data: { plants: vars.plants, user_id: vars.user_id || undefined },
      });
      const rows = Array.isArray(v?.rows) ? (v.rows as PriceRow[]) : [];
      return {
        rows,
        count: rows.length,
        error: v?.error ?? null,
        fetched_at: v?.fetched_at ?? new Date().toISOString(),
      };
    },
    onSuccess: (res) => {
      setRows(res.rows);
      setDecided({});
      setSelected(new Set());
      setLastFetchedAt(res.fetched_at);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });


  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    mutation.mutate({ plants, user_id: userId.trim() });
  }

  function reset() {
    setPlants([]);
    setUserId(userIdData?.sap_user_id ?? "");
    setRows([]);
    setDecided({});
    setSelected(new Set());
    setLastFetchedAt(null);
  }

  // Show all fetched rows (no tab filtering)
  const indexed = useMemo(() => rows.map((r, i) => ({ r, k: rowKey(r, i) })), [rows]);
  const visible = indexed;

  const totalPages = pageSize === "ALL" ? 1 : Math.max(1, Math.ceil(visible.length / pageSize));
  useEffect(() => { setPage(1); }, [rows, pageSize]);
  const currentPage = Math.min(page, totalPages);
  const pagedVisible = pageSize === "ALL"
    ? visible
    : visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Select-all scoped to the currently visible page for predictable UX.
  const allChecked = pagedVisible.length > 0 && pagedVisible.every(({ k }) => selected.has(k));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pagedVisible.forEach(({ k }) => next.delete(k));
      else pagedVisible.forEach(({ k }) => next.add(k));
      return next;
    });
  }

  function toggleOne(k: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const decisionMutation = useMutation({
    mutationFn: (vars: { action: "accepted" | "rejected"; rows: PriceRow[]; user_id: string }) => {
      console.log("[price-decision] sending", vars);
      return decisionFn({ data: vars });
    },
    onSuccess: (res, vars) => {
      console.log("[price-decision] response", res);
      const keys = Array.from(selected);
      setDecided((prev) => {
        const next = { ...prev };
        keys.forEach((k) => (next[k] = vars.action));
        return next;
      });
      setSelected(new Set());

      const sap: any = (res as any)?.sap_response ?? {};
      const inner: any = sap?.data ?? sap;
      const rawMsgs =
        inner?.MESSAGE ?? inner?.message ?? inner?.Messages ?? sap?.MESSAGE ?? [];
      const msgs: SapMsg[] = Array.isArray(rawMsgs) ? rawMsgs : rawMsgs ? [rawMsgs] : [];

      setResultData({ action: vars.action, messages: msgs, total: vars.rows.length });
      setResultOpen(true);
    },
    onError: (e: Error) => {
      console.error("[price-decision] failed", e);
      toast.error(e.message ?? "SAP submission failed");
    },
  });

  function decide(action: "accepted" | "rejected") {
    if (selected.size === 0 || decisionMutation.isPending) return;
    const selectedRows = indexed.filter(({ k }) => selected.has(k)).map(({ r }) => r);
    decisionMutation.mutate({ action, rows: selectedRows, user_id: userId.trim() });
  }


  const canAct = selected.size > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Price Approvals</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-[240px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} />
          </div>
          <div />
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={plants.length === 0 || mutation.isPending}>
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


      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Output
            </div>
            <div className="text-xs text-muted-foreground">
              {visible.length} record{visible.length === 1 ? "" : "s"}
              {selected.size > 0 ? ` · ${selected.size} selected` : ""}
              {lastFetchedAt ? ` · fetched ${new Date(lastFetchedAt).toLocaleTimeString()}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => decide("accepted")}
              disabled={!canAct || decisionMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              title={selected.size === 0 ? "Select at least one row" : undefined}
            >
              {decisionMutation.isPending && decisionMutation.variables?.action === "accepted" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Accept
            </Button>
            <Button size="sm" variant="destructive" onClick={() => decide("rejected")} disabled={!canAct || decisionMutation.isPending}>
              {decisionMutation.isPending && decisionMutation.variables?.action === "rejected" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5 mr-1" />
              )}
              Reject
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-sidebar text-sidebar-foreground border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 w-10">
                  <Checkbox
                    className="rounded-none border-sidebar-foreground/60"
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    disabled={pagedVisible.length === 0}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Key Comb.</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Cond. Type</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Customer</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Price Grp</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Plant</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Material</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">New Price</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Curr</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">UOM</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Valid From</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Valid To</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Old Price</th>
              </tr>
            </thead>
            <tbody>
              {mutation.isPending ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Fetching from SAP…
                  </td>
                </tr>
              ) : pagedVisible.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-muted-foreground">
                    {rows.length === 0
                      ? "Enter a Plant and click Execute to load price approvals from SAP."
                      : "No records."}
                  </td>
                </tr>
              ) : (
                pagedVisible.map(({ r, k }, i) => {
                  const isSel = selected.has(k);
                  const rowIndex = pageSize === "ALL" ? i : (currentPage - 1) * (pageSize as number) + i;
                  return (
                    <tr
                      key={k}
                      className={`border-b last:border-0 hover:bg-accent/40 ${isSel ? "bg-accent/30" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          className="rounded-none"
                          checked={isSel}
                          onCheckedChange={() => toggleOne(k)}
                          aria-label="Select row"
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{rowIndex + 1}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.key_combination ?? "—"}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.condition_type ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.customer ?? "—"}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.price_group ?? "—"}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.plant ?? "—"}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.material ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(r.new_price)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.currency ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.uom ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.valid_from_sc)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.valid_to_sc)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.old_price)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t bg-muted/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(v === "ALL" ? "ALL" : Number(v))}
            >
              <SelectTrigger className="h-8 w-[84px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["10", "20", "25", "50", "100", "ALL"].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-2">
              {visible.length === 0
                ? "0 of 0"
                : pageSize === "ALL"
                  ? `1–${visible.length} of ${visible.length}`
                  : `${(currentPage - 1) * (pageSize as number) + 1}–${Math.min(currentPage * (pageSize as number), visible.length)} of ${visible.length}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSize === "ALL" || currentPage <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSize === "ALL" || currentPage >= totalPages}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

      </Card>

      <ResultDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        action={resultData.action}
        messages={resultData.messages}
        total={resultData.total}
      />
    </div>
  );
}

type SapMsg = { CUSTOMER?: string; TYPE?: string; MESSAGE?: string };

function ResultDialog({
  open,
  onOpenChange,
  action,
  messages,
  total,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: "accepted" | "rejected";
  messages: SapMsg[];
  total: number;
}) {
  const types = messages.map((m) => String(m?.TYPE ?? "").toUpperCase());
  const hasError = types.some((t) => t === "E" || t === "A");
  const hasWarn = types.some((t) => t === "W");
  const successCount = types.filter((t) => t === "S").length;

  const tone: "success" | "error" | "warning" = hasError
    ? "error"
    : hasWarn
      ? "warning"
      : "success";

  const banner = {
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      title:
        action === "accepted"
          ? "Approved successfully"
          : "Rejected successfully",
    },
    error: {
      bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
      icon: <XCircle className="h-5 w-5 text-red-600" />,
      title: "Completed with errors",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      title: "Completed with warnings",
    },
  }[tone];

  function badge(type?: string) {
    const t = String(type ?? "").toUpperCase();
    if (t === "S")
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Success
        </span>
      );
    if (t === "E" || t === "A")
      return (
        <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Error
        </span>
      );
    if (t === "W")
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Warning
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
        Info
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>SAP Response</DialogTitle>
        </DialogHeader>

        <div className={`flex items-start gap-3 rounded-lg border p-3 ${banner.bg}`}>
          {banner.icon}
          <div className="min-w-0">
            <div className="font-semibold text-sm">{banner.title}</div>
          </div>
        </div>

        {messages.length > 0 && (
          <>
            <div className="text-xs font-semibold text-muted-foreground mt-2">
              SAP Response Details
            </div>
            <div className="max-h-[55vh] overflow-auto space-y-2 pr-1">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">
                      {m?.MESSAGE || "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                      Customer: {m?.CUSTOMER?.trim() ? m.CUSTOMER : "—"}
                    </div>
                  </div>
                  <div className="shrink-0">{badge(m?.TYPE)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
