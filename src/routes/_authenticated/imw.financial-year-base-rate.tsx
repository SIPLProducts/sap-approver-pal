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
import { Input } from "@/components/ui/input";
import { CustomerSelect } from "@/components/sap/customer-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  getFinanceSaveConfig,
  getFinanceCreateConfig,
  getFinanceChangeConfig,
  getFinanceDeleteConfig,
  getTransportPlantCustConfig,
  getTransportCustBasedNameConfig,
  getFinanceMaterialF4Config,
} from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import { swalSapResponse } from "@/lib/mm/swal";
import { extractSapMessage } from "@/lib/mm/sap-message";
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
  const getCreateCfg = useServerFn(getFinanceCreateConfig);
  const runApi = useServerFn(runSapApi);
  const [saving, setSaving] = useState(false);
  const getChangeCfg = useServerFn(getFinanceChangeConfig);
  const [changing, setChanging] = useState(false);
  const getDeleteCfg = useServerFn(getFinanceDeleteConfig);
  const [deleting, setDeleting] = useState(false);

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
  const getMaterialF4Cfg = useServerFn(getFinanceMaterialF4Config);
  const materialF4CfgQuery = useQuery({
    queryKey: ["finance-material-f4-config"],
    queryFn: () => getMaterialF4Cfg(),
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
        cell: (row) => executedCheck !== "X" ? show(row.KUNNR) : (
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
        cell: (row) => executedCheck !== "X" ? show(row.NAME1) : (
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
      {
        id: "MATERIAL",
        header: "Material",
        minWidth: 200,
        cell: (row) => executedCheck !== "X" ? show(row.MATERIAL) : (
          <CustomerSelect
            value={String(row.MATERIAL ?? "")}
            onChange={(value) => updateRow(row, "MATERIAL", value)}
            configId={materialF4CfgQuery.data?.configId ?? null}
            inputs={{ material: "" }}
            entityLabel="material"
            codeField="MATNR"
            textField="MATNR"
            placeholder="Select material…"
          />
        ),
      },
      {
            id: "FIN_RATE",
            header: "Financial Base Rate",
            minWidth: 160,
            cell: (row) => (
              <Input
                value={String(row.FIN_RATE ?? "")}
                onChange={(event) => updateRow(row, "FIN_RATE", event.target.value)}
                inputMode="decimal"
                className="h-8 min-w-[120px] text-xs"
              />
            ),
      },
      text("UPDATED_BY", "Updated Person"),
      text("UPDATED_ON", "Updated Date"),
      text("APPROV_BY", "Approver"),
      text("STATUS", "Status", 120),
    ];
  }, [plantCustCfgQuery.data?.configId, custBasedNameCfgQuery.data?.configId, materialF4CfgQuery.data?.configId, executedCheck]);

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

  async function showSapResult(response: any, successTitle: string) {
    const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      const payload = response?.data ?? response;
      const list: any[] = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object"
          ? Array.isArray(payload.DATA)
            ? payload.DATA
            : [payload]
          : [];
      const results = list
        .filter((x) => x && typeof x === "object" && (x.MESSAGE !== undefined || x.TYPE !== undefined))
        .map((x) => ({ ref: "", message: str(x.MESSAGE), ok: str(x.TYPE).trim().toUpperCase() === "S" }));
      if (results.length === 0) {
        const msg =
          (response?.ok === false && response?.error) || extractSapMessage(response) || "No response returned by SAP.";
        results.push({ ref: "", message: String(msg), ok: false });
      }
      const allOk = response?.ok !== false && results.every((r) => r.ok);
      await swalSapResponse({
        title: allOk ? successTitle : "SAP Response",
        results: results.length === 1 ? results : results.map((r, i) => ({ ...r, ref: String(i + 1) })),
        refLabel: "#",
      });
    return allOk;
  }

  async function change() {
    if (selectedRowKeys.size === 0 || changing) return;
    setChanging(true);
    try {
      const cfg = await getChangeCfg();
      if (!cfg.configId) {
        await swalSapResponse({
          results: [{ ref: "", message: "Finace_Change_API is not configured or active.", ok: false }],
        });
        return;
      }
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      const selected = rows.filter((r) => selectedRowKeys.has(r.__finRowKey));
      const response: any = await runApi({
        data: {
          configId: cfg.configId,
          inputs: {
            user_name: cfg.userName,
            modify: selected.map((r) => ({
              MANDT: str(r.MANDT),
              WERKS: str(r.WERKS),
              KUNNR: str(r.KUNNR),
              NAME1: str(r.NAME1),
              MATERIAL: str(r.MATERIAL),
              FIN_RATE: str(r.FIN_RATE),
              UPDATED_BY: str(r.UPDATED_BY),
              UPDATED_ON: str(r.UPDATED_ON),
              APPROV_BY: str(r.APPROV_BY),
              STATUS: str(r.STATUS),
            })),
          },
        },
      });
      const allOk = await showSapResult(response, "Changed");
      if (allOk) execute();
    } catch (error) {
      await swalSapResponse({
        results: [{ ref: "", message: error instanceof Error ? error.message : String(error), ok: false }],
      });
    } finally {
      setChanging(false);
    }
  }

  async function save() {
    if (selectedRowKeys.size === 0 || saving) return;
    setSaving(true);
    try {
      const cfg = await getCreateCfg();
      if (!cfg.configId) {
        await swalSapResponse({
          results: [{ ref: "", message: "Finace_create_API is not configured or active.", ok: false }],
        });
        return;
      }
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      const selected = rows.filter((r) => selectedRowKeys.has(r.__finRowKey));
      const response: any = await runApi({
        data: {
          configId: cfg.configId,
          inputs: {
            SAVE: selected.map((r) => ({
              user_name: cfg.userName,
              WERKS: str(r.WERKS),
              KUNNR: str(r.KUNNR),
              NAME1: str(r.NAME1),
              material: str(r.MATERIAL),
              FIN_RATE: str(r.FIN_RATE),
            })),
          },
        },
      });
      const allOk = await showSapResult(response, "Saved");
      if (allOk) execute();
    } catch (error) {
      await swalSapResponse({
        results: [{ ref: "", message: error instanceof Error ? error.message : String(error), ok: false }],
      });
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (selectedRowKeys.size === 0 || deleting) return;
    setDeleting(true);
    try {
      const cfg = await getDeleteCfg();
      if (!cfg.configId) {
        await swalSapResponse({
          results: [{ ref: "", message: "Finace_Delete_API is not configured or active.", ok: false }],
        });
        return;
      }
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      const selected = rows.filter((r) => selectedRowKeys.has(r.__finRowKey));
      const response: any = await runApi({
        data: {
          configId: cfg.configId,
          inputs: {
            user_name: cfg.userName,
            delete: selected.map((r) => ({
              MANDT: str(r.MANDT),
              WERKS: str(r.WERKS),
              KUNNR: str(r.KUNNR),
              MATERIAL: str(r.MATERIAL),
              NAME1: str(r.NAME1),
              FIN_RATE: str(r.FIN_RATE),
              UPDATED_BY: str(r.UPDATED_BY),
              UPDATED_ON: str(r.UPDATED_ON),
              APPROV_BY: str(r.APPROV_BY),
              STATUS: str(r.STATUS),
            })),
          },
        },
      });
      const allOk = await showSapResult(response, "Deleted");
      if (allOk) execute();
    } catch (error) {
      await swalSapResponse({
        results: [{ ref: "", message: error instanceof Error ? error.message : String(error), ok: false }],
      });
    } finally {
      setDeleting(false);
    }
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
              <Button size="sm" onClick={save} disabled={selectedRowKeys.size === 0 || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="success" onClick={change} disabled={selectedRowKeys.size === 0 || changing}>
                  {changing ? "Changing…" : "Change"}
                </Button>
                <Button size="sm" variant="destructive" onClick={remove} disabled={selectedRowKeys.size === 0 || deleting}>
                  {deleting ? "Deleting…" : "Delete"}
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