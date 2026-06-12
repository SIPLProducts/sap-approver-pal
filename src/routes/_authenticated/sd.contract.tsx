import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import {
  fetchContractApprovals,
  type ContractRow,
} from "@/lib/sd/contract-approval.functions";

type Status = "pending" | "accepted" | "rejected";

export const Route = createFileRoute("/_authenticated/sd/contract")({
  component: ContractPage,
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

function ContractPage() {
  const fetchFn = useServerFn(fetchContractApprovals);

  const [plant, setPlant] = useState("");
  const [userId, setUserId] = useState("");
  const [customerFrom, setCustomerFrom] = useState("");
  const [customerTo, setCustomerTo] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: {
      plant: string;
      user_id: string;
      customer_from: string;
      customer_to: string;
      status: Status;
    }) => fetchFn({ data: vars }),
    onSuccess: (res) => {
      setRows(res.rows);
      setLastFetchedAt(res.fetched_at);
      if (res.error) toast.error(res.error);
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  function execute() {
    const p = plant.trim();
    if (!p) return toast.error("Plant is required");
    mutation.mutate({
      plant: p,
      user_id: userId.trim(),
      customer_from: customerFrom.trim(),
      customer_to: customerTo.trim() || customerFrom.trim(),
      status,
    });
  }

  function reset() {
    setPlant("");
    setUserId("");
    setCustomerFrom("");
    setCustomerTo("");
    setStatus("pending");
    setRows([]);
    setLastFetchedAt(null);
  }

  const canExecute = !!plant.trim() && !mutation.isPending;


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Contract Approvals</h1>
          <p className="text-sm text-muted-foreground">
            BMW contract approvals fetched live from SAP via Contract_Approval_Fetch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">ZBMW_CONTRACT_APP</Badge>
          <Badge variant="secondary" className="text-xs">2 levels</Badge>
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
              placeholder="optional"
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

        <div className="mt-4 -mx-4 px-4 pt-3 border-t">
          <div className="flex items-center gap-6 flex-wrap">
            <Label className="text-xs text-muted-foreground">
              Status <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as Status)}
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

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30 flex-wrap">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Output — {status}
          </div>
          <div className="text-xs text-muted-foreground">
            {rows.length} record{rows.length === 1 ? "" : "s"}
            {lastFetchedAt ? ` · fetched ${new Date(lastFetchedAt).toLocaleTimeString()}` : ""}
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b sticky top-0 z-10">

              <tr>
                <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Customer</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Customer Name</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Contract No</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Item</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Con. Creation</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Material</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Qty</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Net Value</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Tax Value</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Total</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Agr. From</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Agr. To</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Svc Valid From</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Svc Valid To</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Sales Org</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Co. Code</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Reason</th>
              </tr>
            </thead>
            <tbody>
              {mutation.isPending ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Fetching from SAP…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-muted-foreground">
                    Enter Plant and click Execute to load contracts from SAP.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.customer ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.customer_name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.contract_no ?? "—"}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.contract_item ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.con_creation_date)}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.material ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.qty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.net_value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.tax_value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(r.total)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.agreement_from)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.agreement_to)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.service_valid_from)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.service_valid_to)}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.sales_org ?? "—"}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.company_code ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.reason ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
