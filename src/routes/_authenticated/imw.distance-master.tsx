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
import { Label } from "@/components/ui/label";
import { useActiveContext } from "@/hooks/use-active-context";
import { getDistanceMasterGetConfig, getDmSaveConfig, getTransportPlantCustConfig } from "@/lib/sap/customer.functions";
import { CustomerSelect } from "@/components/sap/customer-select";
import { Input } from "@/components/ui/input";
import { runSapApi } from "@/lib/sap/sap.functions";
import { swalSapResponse } from "@/lib/mm/swal";
import { extractSapMessage } from "@/lib/mm/sap-message";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";

export const Route = createFileRoute("/_authenticated/imw/distance-master")({
  head: () => ({
    meta: [
      { title: "Distance Master— IWM Approvals" },
      {
        name: "description",
        content: "View distance master information for a selected IWM plant.",
      },
      { property: "og:title", content: "Distance Master Screen — IWM Approvals" },
      {
        property: "og:description",
        content: "View distance master information for a selected IWM plant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DistanceMasterPage,
});

type Row = Record<string, unknown> & { __dmRowKey: string };

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

function DistanceMasterPage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [newRecord, setNewRecord] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [executedCheck, setExecutedCheck] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set());

  const getCfg = useServerFn(getDistanceMasterGetConfig);
  const runApi = useServerFn(runSapApi);
  const cfgQuery = useQuery({
    queryKey: ["distance-master-get-config"],
    queryFn: () => getCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const getPlantCustCfg = useServerFn(getTransportPlantCustConfig);
  const plantCustCfgQuery = useQuery({
    queryKey: ["transport-plant-cust-config"],
    queryFn: () => getPlantCustCfg(),
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
        toast.error(response.error || "Could not load distance master records.");
        return;
      }
      const fetched = extractRows(response?.data ?? response).map((row, index) => ({
        ...row,
        __dmRowKey: String(index),
      }));
      setRows(fetched);
      setSelectedRowKeys(new Set());
      if (fetched.length === 0) toast.info("No records returned for the selected plant.");
    },
    onError: (error) => {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Could not load distance master records.");
    },
  });

  const columns = useMemo<CloudscapeColumn<Row>[]>(() => {
    const updateRow = (row: Row, field: string, value: unknown) =>
      setRows((current) =>
        current.map((item) => (item.__dmRowKey === row.__dmRowKey ? { ...item, [field]: value } : item)),
      );
    const show = (value: unknown) =>
      value === null || value === undefined || String(value).trim() === "" ? "—" : String(value);
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
        id: "DISTANCE",
        header: "Distance",
        minWidth: 140,
        cell: (row) => (
          <Input
            value={String(row.DISTANCE ?? "")}
            onChange={(event) => updateRow(row, "DISTANCE", event.target.value)}
            inputMode="decimal"
            className="h-8 min-w-[120px] text-xs"
          />
        ),
      },
    ];
  }, [executedCheck, plantCustCfgQuery.data?.configId]);

  const getSaveCfg = useServerFn(getDmSaveConfig);
  const [saving, setSaving] = useState(false);

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

  async function save() {
    if (selectedRowKeys.size === 0 || saving) return;
    setSaving(true);
    try {
      const cfg = await getSaveCfg();
      if (!cfg.configId) {
        await swalSapResponse({
          results: [{ ref: "", message: "DM_SAVE_API is not configured or active.", ok: false }],
        });
        return;
      }
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      const num = (v: unknown) => {
        const n = Number(str(v).trim());
        return Number.isFinite(n) ? n : 0;
      };
      const selected = rows.filter((r) => selectedRowKeys.has(r.__dmRowKey));
      const response: any = await runApi({
        data: {
          configId: cfg.configId,
          inputs: {
            SAVE: selected.map((r) => ({
              user_name: cfg.userName,
              KUNNR: str(r.KUNNR),
              WERKS: str(r.WERKS),
              DISTANCE: num(r.DISTANCE),
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

  function notConfigured() {
    toast.info("SAP API not configured yet");
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

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    const configId = cfgQuery.data?.configId;
    if (!configId) {
      toast.error("SAP API config DM_GET_API is not configured or active.");
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
        title="Distance Master"
        subtitle="View distance master information for the selected plant."
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
              id="dm-new-record"
              checked={newRecord}
              onCheckedChange={(checked) => setNewRecord(checked === true)}
            />
            <Label htmlFor="dm-new-record" className="text-xs">
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
          title="Distance Master"
          countLabel={fetchMutation.isPending ? "Loading…" : `(${rows.length})`}
          rows={rows}
          loading={fetchMutation.isPending}
          rowKey={(row) => row.__dmRowKey}
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
                <Button size="sm" variant="success" onClick={notConfigured} disabled={selectedRowKeys.size === 0}>
                  Change
                </Button>
                <Button size="sm" variant="destructive" onClick={notConfigured} disabled={selectedRowKeys.size === 0}>
                  Delete
                </Button>
              </>
            )
          }
          emptyMessage="No distance master records were returned for the selected plant."
          columns={columns}
        />
      )}
    </div>
  );
}
