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
  getTransportSaveConfig,
  getTransportChangeConfig,
} from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import { swalSapResponse } from "@/lib/mm/swal";
import { extractSapMessage } from "@/lib/mm/sap-message";
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
  const [plants, setPlants] = useState<string[]>([]);
  const [executed, setExecuted] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const getBillingCfg = useServerFn(getTransportBillingConfig);
  const getCustCfg = useServerFn(getTransportCustConfig);
  const getCustNameCfg = useServerFn(getTransportCustNameConfig);
  const getSaveCfg = useServerFn(getTransportSaveConfig);
  const getChangeCfg = useServerFn(getTransportChangeConfig);
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
        setSelectedRowKeys(new Set());
        toast.error(response.error || "Could not load exception billing records.");
        return;
      }
      const fetched = extractRows(response?.data ?? response).map((row, index) => ({
        ...row,
        __transportRowKey: String(index),
      }));
      setRows(fetched);
      setSelectedRowKeys(new Set());
      if (fetched.length === 0) toast.info("No records returned for the selected plant.");
    },
    onError: (error) => {
      setRows([]);
      setSelectedRowKeys(new Set());
      toast.error(error instanceof Error ? error.message : "Could not load exception billing records.");
    },
  });

  const columns = useMemo<CloudscapeColumn<Row>[]>(() => {
    const updateRow = (row: Row, field: string, value: unknown) =>
      setRows((current) =>
        current.map((item) =>
          item.__transportRowKey === row.__transportRowKey
            ? { ...item, [field]: value }
            : item,
        ),
      );

    const displayValue = (row: Row, field: string) => {
      const value = row[field];
      return value === null || value === undefined || value === "" ? "—" : String(value);
    };

    return [
      {
        id: "WERKS",
        header: "Plant",
        minWidth: 120,
        cell: (row) => displayValue(row, "WERKS"),
      },
      {
        id: "KUNNR",
        header: "Customer",
        minWidth: 200,
        cell: (row) => (
          <CustomerSelect
            value={String(row.KUNNR ?? "")}
            onChange={(value) => updateRow(row, "KUNNR", value)}
            configId={custCfgQuery.data?.configId ?? null}
            inputs={{ kunnr: "" }}
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
            configId={custNameCfgQuery.data?.configId ?? null}
            inputs={{ name1: "" }}
            codeField="NAME1"
            textField="NAME1"
            placeholder="Select customer name…"
          />
        ),
      },
      {
        id: "CHK_VALUE",
        header: "Check Value",
        minWidth: 120,
        cell: (row) => (
          <Checkbox
            aria-label={`Checked for row ${row.__transportRowKey}`}
            checked={String(row.CHK_VALUE ?? "").trim().toUpperCase() === "X"}
            onCheckedChange={(checked) =>
              updateRow(row, "CHK_VALUE", checked === true ? "X" : "")
            }
          />
        ),
      },
      {
        id: "REMARK",
        header: "Remarks",
        minWidth: 200,
        cell: (row) => (
          <Input
            value={String(row.REMARK ?? "")}
            onChange={(event) => updateRow(row, "REMARK", event.target.value)}
            placeholder="Remarks"
            className="h-8 min-w-[180px] text-xs"
          />
        ),
      },
      {
        id: "APPROV_BY",
        header: "Approved By",
        minWidth: 140,
        cell: (row) => displayValue(row, "APPROV_BY"),
      },
      {
        id: "UPDATE_BY",
        header: "Update By",
        minWidth: 140,
        cell: (row) => displayValue(row, "UPDATE_BY"),
      },
      {
        id: "STATUS",
        header: "Status",
        minWidth: 120,
        cell: (row) => displayValue(row, "STATUS"),
      },
    ];
  }, [custCfgQuery.data?.configId, custNameCfgQuery.data?.configId]);

  function execute() {
    const configId = billingCfgQuery.data?.configId;
    if (!configId) {
      toast.error("SAP API config 90%_Get_API is not configured or active.");
      return;
    }
    setExecuted(true);
    setRows([]);
    setSelectedRowKeys(new Set());
    fetchMutation.mutate({ configId, plantValues: plants.length > 0 ? plants : [""] });
  }

  const noSelection = selectedRowKeys.size === 0;

  const [changing, setChanging] = useState(false);
  const busy = saving || changing;

  function save() {
    return submit("save");
  }
  function change() {
    return submit("modify");
  }

  async function submit(mode: "save" | "modify") {
    if (noSelection || busy) return;
    const setBusy = mode === "save" ? setSaving : setChanging;
    const apiName = mode === "save" ? "90%_Save_API" : "90%_Change_API";
    const unchecked = mode === "save" ? "" : " ";
    setBusy(true);
    try {
      const cfg = mode === "save" ? await getSaveCfg() : await getChangeCfg();
      if (!cfg.configId) {
        toast.error(`SAP API config ${apiName} is not configured or active.`);
        return;
      }
      const selected = rows.filter((r) => selectedRowKeys.has(r.__transportRowKey));
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      const response: any = await runApi({
        data: {
          configId: cfg.configId,
          inputs: {
            [mode]: selected.map((r) => ({
              user_name: cfg.userName,
              werks: str(r.WERKS),
              KUNNR: str(r.KUNNR),
              NAME1: str(r.NAME1),
              CHK_VALUE: str(r.CHK_VALUE).trim().toUpperCase() === "X" ? "X" : unchecked,
              remark: str(r.REMARK),
            })),
          },
        },
      });
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
        .map((x) => ({
          ref: "",
          message: str(x.MESSAGE),
          ok: str(x.TYPE).trim().toUpperCase() === "S",
        }));
      if (results.length === 0) {
        const msg =
          (response?.ok === false && response?.error) ||
          extractSapMessage(response) ||
          "No response returned by SAP.";
        results.push({ ref: "", message: String(msg), ok: false });
      }
      const allOk = response?.ok !== false && results.every((r) => r.ok);
      await swalSapResponse({
        title: allOk ? (mode === "save" ? "Saved" : "Changed") : "SAP Response",
        results: results.length === 1 ? results : results.map((r, i) => ({ ...r, ref: String(i + 1) })),
        refLabel: "#",
      });
      if (allOk) execute();
    } catch (error) {
      await swalSapResponse({
        results: [{ ref: "", message: error instanceof Error ? error.message : String(error), ok: false }],
      });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPlants([]);
    setRows([]);
    setSelectedRowKeys(new Set());
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

        <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[220px_1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Plant</Label>
            <PlantMultiSelect value={plants} onChange={setPlants} source="iwm-plant" />
          </div>
          <div className="flex justify-self-end gap-2">
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
          showSelect
          selectedKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
          headerExtras={
            <>
              <Button size="sm" onClick={save} disabled={noSelection || busy}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="success" onClick={change} disabled={noSelection || busy}>
                {changing ? "Changing…" : "Change"}
              </Button>
              <Button size="sm" variant="destructive" disabled={noSelection || busy}>
                Delete
              </Button>
            </>
          }
          emptyMessage="No exception billing records were returned."
          columns={columns}
        />
      )}
    </div>
  );
}
