import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  fetchContractApprovals,
  submitContractDecision,
  type ContractRow,
} from "@/lib/sd/contract-approval.functions";

type Status = "pending" | "accepted" | "rejected";

export const Route = createFileRoute("/_authenticated/sd/contract")({
  component: ContractPage,
});

function rowKey(r: ContractRow, i: number) {
  return [r.contract_no, r.contract_item, r.customer, r.material, i]
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
  const s = String(v);
  if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
  const d = new Date(s);
  if (!isNaN(+d)) return d.toLocaleDateString("en-GB").replaceAll("/", ".");
  return s;
}

type SapMsg = {
  TYPE?: string;
  CUSTOMER?: string;
  CONTRACT?: string;
  MSG?: string;
  MESSAGE?: string;
};

type Severity = "success" | "warning" | "error" | "info";

function mapSeverity(raw: string | undefined): Severity {
  const t = String(raw ?? "").toUpperCase().trim();
  if (["@01@", "@5B@", "S"].includes(t)) return "success";
  if (["@02@", "@09@", "W"].includes(t)) return "warning";
  if (["@03@", "@5C@", "@AY@", "E", "A"].includes(t)) return "error";
  if (["@04@", "@08@", "I"].includes(t)) return "info";
  return "info";
}




function ContractPage() {
  const fetchFn = useServerFn(fetchContractApprovals);
  const decisionFn = useServerFn(submitContractDecision);

  const { activePlant: __ap } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(__ap ? [__ap] : []);
  useEffect(() => { if (__ap && plants.length === 0) setPlants([__ap]); /* eslint-disable-next-line */ }, [__ap]);
  const [userId, setUserId] = useState("");
  const [customerFrom, setCustomerFrom] = useState("");
  const [status, setStatusState] = useState<Status>("pending");
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Map<string, string>>(new Map());
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  function setReasonFor(k: string, value: string) {
    setReasons((prev) => {
      const next = new Map(prev);
      next.set(k, value);
      return next;
    });
  }

  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<{
    action: "accepted" | "rejected";
    messages: SapMsg[];
    total: number;
  }>({ action: "accepted", messages: [], total: 0 });

  const mutation = useMutation({
    mutationFn: async (vars: {
      plants: string[];
      user_id: string;
      customer_from: string;
      customer_to: string;
      status: Status;
    }) => {
      const v: any = await fetchFn({
        data: {
          plants: vars.plants,
          user_id: vars.user_id,
          customer_from: vars.customer_from,
          customer_to: vars.customer_to,
          status: vars.status,
        },
      });
      const rows = Array.isArray(v?.rows) ? (v.rows as ContractRow[]) : [];
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
      setReasons(new Map());
      setLastFetchedAt(res.fetched_at);
      if (res.error) toast.error(res.error);
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  function fetchFor(s: Status) {
    if (plants.length === 0) return;
    mutation.mutate({
      plants,
      user_id: userId.trim(),
      customer_from: customerFrom.trim(),
      customer_to: customerFrom.trim(),
      status: s,
    });
  }

  function execute() {
    if (plants.length === 0) return toast.error("Select at least one plant");
    fetchFor(status);
  }

  function onStatusChange(s: Status) {
    setStatusState(s);
    setSelected(new Set());
    setReasons(new Map());
    if (lastFetchedAt && plants.length > 0) fetchFor(s);
  }

  function reset() {
    setPlants([]);
    setUserId("");
    setCustomerFrom("");
    setStatusState("pending");
    setRows([]);
    setSelected(new Set());
    setReasons(new Map());
    setLastFetchedAt(null);
  }

  const canExecute = plants.length > 0 && !mutation.isPending;

  const indexed = useMemo(() => rows.map((r, i) => ({ r, k: rowKey(r, i) })), [rows]);


  const decisionMutation = useMutation({
    mutationFn: (vars: { action: "accepted" | "rejected"; user_id: string; rows: ContractRow[] }) =>
      decisionFn({ data: vars }),
    onSuccess: (res, vars) => {
      const dbg = (res as any)?.debug;
      if (dbg) {
        const status = dbg.response_status ?? "ERR";
        // eslint-disable-next-line no-console
        console.groupCollapsed(`[SAP] Contract_Approve_Reject · ${vars.action} · ${status} (${dbg.latency_ms}ms)`);
        // eslint-disable-next-line no-console
        console.log("URL:", dbg.target);
        // eslint-disable-next-line no-console
        console.log("Method:", dbg.method, "proxied:", dbg.proxied);
        // eslint-disable-next-line no-console
        console.log("Request headers:", dbg.request_headers);
        // eslint-disable-next-line no-console
        console.log("Request payload:", dbg.request_payload);
        // eslint-disable-next-line no-console
        console.log("Response status:", dbg.response_status);
        // eslint-disable-next-line no-console
        console.log("Response body:", dbg.response_body_preview);
        // eslint-disable-next-line no-console
        console.groupEnd();
      }
      const sap: any = (res as any)?.sap_response ?? {};
      let inner: any = sap?.data ?? sap;
      if (typeof inner === "string") {
        try { inner = JSON.parse(inner); } catch { /* ignore */ }
      }
      let rawMsgs: any =
        inner?.MESSAGE ?? inner?.message ?? inner?.Messages ?? inner?.MSG ??
        sap?.MESSAGE ?? sap?.message ?? sap?.Messages ?? null;
      if (!rawMsgs) {
        const preview = (res as any)?.debug?.response_body_preview;
        if (typeof preview === "string" && preview.trim()) {
          try {
            const p = JSON.parse(preview);
            const pInner = p?.data ?? p;
            rawMsgs =
              pInner?.MESSAGE ?? pInner?.message ?? pInner?.Messages ?? pInner?.MSG ??
              p?.MESSAGE ?? null;
          } catch { /* ignore */ }
        }
      }
      const msgs: SapMsg[] = Array.isArray(rawMsgs) ? rawMsgs : rawMsgs ? [rawMsgs] : [];

      const isOk = (res as any)?.ok !== false;
      const preview: string = (res as any)?.debug?.response_body_preview ?? "";

      if (!isOk && msgs.length === 0 && !preview.trim()) {
        toast.error((res as any).error ?? "SAP submission failed");
        return;
      }

      const finalMsgs: SapMsg[] =
        msgs.length > 0
          ? msgs
          : [{ TYPE: "I", MSG: preview.trim() || (res as any)?.error || "No response body from SAP" } as SapMsg];

      setResultData({ action: vars.action, messages: finalMsgs, total: vars.rows.length });
      setResultOpen(true);
      setSelected(new Set());
      setReasons(new Map());
      // Refresh pending list so processed rows drop out
      fetchFor("pending");

    },
    onError: (e: Error) => {
      // eslint-disable-next-line no-console
      console.error("[SAP] Contract_Approve_Reject failed:", e?.message ?? e);
      toast.error(e.message ?? "SAP submission failed");
    },
  });

  const missingReason = useMemo(() => {
    if (status !== "pending") return false;
    for (const { k } of indexed) {
      if (selected.has(k) && !(reasons.get(k) ?? "").trim()) return true;
    }
    return false;
  }, [status, indexed, selected, reasons]);

  function decide(action: "accepted" | "rejected") {
    if (status !== "pending" || selected.size === 0 || decisionMutation.isPending) return;
    const selectedRows = indexed
      .filter(({ k }) => selected.has(k))
      .map(({ r, k }) => ({ ...r, reason: (reasons.get(k) ?? "").trim() }));
    if (selectedRows.some((r) => !r.reason)) {
      toast.error("Reason is required for all selected rows");
      return;
    }
    decisionMutation.mutate({ action, user_id: userId.trim(), rows: selectedRows });
  }

  const showSelect = status === "pending";
  const canAct = showSelect && selected.size > 0 && !missingReason;
  const colSpan = showSelect ? 19 : 18;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Contract Approvals</h1>
        </div>
      </div>



      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">User ID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <Input
              value={customerFrom}
              onChange={(e) => setCustomerFrom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={!canExecute}>
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
          </div>
        </div>

        <div className="mt-4 -mx-4 px-4 pt-3 border-t">
          <div className="flex items-center gap-6 flex-wrap">
            <Label className="text-xs text-muted-foreground">
              Status <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => onStatusChange(v as Status)}
              className="flex items-center gap-5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="pending" id="st-pending" />
                Pending
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="accepted" id="st-accepted" />
                Accepted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="rejected" id="st-rejected" />
                Rejected
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      <CloudscapeApprovalTable
        title={`Contract Approvals — ${status}`}
        countLabel={`(${rows.length})`}
        rows={rows}
        rowKey={rowKey}
        loading={mutation.isPending}
        showSelect={showSelect}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onAccept={() => decide("accepted")}
        onReject={() => decide("rejected")}
        acceptDisabled={!canAct || decisionMutation.isPending}
        rejectDisabled={!canAct || decisionMutation.isPending}
        acceptLoading={decisionMutation.isPending && decisionMutation.variables?.action === "accepted"}
        rejectLoading={decisionMutation.isPending && decisionMutation.variables?.action === "rejected"}
        showReason={showSelect}
        reasonValue={(k) => reasons.get(k) ?? ""}
        onReasonChange={setReasonFor}
        reasonInvalid={(k) => selected.has(k) && !(reasons.get(k) ?? "").trim()}
        readonlyReason={(r) => r.reason ?? "—"}
        emptyMessage={lastFetchedAt ? `No ${status} records.` : "Enter Plant and click Execute to load contracts from SAP."}
        columns={[
          { id: "customer", header: "Customer", sortingField: "customer", cell: (r) => r.customer ?? "—" },
          { id: "customer_name", header: "Customer Name", sortingField: "customer_name", cell: (r) => r.customer_name ?? "—" },
          { id: "contract_no", header: "Contract No", sortingField: "contract_no", cell: (r) => r.contract_no ?? "—" },
          { id: "contract_item", header: "Item", sortingField: "contract_item", cell: (r) => r.contract_item ?? "—" },
          { id: "con_creation_date", header: "Con. Creation", cell: (r) => fmtDate(r.con_creation_date) },
          { id: "material", header: "Material", sortingField: "material", cell: (r) => r.material ?? "—" },
          { id: "qty", header: "Qty", align: "right", cell: (r) => fmtNum(r.qty) },
          { id: "net_value", header: "Net Value", align: "right", cell: (r) => fmtNum(r.net_value) },
          { id: "tax_value", header: "Tax Value", align: "right", cell: (r) => fmtNum(r.tax_value) },
          { id: "total", header: "Total", align: "right", cell: (r) => <strong>{fmtNum(r.total)}</strong> },
          { id: "agreement_from", header: "Agr. From", cell: (r) => fmtDate(r.agreement_from) },
          { id: "agreement_to", header: "Agr. To", cell: (r) => fmtDate(r.agreement_to) },
          { id: "service_valid_from", header: "Svc Valid From", cell: (r) => fmtDate(r.service_valid_from) },
          { id: "service_valid_to", header: "Svc Valid To", cell: (r) => fmtDate(r.service_valid_to) },
          { id: "sales_org", header: "Sales Org", sortingField: "sales_org", cell: (r) => r.sales_org ?? "—" },
          { id: "company_code", header: "Co. Code", sortingField: "company_code", cell: (r) => r.company_code ?? "—" },
        ] as CloudscapeColumn<ContractRow>[]}
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

function FilterInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filter…"
      className="h-7 text-xs bg-background text-foreground"
    />
  );
}

function PagerNav({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  const pages: (number | "ellipsis")[] = [];
  const push = (v: number | "ellipsis") => pages.push(v);
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) push(i);
  } else {
    push(1);
    if (page > 3) push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(pageCount - 1, page + 1);
    for (let i = start; i <= end; i++) push(i);
    if (page < pageCount - 2) push("ellipsis");
    push(pageCount);
  }
  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => { e.preventDefault(); if (page > 1) onChange(page - 1); }}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                href="#"
                isActive={p === page}
                onClick={(e) => { e.preventDefault(); onChange(p); }}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => { e.preventDefault(); if (page < pageCount) onChange(page + 1); }}
            aria-disabled={page >= pageCount}
            className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}


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
  const severities = messages.map((m) => mapSeverity(m?.TYPE));
  const hasError = severities.some((s) => s === "error");
  const hasWarn = severities.some((s) => s === "warning");
  const successCount = severities.filter((s) => s === "success").length;
  const tone: "success" | "error" | "warning" = hasError ? "error" : hasWarn ? "warning" : "success";

  const banner = {
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      title: action === "accepted" ? "Approved successfully" : "Rejected successfully",
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

  function badge(sev: Severity) {
    if (sev === "success")
      return <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Success</span>;
    if (sev === "error")
      return <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Error</span>;
    if (sev === "warning")
      return <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">Warning</span>;
    return <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">Info</span>;
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
                <div key={i} className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">
                      {m?.MSG || m?.MESSAGE || "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                      Customer: {m?.CUSTOMER?.trim() ? m.CUSTOMER : "—"}
                      {m?.CONTRACT ? <> · Contract: {m.CONTRACT}</> : null}
                    </div>
                  </div>
                  <div className="shrink-0">{badge(severities[i])}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

