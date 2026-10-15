import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/exec/page-header";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import {
  getTransportBillingConfig,
  getTransportCustConfig,
  getTransportCustNameConfig,
} from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";

export const Route = createFileRoute("/_authenticated/imw/transportation-exception-billing")({
  head: () => ({
    meta: [
      { title: "Transportation (90%) Exception Billing — IWM Approvals" },
      {
        name: "description",
        content: "Review transportation 90% exception billing records by customer.",
      },
      { property: "og:title", content: "Transportation (90%) Exception Billing — IWM Approvals" },
      {
        property: "og:description",
        content: "Review transportation 90% exception billing records by customer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransportationExceptionBillingPage,
});

type Row = Record<string, unknown> & { __transportRowKey: string };

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  const candidates = [data.DATA, (data.data as Record<string, unknown> | undefined)?.DATA, data.data, data.ITEMS, data.items, data.RESULTS, data.results, data.get_data];
  const rows = candidates.find(Array.isArray);
  if (Array.isArray(rows)) {
    return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
    }
  }
  return [];
}

function TransportationExceptionBillingPage() {
  const [customer, setCustomer] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [plants, setPlants] = useState<string[]>([]);
  const [executed, setExecuted] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const getBillingCfg = useServerFn(getTransportBillingConfig);
  const getCustCfg = useServerFn(getTransportCustConfig);
  const getCustNameCfg = useServerFn(getTransportCustNameConfig);
  const runApi = useServerFn(runSapApi);

  const billingCfgQuery = useQuery({
    queryKey: ["transport-billing-config"],
    queryFn: () => getBillingCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const custCfgQuery = useQuery({
    queryKey: ["transport-cust-config"],
    queryFn: () => getCustCfg(),
    staleTime: 10 * 60 * 1000,
  });
  const custNameCfgQuery = useQuery({
    queryKey: ["transport-custname-config"],
    queryFn: () => getCustNameCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const fetchMutation = useMutation({
    mutationFn: async (input: { configId: string; plantValues: string[] }) =>
      runApi({
        data: {
          configId: input.configId,
          inputs: {
            get_data: {
              plant: input.plantValues.map((plant) => ({ plant })),
            },
          },
        },
      }),
    onSuccess: (response) => {
      if (response?.ok === false) {
        setRows([]);
        toast.error(response.error || "Could not load exception billing records.");
        return;
      }
      const fetched = extractRows(response?.data ?? response).map((row, index) => ({
        ...row,
        __transportRowKey: String(index),
      }));
      setRows(fetched);
      if (fetched.length === 0) toast.info("No records returned for the selected plant.");
    },
    onError: (error) => {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Could not load exception billing records.");
    },
  });

  const columns = useMemo<CloudscapeColumn<Row>[]>(() => {
    const fields = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "MANDT" && key !== "__transportRowKey"))),
    );
    return fields.map((field) => ({
      id: field,
      header: field === "REMARK" ? "Remarks" : field,
      minWidth: field === "REMARK" ? 200 : 120,
      cell: (row) => {
        if (field === "CHK_VALUE") {
          return (
            <Checkbox
              aria-label={`Checked for row ${row.__transportRowKey}`}
              checked={String(row.CHK_VALUE ?? "").trim().toUpperCase() === "X"}
              onCheckedChange={(checked) =>
                setRows((current) =>
                  current.map((item) =>
                    item.__transportRowKey === row.__transportRowKey
                      ? { ...item, CHK_VALUE: checked === true ? "X" : "" }
                      : item,
                  ),
                )
              }
            />
          );
        }
        if (field === "REMARK") {
          return (
            <Input
              value={String(row.REMARK ?? "")}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.__transportRowKey === row.__transportRowKey
                      ? { ...item, REMARK: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="Remarks"
              className="h-8 min-w-[180px] text-xs"
            />
          );
        }
        const value = row[field];
        return value === null || value === undefined || value === "" ? "—" : String(value);
      },
    }));
  }, [rows]);

  function execute() {
    const configId = billingCfgQuery.data?.configId;
    if (!configId) {
      toast.error("SAP API config 90%_Get_API is not configured or active.");
      return;
    }
    setExecuted(true);
    setRows([]);
    fetchMutation.mutate({ configId, plantValues: plants.length > 0 ? plants : [""] });
  }

  function reset() {
    setCustomer("");
    setCustomerName("");
    setPlants([]);
    setRows([]);
    setExecuted(false);
    fetchMutation.reset();
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Transportation (90%) Exception Billing"
        subtitle="Review transportation 90% exception billing records for the selected plant."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[minmax(160px,1fr)_minmax(180px,1fr)_minmax(200px,1.2fr)_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Plant</Label>
            <PlantMultiSelect value={plants} onChange={setPlants} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <CustomerSelect
              value={customer}
              onChange={setCustomer}
              onEnter={() => execute()}
              configId={custCfgQuery.data?.configId ?? null}
              inputs={{ kunnr: "" }}
              codeField="KUNNR"
              textField="KUNNR"
              placeholder="Select customer…"
              disabled={custCfgQuery.isLoading || fetchMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Customer Name</Label>
            <CustomerSelect
              value={customerName}
              onChange={setCustomerName}
              onEnter={() => execute()}
              configId={custNameCfgQuery.data?.configId ?? null}
              inputs={{ name1: "" }}
              codeField="NAME1"
              textField="NAME1"
              placeholder="Select customer name…"
              disabled={custNameCfgQuery.isLoading || fetchMutation.isPending}
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={billingCfgQuery.isLoading || fetchMutation.isPending}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={fetchMutation.isPending}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable
          title="Transportation (90%) Exception Billing"
          countLabel={fetchMutation.isPending ? "Loading…" : `(${rows.length})`}
          rows={rows}
          loading={fetchMutation.isPending}
          rowKey={(row) => row.__transportRowKey}
          emptyMessage="No exception billing records were returned."
          columns={columns}
        />
      )}
    </div>
  );
}
