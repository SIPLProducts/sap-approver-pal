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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  fetchScSoApprovals,
  type ScSoRow,
} from "@/lib/sd/sc-so-approval.functions";

export const Route = createFileRoute("/_authenticated/sd/sc-so-reports")({
  head: () => ({
    meta: [
      { title: "Service Certificate & SO Approval Reports" },
      { name: "description", content: "Read-only report of SAP service certificate & SO approval records." },
    ],
  }),
  component: ScSoReportsPage,
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
  return [r.company_code, r.contract_no, r.contract_item, r.customer, i].map((x) => x ?? "").join("|");
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

function ScSoReportsPage() {
  const navigate = useNavigate();
  const fetchFn = useServerFn(fetchScSoApprovals);

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
  const [approvalType, setApprovalType] = useState<"service" | "sales">("service");
  const [rows, setRows] = useState<ScSoRow[]>([]);

  const mutation = useMutation({
    mutationFn: async (vars: {
      plants: string[];
      user_id: string;
      customer_from: string;
      customer_to: string;
      approval_type: "service" | "sales";
    }) => {
      const v: any = await fetchFn({ data: { ...vars, status: "pending" } });
      const rows = Array.isArray(v?.rows) ? (v.rows as ScSoRow[]) : [];
      return { rows, count: rows.length, error: v?.error ?? null };
    },
    onSuccess: (res: any) => {
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
      approval_type: approvalType,
    });
  }

  function reset() {
    setPlants([]);
    setUserId("");
    setCustomerFrom("");
    setApprovalType("service");
    setRows([]);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: "/sd/sc-so" })} aria-label="Back to Service Certificate & SO Approvals">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Service Certificate & SO Approval Reports</h1>
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
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && execute()} placeholder="e.g. NEOBMWCONS1" className="h-9 font-mono" />
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

        <div className="mt-4 -mx-4 px-4 pt-3 border-t">
          <div className="flex items-center gap-6 flex-wrap">
            <Label className="text-xs text-muted-foreground min-w-[100px]">Approval Type</Label>
            <RadioGroup
              value={approvalType}
              onValueChange={(v) => setApprovalType(v as "service" | "sales")}
              className="flex items-center gap-5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="service" id="scso-rpt-t-service" />
                Service Certificate Approvals
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="sales" id="scso-rpt-t-sales" />
                Sales Order Approvals
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      <CloudscapeApprovalTable
        title="Service Cert & SO Approval Reports"
        countLabel={`(${rows.length})`}
        rows={rows}
        rowKey={rowKey}
        loading={mutation.isPending}
        emptyMessage={rows.length === 0 ? "Enter Plant and click Execute." : "No records."}
        columns={buildDynamicColumns(rows)}
      />
    </div>
  );
}
