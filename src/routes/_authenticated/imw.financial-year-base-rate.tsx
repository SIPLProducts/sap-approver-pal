import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Filter, RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/exec/page-header";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerSelect } from "@/components/sap/customer-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  getFinanceSaveConfig,
  getTransportPlantCustConfig,
  getTransportCustBasedNameConfig,
} from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";

export const Route = createFileRoute("/_authenticated/imw/financial-year-base-rate")({
  head: () => ({
    meta: [
      { title: "Financial Year Base Rate — IWM Approvals" },
      {
        name: "description",
        content: "View financial year base rate information for a selected IWM plant.",
      },
      { property: "og:title", content: "Financial Year Base Rate — IWM Approvals" },
      {
        property: "og:description",
        content: "View financial year base rate information for a selected IWM plant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancialYearBaseRatePage,
});

type Row = Record<string, unknown> & { __finRowKey: string };

function extractRows(payload: unknown): Record<string, unknown>[] {
  const isObj = (r: unknown): r is Record<string, unknown> => !!r && typeof r === "object";
  if (Array.isArray(payload)) return payload.filter(isObj);
  if (!isObj(payload)) return [];
  const data = payload;
  const candidates = [data.DATA, (data.data as Record<string, unknown> | undefined)?.DATA, data.data, data.get_data];
  const rows = candidates.find(Array.isArray);
  if (Array.isArray(rows)) return rows.filter(isObj);
  for (const value of Object.values(data)) if (Array.isArray(value)) return value.filter(isObj);
  return [];
}

function FinancialYearBaseRatePage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);

  useEffect(() => {
    setPlants((current) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = current.filter((plant) => allowed.has(plant));
      return kept.length > 0 ? kept : activePlants;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  const [newRecord, setNewRecord] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [executedCheck, setExecutedCheck] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set());

  const getFinanceCfg = useServerFn(getFinanceSaveConfig);
  const getPlantCustCfg = useServerFn(getTransportPlantCustConfig);
  const getCustBasedNameCfg = useServerFn(getTransportCustBasedNameConfig);
  const runApi = useServerFn(runSapApi);

  const financeCfgQuery = useQuery({
    queryKey: ["finance-save-config"],
    queryFn: () => getFinanceCfg(),
    staleTime: 10 * 60 * 1000,
  });
  const plantCustCfgQuery = useQuery({
    queryKey: ["transport-plant-cust-config"],
    queryFn: () => getPlantCustCfg(),
    staleTime: 10 * 60 * 1000,
  });
  const custBasedNameCfgQuery = useQuery({
    queryKey: ["transport-cust-based-name-config"],
    queryFn: () => getCustBasedNameCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const fetchMutation = useMutation({
    mutationFn: async (input: { configId: string; userName: string; plantValues: string[]; check: string }) =>
      runApi({
        data: {
          configId: input.configId,
          inputs: {
            get_data: {
              user_name: input.userName,
              plant: input.plantValues.map((plant) => ({ plant })),
              check: input.check,
            },
          },
        },
      }),
    onSuccess: (response) => {
      if (response?.ok === false) {
        setRows([]);
        setSelectedRowKeys(new Set());
        toast.error(response.error || "Could not load financial year base rate records.");
        return;
      }
      const fetched = extractRows(response?.data ?? response).map((row, index) => ({
        ...row,
        __finRowKey: String(index),
      }));
      setRows(fetched);
      setSelectedRowKeys(new Set());
      if (fetched.length === 0) toast.info("No records returned for the selected plant.");
    },
    onError: (error) => {
      setRows([]);
      setSelectedRowKeys(new Set());
      toast.error(error instanceof Error ? error.message : "Could not load financial year base rate records.");
    },
  });

  const columns = useMemo<CloudscapeColumn<Row>[]>(() => {
    const updateRow = (row: Row, field: string, value: unknown) =>
      setRows((current) =>
        current.map((item) => (item.__finRowKey === row.__finRowKey ? { ...item, [field]: value } : item)),
      );
    const show = (value: unknown) =>
      value === null || value === undefined || value === "" ? "—" : String(value);
    const text = (id: string, header: string, minWidth = 140): CloudscapeColumn<Row> => ({
      id,
      header,
      minWidth,
      cell: (row) => show(row[id]),
    });
    return [
      text("WERKS", "Plant", 120),
      {
        id: "KUNNR",
        header: "Customer",
        minWidth: 200,
        cell: (row) => (
          <CustomerSelect
            value={String(row.KUNNR ?? "")}
            onChange={(value) => updateRow(row, "KUNNR", value)}
            configId={plantCustCfgQuery.data?.configId ?? null}
            inputs={{ kunnr: [{ plant: String(row.WERKS ?? "") }] }}
            codeField="KUNNR"
            textField="KUNNR"
            placeholder="Select customer…"
          />
        ),
      },
      {
        id: "NAME1",
        header: "Customer Name",
        minWidth: 220,
        cell: (row) => (
          <CustomerSelect
            value={String(row.NAME1 ?? "")}
            onChange={(value) => updateRow(row, "NAME1", value)}
            configId={custBasedNameCfgQuery.data?.configId ?? null}
            inputs={{ CUST_NAM: String(row.KUNNR ?? "") }}
            codeField="NAME1"
            textField="NAME1"
            placeholder="Select customer name…"
          />
        ),
      },
      text("MATERIAL", "Material"),
      text("FIN_RATE", "Financial Base Rate"),
      text("UPDATED_BY", "Updated Person"),
      text("UPDATED_ON", "Updated Date"),
      text("APPROV_BY", "Approver"),
      text("STATUS", "Status", 120),
    ];
  }, [plantCustCfgQuery.data?.configId, custBasedNameCfgQuery.data?.configId]);

  const visibleColumns = useMemo(
    () =>
      executedCheck === "X"
        ? columns.filter((column) => !["UPDATED_BY", "UPDATED_ON", "APPROV_BY", "STATUS"].includes(column.id))
        : columns,
    [columns, executedCheck],
  );

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    const configId = financeCfgQuery.data?.configId;
    if (!configId) {
      toast.error("SAP API config Finance_Save_API is not configured or active.");
      return;
    }
    setExecuted(true);
    setExecutedCheck(newRecord ? "X" : "");
    setRows([]);
    setSelectedRowKeys(new Set());
    fetchMutation.mutate({
      configId,
      userName: financeCfgQuery.data?.userName ?? "",
      plantValues: plants,
      check: newRecord ? "X" : "",
    });
  }

  function save() {
    toast.info("Save will be connected once the SAP API details are provided.");
  }
  function change() {
    toast.info("Change will be connected once the SAP API details are provided.");
  }
  function remove() {
    toast.info("Delete will be connected once the SAP API details are provided.");
  }

  function reset() {
    setPlants([]);
    setNewRecord(false);
    setRows([]);
    setSelectedRowKeys(new Set());
    setExecuted(false);
    setExecutedCheck("");
    fetchMutation.reset();
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Financial Year Base Rate"
        subtitle="Review financial year base rate information for the selected plant."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[220px_auto_1fr]">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} source="iwm-plant" />
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Checkbox
              id="finance-new-record"
              checked={newRecord}
              onCheckedChange={(checked) => setNewRecord(checked === true)}
            />
            <Label htmlFor="finance-new-record" className="text-xs">
              New Record
            </Label>
          </div>

          <div className="flex justify-self-end gap-2">
            <Button size="sm" onClick={execute} disabled={plants.length === 0 || financeCfgQuery.isLoading || fetchMutation.isPending}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={fetchMutation.isPending}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable
          title="Financial Year Base Rate"
          countLabel={fetchMutation.isPending ? "Loading…" : `(${rows.length})`}
          rows={rows}
          loading={fetchMutation.isPending}
          rowKey={(row) => row.__finRowKey}
          showSelect
          selectedKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
          headerExtras={
            executedCheck === "X" ? (
              <Button size="sm" onClick={save} disabled={selectedRowKeys.size === 0}>
                Save
              </Button>
            ) : (
              <>
                <Button size="sm" variant="success" onClick={change} disabled={selectedRowKeys.size === 0}>
                  Change
                </Button>
                <Button size="sm" variant="destructive" onClick={remove} disabled={selectedRowKeys.size === 0}>
                  Delete
                </Button>
              </>
            )
          }
          emptyMessage="No financial year base rate records were returned for the selected plant."
          columns={visibleColumns}
        />
      )}
    </div>
  );
}