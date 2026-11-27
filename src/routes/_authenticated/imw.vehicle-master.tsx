import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/exec/page-header";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveContext } from "@/hooks/use-active-context";
import { getVehicleMasterGetConfig } from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";

export const Route = createFileRoute("/_authenticated/imw/vehicle-master")({
  head: () => ({
    meta: [
      { title: "Vehicle Master — IWM Approvals" },
      {
        name: "description",
        content: "View vehicle master information for a selected IWM plant.",
      },
      { property: "og:title", content: "Vehicle Master — IWM Approvals" },
      {
        property: "og:description",
        content: "View vehicle master information for a selected IWM plant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VehicleMasterPage,
});

type Row = Record<string, unknown> & { __vmRowKey: string };

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

function VehicleMasterPage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [newRecord, setNewRecord] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [executedCheck, setExecutedCheck] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set());

  const getCfg = useServerFn(getVehicleMasterGetConfig);
  const runApi = useServerFn(runSapApi);
  const cfgQuery = useQuery({
    queryKey: ["vehicle-master-get-config"],
    queryFn: () => getCfg(),
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
        toast.error(response.error || "Could not load vehicle master records.");
        return;
      }
      const fetched = extractRows(response?.data ?? response).map((row, index) => ({
        ...row,
        __vmRowKey: String(index),
      }));
      setRows(fetched);
      setSelectedRowKeys(new Set());
      if (fetched.length === 0) toast.info("No records returned for the selected plant.");
    },
    onError: (error) => {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Could not load vehicle master records.");
    },
  });

  const columns = useMemo<CloudscapeColumn<Row>[]>(() => {
    const show = (value: unknown) =>
      value === null || value === undefined || String(value).trim() === "" ? "—" : String(value);
    const text = (id: string, header: string, minWidth = 140): CloudscapeColumn<Row> => ({
      id,
      header,
      minWidth,
      cell: (row) => show(row[id]),
    });
    const updateRow = (row: Row, field: string, value: unknown) =>
      setRows((current) =>
        current.map((item) => (item.__vmRowKey === row.__vmRowKey ? { ...item, [field]: value } : item)),
      );
    const isNew = executedCheck === "X";
    const editable = (id: string, header: string, minWidth: number, numeric = false, always = true): CloudscapeColumn<Row> => ({
      id,
      header,
      minWidth,
      cell: (row) =>
        !always && !isNew ? show(row[id]) : (
          <Input
            value={String(row[id] ?? "")}
            onChange={(event) => updateRow(row, id, event.target.value)}
            inputMode={numeric ? "decimal" : undefined}
            className="h-8 min-w-[120px] text-xs"
          />
        ),
    });
    return [
      isNew
        ? {
            id: "WERKS",
            header: "Plant",
            minWidth: 120,
            cell: (row) => (
              <PlantMultiSelect
                value={row.WERKS ? [String(row.WERKS)] : []}
                onChange={(v) => updateRow(row, "WERKS", v[v.length - 1] ?? "")}
                source="iwm-plant"
                placeholder="Select plant…"
              />
            ),
          }
        : text("WERKS", "Plant", 120),
      editable("VEHICLENO", "Vehicle Number", 160, false, false),
      editable("VEHICLECAP", "Material Qty - RTO-CAPACITY (in Tons)", 240, true),
      editable("NETWT", "Material Net Weight * 90%", 200, true),
      editable("VEH_CAP", "Vehicle Tonnage", 150, true),
      editable("VEH_TYPE", "Vehicle Type", 150),
      editable("TRANSPORT_NAME", "Transport Name", 200),
    ];
  }, [executedCheck]);

  const notConfigured = () => toast.info("SAP API not configured yet");

  useEffect(() => {
    setPlants((current) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = current.filter((plant) => allowed.has(plant));
      return kept.length > 0 ? kept : activePlants;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    const configId = cfgQuery.data?.configId;
    if (!configId) {
      toast.error("SAP API config VM_GET_API is not configured or active.");
      return;
    }
    setExecuted(true);
    setExecutedCheck(newRecord ? "X" : "");
    setRows([]);
    setSelectedRowKeys(new Set());
    fetchMutation.mutate({
      configId,
      userName: cfgQuery.data?.userName ?? "",
      plantValues: plants,
      check: newRecord ? "X" : " ",
    });
  }

  function reset() {
    setPlants([]);
    setNewRecord(false);
    setExecuted(false);
    setExecutedCheck("");
    setRows([]);
    setSelectedRowKeys(new Set());
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Vehicle Master"
        subtitle="View vehicle master information for the selected plant."
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
              id="vm-new-record"
              checked={newRecord}
              onCheckedChange={(checked) => setNewRecord(checked === true)}
            />
            <Label htmlFor="vm-new-record" className="text-xs">
              New Record
            </Label>
          </div>

          <div className="flex justify-self-end gap-2">
            <Button size="sm" onClick={execute} disabled={plants.length === 0 || cfgQuery.isLoading || fetchMutation.isPending}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable
          title="Vehicle Master"
          countLabel={fetchMutation.isPending ? "Loading…" : `(${rows.length})`}
          rows={rows}
          loading={fetchMutation.isPending}
          rowKey={(row) => row.__vmRowKey}
          showSelect
          selectedKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
          headerExtras={
            executedCheck === "X" ? (
              <Button size="sm" onClick={notConfigured} disabled={selectedRowKeys.size === 0}>
                Save
              </Button>
            ) : (
              <>
                <Button size="sm" variant="success" onClick={notConfigured} disabled={selectedRowKeys.size === 0}>
                  Change
                </Button>
                <Button size="sm" variant="destructive" onClick={notConfigured} disabled={selectedRowKeys.size === 0}>
                  Delete
                </Button>
              </>
            )
          }
          emptyMessage="No vehicle master records were returned for the selected plant."
          columns={columns}
        />
      )}
    </div>
  );
}