import { useState } from "react";
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
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: {
      plant: string;
      user_id: string;
      customer_from: string;
      customer_to: string;
      status: Status;
      approval_type: ApprovalType;
    }) => fetchFn({ data: vars }),
    onSuccess: (res) => {
      setRows(res.rows);
      setLastFetchedAt(res.fetched_at);
      if (res.error) toast.error(res.error);
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
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
    setLastFetchedAt(null);
    if (plant.trim()) fetchFor(s, approvalType);
  }

  function onApprovalTypeChange(t: ApprovalType) {
    setApprovalType(t);
    setRows([]);
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
    setLastFetchedAt(null);
  }

  const canExecute = !!plant.trim() && !mutation.isPending;

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
            <Input
              value={plant}
              onChange={(e) => setPlant(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="e.g. 3801"
              className="h-9 font-mono"
              required
            />
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
              {lastFetchedAt ? ` · fetched ${new Date(lastFetchedAt).toLocaleTimeString()}` : ""}
            </div>
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b sticky top-0 z-10">
              <tr>
                <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Co. Code</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Sales Org</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Customer</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Customer Name</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Year</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Contract No</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Item</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Contract Ref No</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Ref Date</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Creation Date</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Contract Start</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Contract End</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Down Pay Req</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Adv. Amount</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Net Value</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Reason</th>
              </tr>
            </thead>
            <tbody>
              {mutation.isPending ? (
                <tr><td colSpan={17} className="py-12 text-center text-muted-foreground">Loading from SAP…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={17} className="py-12 text-center text-muted-foreground">
                  {plant.trim() ? "No records returned." : "Enter Plant and click Execute."}
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.company_code ?? "—"}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.sales_org ?? "—"}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.customer ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{r.customer_name ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.year ?? "—"}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.contract_no ?? "—"}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.contract_item ?? "—"}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.contract_ref_no ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.contract_ref_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.creation_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.contract_start)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.contract_end)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.down_pay_req)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.adv_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.net_value)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
