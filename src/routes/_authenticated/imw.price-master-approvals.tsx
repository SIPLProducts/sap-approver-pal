import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Filter, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/exec/page-header";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import {
  SapResponseDialog,
  type SapResponseDialogState,
} from "@/components/mm/sap-response-dialog";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  approvePriceMasterApprovals,
  fetchPriceMasterApprovals,
  type PriceMasterApprovalRow,
} from "@/lib/imw/price-master-approvals.functions";
import { formatAmount, formatSapDateDMY } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imw/price-master-approvals")({
  head: () => ({
    meta: [
      { title: "Price Master Update Approvals — IWM Approvals" },
      {
        name: "description",
        content:
          "Review pending, approved and rejected price master update requests by plant, customer and date range.",
      },
      { property: "og:title", content: "Price Master Update Approvals — IWM Approvals" },
      {
        property: "og:description",
        content:
          "Review pending, approved and rejected price master update requests by plant, customer and date range.",
      },
    ],
  }),
  component: PriceMasterApprovalsPage,
});

type Status = "pending" | "approved" | "rejected";
type Row = PriceMasterApprovalRow;

/** SAP key → business label, in display order. */
const COLUMN_DEFS: { key: string; label: string; kind: "text" | "amount" | "date" }[] = [
  { key: "WERKS", label: "Plant", kind: "text" },
  { key: "KUNNR", label: "Customer ID", kind: "text" },
  { key: "ZCUST_NAME", label: "Customer Name", kind: "text" },
  { key: "WST_TYPE", label: "Waste Type", kind: "text" },
  { key: "MATNR", label: "Material Number", kind: "text" },
  { key: "PRICE", label: "Price", kind: "amount" },
  { key: "ZCHECK", label: "Default", kind: "text" },
  { key: "ESCRO", label: "Escrow Chg", kind: "text" },
  { key: "TRIP", label: "Trip Chg", kind: "text" },
  { key: "ZDEACTIVE", label: "Deactive", kind: "text" },
  { key: "ZKGS", label: "Kgs", kind: "text" },
  { key: "LUMSUMM", label: "Lumsum", kind: "text" },
  { key: "INCLUSIVE", label: "Inclusive", kind: "text" },
  { key: "MF_QTY", label: "Manifest Qty", kind: "text" },
  { key: "MF_VALID_FROM", label: "Manifest From Date", kind: "date" },
  { key: "MF_VALID_TO", label: "Manifest To Date", kind: "date" },
  { key: "PRICE_WB02", label: "ZWB02 Price", kind: "amount" },
  { key: "TRIP_PRICE", label: "Trip Price", kind: "amount" },
  { key: "VALID_FROM", label: "Valid From", kind: "date" },
  { key: "VALID_TO", label: "Valid To", kind: "date" },
  { key: "ZZ_CA_DATE", label: "CA Date", kind: "date" },
  { key: "PRUEFLOS", label: "CA Number", kind: "text" },
  { key: "SPE_HANDLING", label: "Spc Handling Chg", kind: "amount" },
  { key: "EQP_HIRE", label: "Eqp Hire Chg", kind: "amount" },
  { key: "UNLOADING_LOAD", label: "Un / Ln Chg", kind: "amount" },
  { key: "OTHERS", label: "Others Chg", kind: "amount" },
  { key: "TON1", label: "1 Ton", kind: "amount" },
  { key: "TON5", label: "5 Ton", kind: "amount" },
  { key: "TON8", label: "8 Ton", kind: "amount" },
  { key: "TON10", label: "10 Ton", kind: "amount" },
  { key: "TON12", label: "12 Ton", kind: "amount" },
  { key: "TON15", label: "15 Ton", kind: "amount" },
  { key: "TON18", label: "18 Ton", kind: "amount" },
  { key: "TON20", label: "20 Ton", kind: "amount" },
  { key: "TON25", label: "25 Ton", kind: "amount" },
  { key: "TON30", label: "30 Ton", kind: "amount" },
  { key: "TON35", label: "35 Ton", kind: "amount" },
  { key: "USER_ID1", label: "Requester Id", kind: "text" },
  { key: "USER_ID2", label: "Requester user Name", kind: "text" },
  { key: "UPDATE2", label: "Requester date", kind: "date" },
  { key: "UPTIME", label: "Requester Time", kind: "text" },
  { key: "APP_DATE", label: "Approver Date", kind: "date" },
  { key: "APP_TIME", label: "Approver Time", kind: "text" },
  { key: "USER_ID_APP", label: "Approver by", kind: "text" },
  { key: "PRICE_REMARKS", label: "Price Remarks", kind: "text" },
];

const ZERO_DATES = new Set(["00000000", "0000-00-00", "0000000000", ""]);

function renderCell(row: Row, def: (typeof COLUMN_DEFS)[number]) {
  const v = row?.[def.key];
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const s = String(v).trim();
  if (def.kind === "date") return ZERO_DATES.has(s) ? "—" : formatSapDateDMY(s, "—");
  if (def.kind === "amount") return formatAmount(s, s);
  return s;
}

function PriceMasterApprovalsPage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [customer, setCustomer] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sapDialog, setSapDialog] = useState<SapResponseDialogState | null>(null);

  const runFetch = useServerFn(fetchPriceMasterApprovals);

  const mutation = useMutation({
    mutationFn: (vars: {
      plants: string[];
      customer?: string;
      date_from?: string;
      date_to?: string;
      status: Status;
    }) => runFetch({ data: vars }),
    onSuccess: (res) => {
      setSelected(new Set());
      setRows(res.rows ?? []);
      const msg = res.error || res.sapMessage;
      if (msg) {
        setSapDialog({
          open: true,
          title: "SAP Response",
          refLabel: "Message",
          results: [{ ref: "Price Master Approvals", message: msg, ok: false }],
        });
      }
    },
    onError: (e: Error) => {
      setRows([]);
      setSelected(new Set());
      toast.error(e.message || "Could not load approval records");
    },
  });

  useEffect(() => {
    setPlants((prev) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = prev.filter((c) => allowed.has(c));
      return kept.length === 0 ? activePlants : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  const columns = useMemo<CloudscapeColumn<Row>[]>(
    () =>
      COLUMN_DEFS.map((def) => ({
        id: def.key,
        header: def.label,
        align: def.kind === "amount" ? ("right" as const) : undefined,
        cell: (r: Row) => renderCell(r, def),
      })),
    [],
  );

  function clearResults() {
    setRows([]);
    setSelected(new Set());
  }

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    mutation.mutate({
      plants,
      customer: customer.trim() || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      status,
    });
  }

  function reset() {
    setPlants(activePlants);
    setCustomer("");
    setDateFrom("");
    setDateTo("");
    setStatus("pending");
    clearResults();
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Price Master Update Approvals"
        subtitle="Review price master update requests routed from SAP for the selected plant, customer and date range."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect
              value={plants}
              onChange={(v) => {
                setPlants(v);
                clearResults();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <CustomerSelect
              value={customer}
              onChange={(v) => {
                setCustomer(v);
                clearResults();
              }}
              plants={plants}
              onEnter={execute}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                clearResults();
              }}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                clearResults();
              }}
              className="h-9"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={execute}
              disabled={plants.length === 0 || mutation.isPending}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {mutation.isPending ? "Loading…" : "Execute"}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-4 -mx-4 border-t px-4 pt-3">
          <div className="flex flex-wrap items-center gap-6">
            <Label className="text-xs text-muted-foreground">
              Status <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => {
                setStatus(v as Status);
                clearResults();
              }}
              className="flex items-center gap-5"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="pending" id="pma-pending" />
                Pending
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="approved" id="pma-approved" />
                Approved
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="rejected" id="pma-rejected" />
                Rejected
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      <CloudscapeApprovalTable
        title={`Price Master Update Approvals — ${status}`}
        countLabel={`(${rows.length})`}
        rows={rows}
        loading={mutation.isPending}
        showSelect
        selectedKeys={selected}
        onSelectionChange={setSelected}
        rowKey={(_r: Row, i: number) => String(i)}
        emptyMessage="Select a Plant and click Execute to load approval records from SAP."
        columns={columns}
        headerExtras={
          status === "pending" && rows.length > 0 ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={selected.size === 0}
                className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={() =>
                  toast.info("Approve will be enabled once the SAP approval API is configured.")
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={selected.size === 0}
                onClick={() =>
                  toast.info("Reject will be enabled once the SAP approval API is configured.")
                }
              >
                Reject
              </Button>
            </div>
          ) : undefined
        }
      />

      <SapResponseDialog
        dialog={sapDialog}
        onOpenChange={(open) => {
          if (!open) setSapDialog(null);
        }}
      />
    </div>
  );
}
