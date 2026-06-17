import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fetchScSoApprovals, type ScSoRow } from "@/lib/sd/sc-so-approval.functions";

type Status = "pending" | "accepted" | "rejected";
type ApprovalType = "service" | "sales";

const searchSchema = z.object({
  status: fallback(z.enum(["pending", "accepted", "rejected"]), "pending").default("pending"),
});

export const Route = createFileRoute("/_authenticated/sd/sc-so")({
  validateSearch: zodValidator(searchSchema),
  component: ScSoPage,
});

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

function rowKey(r: ScSoRow, i: number) {
  return [r.company_code, r.contract_no, r.contract_item, r.customer, i]
    .map((x) => x ?? "")
    .join("|");
}

const COLS: Array<{ key: string; label: string; align?: "right"; date?: boolean; num?: boolean; mono?: boolean }> = [
  { key: "company_code", label: "Co. Code", mono: true },
  { key: "sales_org", label: "Sales Org", mono: true },
  { key: "customer", label: "Customer", mono: true },
  { key: "customer_name", label: "Customer Name" },
  { key: "year", label: "Year" },
  { key: "contract_no", label: "Contract No", mono: true },
  { key: "contract_item", label: "Item", mono: true },
  { key: "contract_ref_no", label: "Contract Ref No", mono: true },
  { key: "contract_ref_date", label: "Ref Date", date: true },
  { key: "con_creation_date", label: "Creation Date", date: true },
  { key: "contract_start_date", label: "Contract Start", date: true },
  { key: "contract_end_date", label: "Contract End", date: true },
  { key: "down_pay_req_amount", label: "Down Pay Req", align: "right", num: true },
  { key: "adv_doc_zeile", label: "Adv Zeile", mono: true },
  { key: "adv_doc_ebelp", label: "Adv Ebelp", mono: true },
  { key: "adv_amount", label: "Adv Amount", align: "right", num: true },
  { key: "profit_center", label: "Profit Center", mono: true },
  { key: "clearing_document", label: "Clearing Doc", mono: true },
  { key: "customer_group", label: "Cust Group" },
  { key: "customer_price_group", label: "Price Group" },
  { key: "service_valid_from", label: "Service Valid From", date: true },
  { key: "service_valid_to", label: "Service Valid To", date: true },
  { key: "service_start_date", label: "Service Start", date: true },
  { key: "registration_date", label: "Reg. Date", date: true },
  { key: "cus_agr_from", label: "Cus Agr From", date: true },
  { key: "cus_agr_to", label: "Cus Agr To", date: true },
  { key: "active_inactive", label: "Active", mono: true },
  { key: "no_of_beds_to_be_inv", label: "Beds Inv", align: "right" },
  { key: "fixed_rate", label: "Fixed Rate", align: "right", num: true },
  { key: "per_bed_rate", label: "Per Bed Rate", align: "right", num: true },
  { key: "excess_qty_rate", label: "Excess Qty Rate", align: "right", num: true },
  { key: "upper_slab_qty", label: "Upper Slab Qty", align: "right", num: true },
  { key: "code_land_qty", label: "Code Land Qty", align: "right", num: true },
  { key: "total_balance", label: "Total Balance", align: "right", num: true },
  { key: "ph_reason_code", label: "PH Reason Code", mono: true },
];

function ScSoPage() {
  const { status: urlStatus } = Route.useSearch();
  const fetchFn = useServerFn(fetchScSoApprovals);

  const [plant, setPlant] = useState("");
  const [userId, setUserId] = useState("");
  const [customerFrom, setCustomerFrom] = useState("");
  const [customerTo, setCustomerTo] = useState("");
  const [status, setStatus] = useState<Status>(urlStatus);
  const [approvalType, setApprovalType] = useState<ApprovalType>("service");
  const [rows, setRows] = useState<ScSoRow[]>([]);
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

  const mutation = useMutation({
    mutationFn: (vars: {
      plant: string;
      user_id: string;
      customer_from: string;
      customer_to: string;
      status: Status;
      approval_type: ApprovalType;
    }) => fetchFn({ data: vars }),
    onSuccess: (res: any) => {
      const d = res?.debug;
      console.groupCollapsed(
        `[SAP] Sevice_Certificate_Fetch · ${d?.response_status ?? "?"} (${d?.latency_ms ?? "?"}ms)`,
      );
      console.log("URL:", d?.target);
      console.log("Method:", d?.method, "proxied:", d?.proxied);
      console.log("Request payload:", d?.request_payload ?? res?.payload);
      console.log("Response status:", d?.response_status);
      console.log("Response body preview:", d?.response_body_preview);
      console.log("Mapped rows:", res?.rows);
      console.groupEnd();
      setRows(res.rows);
      setSelected(new Set());
      setReasons(new Map());
      setLastFetchedAt(res.fetched_at);
      if (res.error) toast.error(res.error);
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => {
      console.error("[SAP] Sevice_Certificate_Fetch failed:", e);
      toast.error(e.message ?? "Failed to fetch from SAP");
    },
  });

  function fetchFor(s: Status, t: ApprovalType) {
    const p = plant.trim();
    if (!p) return;
    mutation.mutate({
      plant: p,
      user_id: userId.trim(),
      customer_from: customerFrom.trim(),
      customer_to: customerTo.trim() || customerFrom.trim(),
      status: s,
      approval_type: t,
    });
  }

  function execute() {
    if (!plant.trim()) return toast.error("Plant is required");
    fetchFor(status, approvalType);
  }

  function onStatusChange(s: Status) {
    setStatus(s);
    setRows([]);
    setSelected(new Set());
    setReasons(new Map());
    setLastFetchedAt(null);
    if (plant.trim()) fetchFor(s, approvalType);
  }

  function onApprovalTypeChange(t: ApprovalType) {
    setApprovalType(t);
    setRows([]);
    setSelected(new Set());
    setReasons(new Map());
    setLastFetchedAt(null);
    if (plant.trim()) fetchFor(status, t);
  }

  function reset() {
    setPlant("");
    setUserId("");
    setCustomerFrom("");
    setCustomerTo("");
    setStatus("pending");
    setApprovalType("service");
    setRows([]);
    setSelected(new Set());
    setReasons(new Map());
    setLastFetchedAt(null);
  }

  const canExecute = !!plant.trim() && !mutation.isPending;
  const indexed = useMemo(() => rows.map((r, i) => ({ r, k: rowKey(r, i) })), [rows]);
  const showSelect = status === "pending";
  const allChecked = indexed.length > 0 && indexed.every(({ k }) => selected.has(k));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) indexed.forEach(({ k }) => next.delete(k));
      else indexed.forEach(({ k }) => next.add(k));
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

  const baseCols = COLS.length + 2; // # + data cols + reason
  const colSpan = showSelect ? baseCols + 1 : baseCols;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Service Certificate & SO Approvals</h1>
          <p className="text-sm text-muted-foreground">
            BMW Service Certificate / Sales Order PH approvals fetched live from SAP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">ZBMW_SC_ISSUE_PH</Badge>
          <Badge variant="secondary" className="text-xs">Single level</Badge>
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
            <PlantSelect value={plant} onChange={setPlant} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">User ID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="e.g. NEOBMWCONS1"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer From</Label>
            <Input
              value={customerFrom}
              onChange={(e) => setCustomerFrom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="optional"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer To</Label>
            <Input
              value={customerTo}
              onChange={(e) => setCustomerTo(e.target.value)}
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

        <div className="mt-4 -mx-4 px-4 pt-3 border-t space-y-3">
          <div className="flex items-center gap-6 flex-wrap">
            <Label className="text-xs text-muted-foreground min-w-[100px]">
              Status <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => onStatusChange(v as Status)}
              className="flex items-center gap-5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="pending" id="scso-st-pending" />
                Pending
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="accepted" id="scso-st-accepted" />
                Accepted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="rejected" id="scso-st-rejected" />
                Rejected
              </label>
            </RadioGroup>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <Label className="text-xs text-muted-foreground min-w-[100px]">
              Approval Type
            </Label>
            <RadioGroup
              value={approvalType}
              onValueChange={(v) => onApprovalTypeChange(v as ApprovalType)}
              className="flex items-center gap-5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="service" id="scso-t-service" />
                Service Certificate Approvals
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="sales" id="scso-t-sales" />
                Sales Order Approvals
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Output — {status} · {approvalType === "service" ? "Service Certificate" : "Sales Order"}
            </div>
            <div className="text-xs text-muted-foreground">
              {rows.length} record{rows.length === 1 ? "" : "s"}
              {showSelect && selected.size > 0 ? ` · ${selected.size} selected` : ""}
              {lastFetchedAt ? ` · fetched ${new Date(lastFetchedAt).toLocaleTimeString()}` : ""}
            </div>
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b sticky top-0 z-10">
              <tr>
                {showSelect && (
                  <th className="px-3 py-2 w-10">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={toggleAll}
                      disabled={rows.length === 0}
                      aria-label="Select all"
                    />
                  </th>
                )}
                <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className={`${c.align === "right" ? "text-right" : "text-left"} font-semibold px-3 py-2 whitespace-nowrap`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Reason</th>
              </tr>
            </thead>
            <tbody>
              {mutation.isPending ? (
                <tr><td colSpan={colSpan} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading from SAP…
                </td></tr>
              ) : indexed.length === 0 ? (
                <tr><td colSpan={colSpan} className="py-12 text-center text-muted-foreground">
                  {lastFetchedAt ? `No ${status} records.` : "Enter Plant and click Execute."}
                </td></tr>
              ) : indexed.map(({ r, k }, i) => {
                const isSel = selected.has(k);
                return (
                  <tr
                    key={k}
                    className={`border-b last:border-0 hover:bg-accent/40 ${showSelect && isSel ? "bg-accent/30" : ""}`}
                  >
                    {showSelect && (
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(k)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    {COLS.map((c) => {
                      const v = (r as any)[c.key] as string | number | null;
                      const display = c.date
                        ? fmtDate(v as string | null)
                        : c.num
                          ? fmtNum(v)
                          : v == null || v === ""
                            ? "—"
                            : String(v);
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.mono ? "font-mono" : ""}`}
                        >
                          {display}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {showSelect ? (
                        <Input
                          value={reasons.get(k) ?? ""}
                          onChange={(e) => setReasonFor(k, e.target.value)}
                          placeholder="Required if selected"
                          maxLength={50}
                          aria-invalid={isSel && !(reasons.get(k) ?? "").trim()}
                          className={`h-8 w-44 font-mono text-xs ${
                            isSel && !(reasons.get(k) ?? "").trim()
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                        />
                      ) : (
                        r.reason ?? "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
