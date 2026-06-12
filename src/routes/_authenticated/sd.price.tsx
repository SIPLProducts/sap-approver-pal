import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Check, X, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchPriceApprovals,
  getMySapUserId,
  submitPriceDecision,
  type PriceRow,
} from "@/lib/sd/price-approval.functions";

type Status = "pending" | "accepted" | "rejected";

const searchSchema = z.object({
  status: fallback(z.enum(["pending", "accepted", "rejected"]), "pending").default("pending"),
});

export const Route = createFileRoute("/_authenticated/sd/price")({
  validateSearch: zodValidator(searchSchema),
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
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: "/_authenticated/sd/price" });

  const fetchFn = useServerFn(fetchPriceApprovals);
  const userIdFn = useServerFn(getMySapUserId);
  const decisionFn = useServerFn(submitPriceDecision);

  const { data: userIdData } = useQuery({
    queryKey: ["sd-price", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const [plant, setPlant] = useState("");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [decided, setDecided] = useState<Record<string, "accepted" | "rejected">>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (p: string) => fetchFn({ data: { plant: p } }),
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


  function setStatus(s: Status) {
    navigate({ search: (prev: any) => ({ ...prev, status: s }) });
  }

  function execute() {
    const p = plant.trim();
    if (!p) {
      toast.error("Plant is required");
      return;
    }
    mutation.mutate(p);
  }

  function reset() {
    setPlant("");
    setRows([]);
    setDecided({});
    setSelected(new Set());
    setLastFetchedAt(null);
    setStatus("pending");
  }

  // Group rows by current bucket
  const indexed = useMemo(() => rows.map((r, i) => ({ r, k: rowKey(r, i) })), [rows]);
  const visible = useMemo(
    () => indexed.filter(({ k }) => (decided[k] ?? "pending") === status),
    [indexed, decided, status],
  );

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, rejected: 0 } as Record<Status, number>;
    for (const { k } of indexed) c[decided[k] ?? "pending"]++;
    return c;
  }, [indexed, decided]);

  const allChecked = visible.length > 0 && visible.every(({ k }) => selected.has(k));
  const someChecked = visible.some(({ k }) => selected.has(k)) && !allChecked;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) visible.forEach(({ k }) => next.delete(k));
      else visible.forEach(({ k }) => next.add(k));
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
    mutationFn: (vars: { action: "accepted" | "rejected"; rows: PriceRow[] }) => {
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
      toast.success(`${vars.rows.length} record${vars.rows.length === 1 ? "" : "s"} ${vars.action} in SAP`);
      setStatus(vars.action);
    },
    onError: (e: Error) => {
      console.error("[price-decision] failed", e);
      toast.error(e.message ?? "SAP submission failed");
    },
  });

  function decide(action: "accepted" | "rejected") {
    if (status !== "pending" || selected.size === 0 || decisionMutation.isPending) return;
    const selectedRows = indexed.filter(({ k }) => selected.has(k)).map(({ r }) => r);
    decisionMutation.mutate({ action, rows: selectedRows });
  }


  const canAct = status === "pending" && selected.size > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Price Approvals</h1>
          <p className="text-sm text-muted-foreground">
            BMW VK11 condition approvals fetched live from SAP via Price_Approval_Fetch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">ZBMW_VK11_APP</Badge>
          <Badge variant="secondary" className="text-xs">Single level</Badge>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-[200px_220px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <Input
              value={plant}
              onChange={(e) => setPlant(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") execute();
              }}
              placeholder="e.g. 3806"
              className="h-9 font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">USER_ID</Label>
            <Input value={userIdData?.sap_user_id ?? ""} readOnly className="h-9 font-mono bg-muted/40" />
          </div>
          <div />
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={!plant.trim() || mutation.isPending}>
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

        <div className="mt-4 -mx-4 px-4 pt-3 border-t">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label className="text-xs text-muted-foreground">Action</Label>
            <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
              <TabsList>
                <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
                <TabsTrigger value="accepted">Accepted ({counts.accepted})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Output — {status}
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
              title={status !== "pending" ? "Switch to Pending tab and select rows" : selected.size === 0 ? "Select at least one row" : undefined}
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
            <thead className="bg-muted/50 border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 w-10">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    disabled={visible.length === 0}
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
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-muted-foreground">
                    {rows.length === 0
                      ? "Enter a Plant and click Execute to load price approvals from SAP."
                      : `No ${status} records.`}
                  </td>
                </tr>
              ) : (
                visible.map(({ r, k }, i) => {
                  const isSel = selected.has(k);
                  return (
                    <tr
                      key={k}
                      className={`border-b last:border-0 hover:bg-accent/40 ${isSel ? "bg-accent/30" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(k)}
                          aria-label="Select row"
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
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
      </Card>
    </div>
  );
}
