import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2, ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  fetchPriceApprovals,
  getMySapUserId,
  type PriceRow,
} from "@/lib/sd/price-approval.functions";

export const Route = createFileRoute("/_authenticated/sd/price-reports")({
  head: () => ({
    meta: [
      { title: "Price Approval Reports" },
      { name: "description", content: "Read-only report of SAP price approval records." },
    ],
  }),
  component: PriceReportsPage,
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
  const s = String(v);
  if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
  const d = new Date(s);
  if (!isNaN(+d)) return d.toLocaleDateString("en-GB").replaceAll("/", ".");
  return s;
}

function PriceReportsPage() {
  const navigate = useNavigate();
  const fetchFn = useServerFn(fetchPriceApprovals);
  const userIdFn = useServerFn(getMySapUserId);

  const { data: userIdData } = useQuery({
    queryKey: ["sd-price-reports", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<PriceRow[]>([]);

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

  const mutation = useMutation({
    mutationFn: async (vars: { plants: string[]; user_id: string }) => {
      const v: any = await fetchFn({
        data: { plants: vars.plants, user_id: vars.user_id || undefined },
      });
      const rows = Array.isArray(v?.rows) ? (v.rows as PriceRow[]) : [];
      return { rows, count: rows.length, error: v?.error ?? null };
    },
    onSuccess: (res) => {
      setRows(res.rows);
      if (res.error) toast.error(res.error);
      else toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
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
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Price Approval Reports</h1>
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

      <CloudscapeApprovalTable
        title="Price Approval Reports"
        countLabel={`(${rows.length})`}
        rows={rows}
        rowKey={rowKey}
        loading={mutation.isPending}
        emptyMessage={rows.length === 0 ? "Enter a Plant and click Execute to load price approval reports from SAP." : "No records."}
        columns={[
          { id: "key_combination", header: "Key Comb.", sortingField: "key_combination", cell: (r) => r.key_combination ?? "—" },
          { id: "condition_type", header: "Cond. Type", cell: (r) => r.condition_type ?? "—" },
          { id: "customer", header: "Customer", cell: (r) => r.customer ?? "—" },
          { id: "price_group", header: "Price Grp", cell: (r) => r.price_group ?? "—" },
          { id: "plant", header: "Plant", cell: (r) => r.plant ?? "—" },
          { id: "material", header: "Material", cell: (r) => r.material ?? "—" },
          { id: "new_price", header: "New Price", align: "right", cell: (r) => <strong>{fmtNum(r.new_price)}</strong> },
          { id: "currency", header: "Curr", cell: (r) => r.currency ?? "—" },
          { id: "uom", header: "UOM", cell: (r) => r.uom ?? "—" },
          { id: "valid_from_sc", header: "Valid From", cell: (r) => fmtDate(r.valid_from_sc) },
          { id: "valid_to_sc", header: "Valid To", cell: (r) => fmtDate(r.valid_to_sc) },
          { id: "old_price", header: "Old Price", align: "right", cell: (r) => fmtNum(r.old_price) },
          { id: "release_code1", header: "Release Code 1", cell: (r) => r.release_code1 ?? "—" },
          { id: "approval_status", header: "Approval Status", cell: (r) => r.approval_status ?? "—" },
        ] as CloudscapeColumn<PriceRow>[]}
      />
    </div>
  );
}
