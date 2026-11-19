import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/exec/page-header";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useActiveContext } from "@/hooks/use-active-context";
import { Checkbox } from "@/components/ui/checkbox";
import { getTransportApprovalsGetConfig } from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import { extractSapMessage } from "@/lib/mm/sap-message";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";

type Row = Record<string, unknown> & { __rowKey: string };

const RESPONSE_FIELDS = ["WERKS", "KUNNR", "NAME1", "CHK_VALUE", "REMARK", "APPROV_BY", "UPDATE_BY", "STATUS"];

const HEADER_LABELS: Record<string, string> = {
  WERKS: "Plant",
  KUNNR: "Customer",
  NAME1: "Customer Name",
  CHK_VALUE: "Check Value",
  REMARK: "Remarks",
  APPROV_BY: "Approved By",
  UPDATE_BY: "Update By",
  STATUS: "Status",
};

function extractRows(payload: unknown): Record<string, unknown>[] {
  const isObj = (r: unknown): r is Record<string, unknown> => !!r && typeof r === "object";
  if (Array.isArray(payload)) return payload.filter(isObj);
  if (!isObj(payload)) return [];
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value.filter(isObj);
  }
  return [];
}

type Status = "pending" | "completed" | "rejected";

export const Route = createFileRoute("/_authenticated/imw/transportation-exception-billing-approvals")({
  head: () => ({
    meta: [
      { title: "Transportation (90%) Exception Billing Approvals — IWM Approvals" },
      {
        name: "description",
        content: "Review transportation 90% exception billing approvals by plant and status.",
      },
      {
        property: "og:title",
        content: "Transportation (90%) Exception Billing Approvals — IWM Approvals",
      },
      {
        property: "og:description",
        content: "Review transportation 90% exception billing approvals by plant and status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransportationExceptionBillingApprovalsPage,
});

function TransportationExceptionBillingApprovalsPage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [status, setStatus] = useState<Status>("pending");

  const [executed, setExecuted] = useState(false);
  const [executedStatus, setExecutedStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const getCfg = useServerFn(getTransportApprovalsGetConfig);
  const runApi = useServerFn(runSapApi);

  const fetchMutation = useMutation({
    mutationFn: async (input: { plants: string[]; status: Status }) => {
      const cfg = await getCfg();
      if (!cfg.configId) throw new Error("SAP API config 90%_Approvals_Get_Data is not configured or active.");
      return runApi({
        data: {
          configId: cfg.configId,
          inputs: {
            get_data: {
              user_name: cfg.userName,
              plant: input.plants.map((plant) => ({ plant })),
              R_pen: input.status === "pending" ? "X" : " ",
              R_APPR: input.status === "completed" ? "X" : " ",
              R_REJ: input.status === "rejected" ? "X" : " ",
            },
          },
        },
      });
    },
    onSuccess: (response: any) => {
      setSelectedKeys(new Set());
      if (response?.ok === false) {
        setRows([]);
        toast.error(response.error || extractSapMessage(response) || "Could not load records.");
        return;
      }
      const fetched = extractRows(response?.data ?? response)
        .filter((r) => r.WERKS !== undefined || r.KUNNR !== undefined)
        .map((row, index) => ({ ...row, __rowKey: String(index) }));
      setRows(fetched);
      if (fetched.length === 0) {
        const msg = extractSapMessage(response);
        toast.info(msg || "No records returned for the selected plant.");
      }
    },
    onError: (error) => {
      setRows([]);
      setSelectedKeys(new Set());
      toast.error(error instanceof Error ? error.message : "Could not load records.");
    },
  });

  const columns = useMemo<CloudscapeColumn<Row>[]>(
    () =>
      RESPONSE_FIELDS.map((field) => ({
        id: field,
        header: HEADER_LABELS[field] ?? field,
        minWidth: field === "NAME1" || field === "REMARK" ? 200 : 120,
        cell: (row: Row) => {
          if (field === "CHK_VALUE") {
            return (
              <Checkbox
                aria-label={`CHK_VALUE row ${row.__rowKey}`}
                checked={String(row.CHK_VALUE ?? "").trim().toUpperCase() === "X"}
                disabled
              />
            );
          }
          const v = row[field];
          return v === null || v === undefined || String(v).trim() === "" ? "—" : String(v);
        },
      })),
    [],
  );

  function onApproveReject() {
    if (selectedKeys.size === 0) {
      toast.error("Select at least one record");
      return;
    }
    toast.info("Approve/Reject will be connected once the SAP API is set up.");
  }

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    setExecuted(true);
    setExecutedStatus(status);
    setRows([]);
    setSelectedKeys(new Set());
    fetchMutation.mutate({ plants, status });
  }

  useEffect(() => {
    setPlants((current) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = current.filter((plant) => allowed.has(plant));
      return kept.length > 0 ? kept : activePlants;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  function reset() {
    setPlants([]);
    setStatus("pending");
    setRows([]);
    setSelectedKeys(new Set());
    setExecuted(false);
    setExecutedStatus(null);
    fetchMutation.reset();
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Transportation (90%) Exception Billing Approvals"
        subtitle="Review transportation exception billing approval records by plant and status."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[220px_1fr]">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} source="iwm-plant" />
          </div>

          <div className="flex justify-self-end gap-2">
            <Button size="sm" onClick={execute} disabled={plants.length === 0 || fetchMutation.isPending}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={fetchMutation.isPending}>
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
              onValueChange={(value) => setStatus(value as Status)}
              className="flex items-center gap-5"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="pending" id="transport-approval-pending" />
                Pending
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="completed" id="transport-approval-completed" />
                Completed
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="rejected" id="transport-approval-rejected" />
                Rejected
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable
          title="Transportation (90%) Exception Billing Approvals"
          countLabel={fetchMutation.isPending ? "Loading…" : `(${rows.length})`}
          rows={rows}
          loading={fetchMutation.isPending}
          rowKey={(row) => row.__rowKey}
          showSelect
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          emptyMessage="No records"
          headerExtras={
            executedStatus === "pending" && rows.length > 0 ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={selectedKeys.size === 0}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  onClick={onApproveReject}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selectedKeys.size === 0}
                  onClick={onApproveReject}
                >
                  Reject
                </Button>
              </div>
            ) : undefined
          }
          columns={columns}
        />
      )}
    </div>
  );
}