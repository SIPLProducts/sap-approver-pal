import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2, CheckCircle2, XCircle, AlertTriangle, FileText } from "lucide-react";

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
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
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
  const navigate = useNavigate();

  const { data: userIdData } = useQuery({
    queryKey: ["sd-price", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    setPlants((prev) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = prev.filter((c) => allowed.has(c));
      return kept.length === 0 ? activePlants : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

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
    setSelected(new Set());
    setLastFetchedAt(null);
  }

  const indexed = useMemo(() => rows.map((r, i) => ({ r, k: rowKey(r, i) })), [rows]);

  const decisionMutation = useMutation({
    mutationFn: (vars: { action: "accepted" | "rejected"; rows: PriceRow[]; user_id: string }) => {
      console.log("[price-decision] sending", vars);
      return decisionFn({ data: vars });
    },
    onSuccess: (res, vars) => {
      console.log("[price-decision] response", res);
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/sd/price-reports" })}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Reports
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

      </Card>


      <CloudscapeApprovalTable
        title="Price Approvals"
        countLabel={`(${rows.length})`}
        rows={rows}
        rowKey={rowKey}
        loading={mutation.isPending}
        showSelect
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onAccept={() => decide("accepted")}
        onReject={() => decide("rejected")}
        acceptDisabled={!canAct || decisionMutation.isPending}
        rejectDisabled={!canAct || decisionMutation.isPending}
        acceptLoading={decisionMutation.isPending && decisionMutation.variables?.action === "accepted"}
        rejectLoading={decisionMutation.isPending && decisionMutation.variables?.action === "rejected"}
        emptyMessage={rows.length === 0 ? "Enter a Plant and click Execute to load price approvals from SAP." : "No records."}
        columns={buildDynamicColumns(rows, { exclude: ["release_code_1", "approval_status"] })}
      />



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
