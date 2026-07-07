import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2, ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  fetchContractApprovals,
  type ContractRow,
} from "@/lib/sd/contract-approval.functions";

type Status = "pending" | "accepted" | "rejected";

export const Route = createFileRoute("/_authenticated/sd/contract-reports")({
  head: () => ({
    meta: [
      { title: "Contract Approval Reports" },
      { name: "description", content: "Read-only report of SAP contract approval records." },
    ],
  }),
  component: ContractReportsPage,
});

function rowKey(r: ContractRow, i: number) {
  return [r.contract_no, r.contract_item, r.customer, r.material, i].map((x) => x ?? "").join("|");
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

function ContractReportsPage() {
  const navigate = useNavigate();
  const fetchFn = useServerFn(fetchContractApprovals);

  const { activePlants: __aps } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(__aps);
  useEffect(() => {
    setPlants((prev) => {
      if (__aps.length === 0) return [];
      const allowed = new Set(__aps);
      const kept = prev.filter((c) => allowed.has(c));
      return kept.length === 0 ? __aps : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [__aps.join(",")]);
  const [userId, setUserId] = useState("");
  const [customerFrom, setCustomerFrom] = useState("");
  const status: Status = "pending";
  const [rows, setRows] = useState<ContractRow[]>([]);

  const mutation = useMutation({
    mutationFn: async (vars: {
      plants: string[];
      user_id: string;
      customer_from: string;
      customer_to: string;
      status: Status;
    }) => {
      const v: any = await fetchFn({ data: vars });
      const rows = Array.isArray(v?.rows) ? (v.rows as ContractRow[]) : [];
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
    if (plants.length === 0) return toast.error("Select at least one plant");
    mutation.mutate({
      plants,
      user_id: userId.trim(),
      customer_from: customerFrom.trim(),
      customer_to: customerFrom.trim(),
      status,
    });
  }

  function reset() {
    setPlants([]);
    setUserId("");
    setCustomerFrom("");
    setStatus("pending");
    setRows([]);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: "/sd/contract" })} aria-label="Back to Contract Approvals">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Contract Approval Reports</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Plant <span className="text-destructive">*</span></Label>
            <PlantMultiSelect value={plants} onChange={setPlants} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">User ID</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && execute()} placeholder="optional" className="h-9 font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <CustomerSelect value={customerFrom} onChange={setCustomerFrom} plants={plants} onEnter={execute} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={plants.length === 0 || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
          </div>
        </div>
      </Card>

      <CloudscapeApprovalTable
        title={`Contract Approval Reports — ${status}`}
        countLabel={`(${rows.length})`}
        rows={rows}
        rowKey={rowKey}
        loading={mutation.isPending}
        emptyMessage={rows.length === 0 ? "Enter Plant and click Execute to load contract approval reports from SAP." : "No records."}
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
    </div>
  );
}
