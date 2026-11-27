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
import { getVmApprovalsGetConfig, getVmApprovalsApproveConfig, getVmApprovalsRejectConfig } from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import { extractSapMessage } from "@/lib/mm/sap-message";
import { swalConfirm, swalSapResponse } from "@/lib/mm/swal";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";

type Row = Record<string, unknown> & { __rowKey: string };

const RESPONSE_FIELDS = ["WERKS", "VEHICLENO", "VEHICLECAP", "NETWT", "VEH_CAP", "VEH_TYPE", "TRANSPORT_NAME", "UPDATED_BY", "APPROV_BY", "STATUS"];
const NUMERIC_FIELDS = new Set(["VEHICLECAP", "NETWT"]);

const HEADER_LABELS: Record<string, string> = {
  WERKS: "Plant",
  VEHICLENO: "Vehicle Number",
  VEHICLECAP: "Material Qty - RTO-CAPACITY (in Tons)",
  NETWT: "Material Net Weight * 90%",
  VEH_CAP: "Vehicle Tonnage",
  VEH_TYPE: "Vehicle Type",
  TRANSPORT_NAME: "Transport Name",
  UPDATED_BY: "Updated Person",
  APPROV_BY: "Approver",
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

export const Route = createFileRoute("/_authenticated/imw/vehicle-master-approvals")({
  head: () => ({
    meta: [
      { title: "Vehicle Master Approvals — IWM Approvals" },
      { name: "description", content: "Review vehicle master approvals by plant and status." },
      { property: "og:title", content: "Vehicle Master Approvals — IWM Approvals" },
      { property: "og:description", content: "Review vehicle master approvals by plant and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VehicleMasterApprovalsPage,
});

function VehicleMasterApprovalsPage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [status, setStatus] = useState<Status>("pending");

  const [executed, setExecuted] = useState(false);
  const [executedStatus, setExecutedStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const getCfg = useServerFn(getVmApprovalsGetConfig);
  const runApi = useServerFn(runSapApi);
  const getApproveCfg = useServerFn(getVmApprovalsApproveConfig);
  const getRejectCfg = useServerFn(getVmApprovalsRejectConfig);

  function pickSapMessage(response: any): { message: string; ok: boolean } {
    const parse = (v: any): any => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      if (!t.startsWith("{") && !t.startsWith("[")) return v;
      try { return JSON.parse(t); } catch { return v; }
    };
    const find = (v: any, depth = 0): any => {
      v = parse(v);
      if (!v || typeof v !== "object" || depth > 6) return null;
      if (!Array.isArray(v) && Object.keys(v).some((k) => k.toUpperCase() === "MESSAGE")) return v;
      for (const child of Array.isArray(v) ? v : Object.values(v)) {
        const hit = find(child, depth + 1);
        if (hit) return hit;
      }
      return null;
    };
    const get = (o: any, key: string) => {
      const k = o ? Object.keys(o).find((x) => x.toUpperCase() === key) : undefined;
      return k ? String(o[k] ?? "").trim() : "";
    };
    const data = parse(response?.data ?? response);
    const entry = find(data);
    let message = get(entry, "MESSAGE");
    const type = get(entry, "TYPE").toUpperCase();
    if (!message && typeof data === "string") message = data.trim();
    if (response?.ok === false) {
      return { message: message || response.error || extractSapMessage(response) || "Request failed", ok: false };
    }
    if (!message) return { message: "No message returned by SAP", ok: false };
    if (type) return { message, ok: type === "S" };
    return { message, ok: !!entry || /succ?ess?f?u?l?|sucess/i.test(message) };
  }

  const fetchMutation = useMutation({
    mutationFn: async (input: { plants: string[]; status: Status }) => {
      const cfg = await getCfg();
      if (!cfg.configId) throw new Error("SAP API config VM_APPROVALS-GET_API is not configured or active.");
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
        .filter((r) => r.WERKS !== undefined || r.VEHICLENO !== undefined)
        .map((row, index) => ({ ...row, __rowKey: String(index) }));
      setRows(fetched);
      if (fetched.length === 0) {
        toast.info(extractSapMessage(response) || "No records returned for the selected plant.");
      }
    },
    onError: (error) => {
      setRows([]);
      setSelectedKeys(new Set());
      toast.error(error instanceof Error ? error.message : "Could not load records.");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (picked: Row[]) => {
      const cfg = await getApproveCfg();
      if (!cfg.configId) throw new Error("SAP API VM_APPROVALS-Approve_API is not configured or active.");
      const results: { message: string; ok: boolean }[] = [];
      for (const row of picked) {
        try {
          const num = (v: unknown) => {
            const n = Number(String(v ?? "").replace(/,/g, "").trim());
            return Number.isFinite(n) ? n : 0;
          };
          const response = await runApi({
            data: {
              configId: cfg.configId,
              inputs: {
                approve: {
                  MANDT: row.MANDT ?? "",
                  WERKS: row.WERKS ?? "",
                  VEHICLENO: row.VEHICLENO ?? "",
                  VEHICLECAP: num(row.VEHICLECAP),
                  NETWT: num(row.NETWT),
                  VEH_CAP: row.VEH_CAP ?? "",
                  VEH_TYPE: row.VEH_TYPE ?? "",
                  TRANSPORT_NAME: row.TRANSPORT_NAME ?? "",
                  UPDATED_BY: row.UPDATED_BY ?? "",
                  APPROV_BY: cfg.userName || (row.APPROV_BY ?? ""),
                  STATUS: row.STATUS ?? "",
                },
              },
            },
          });
          results.push(pickSapMessage(response));
        } catch (e) {
          results.push({ message: e instanceof Error ? e.message : "Approval failed", ok: false });
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      await swalSapResponse({
        title: "Approve Response",
        refLabel: "Message",
        results: results.map((r) => ({ ref: "", message: r.message, ok: r.ok })),
      });
      if (results.some((r) => r.ok) && executedStatus && plants.length > 0) {
        setSelectedKeys(new Set());
        fetchMutation.mutate({ plants, status: executedStatus });
      }
    },
    onError: async (e: Error) => {
      await swalSapResponse({
        title: "Approve Response",
        refLabel: "Message",
        results: [{ ref: "", message: e.message || "Approval failed", ok: false }],
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (picked: Row[]) => {
      const cfg = await getRejectCfg();
      if (!cfg.configId) throw new Error("SAP API VM_APPROVALS-Reject_API is not configured or active.");
      const results: { message: string; ok: boolean }[] = [];
      for (const row of picked) {
        try {
          const num = (v: unknown) => {
            const n = Number(String(v ?? "").replace(/,/g, "").trim());
            return Number.isFinite(n) ? n : 0;
          };
          const response = await runApi({
            data: {
              configId: cfg.configId,
              inputs: {
                reject: {
                  MANDT: row.MANDT ?? "",
                  WERKS: row.WERKS ?? "",
                  VEHICLENO: row.VEHICLENO ?? "",
                  VEHICLECAP: num(row.VEHICLECAP),
                  NETWT: num(row.NETWT),
                  VEH_CAP: row.VEH_CAP ?? "",
                  VEH_TYPE: row.VEH_TYPE ?? "",
                  TRANSPORT_NAME: row.TRANSPORT_NAME ?? "",
                  UPDATED_BY: row.UPDATED_BY ?? "",
                  APPROV_BY: cfg.userName || (row.APPROV_BY ?? ""),
                  STATUS: row.STATUS ?? "",
                },
              },
            },
          });
          results.push(pickSapMessage(response));
        } catch (e) {
          results.push({ message: e instanceof Error ? e.message : "Rejection failed", ok: false });
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      await swalSapResponse({
        title: "Reject Response",
        refLabel: "Message",
        results: results.map((r) => ({ ref: "", message: r.message, ok: r.ok })),
      });
      if (results.some((r) => r.ok) && executedStatus && plants.length > 0) {
        setSelectedKeys(new Set());
        fetchMutation.mutate({ plants, status: executedStatus });
      }
    },
    onError: async (e: Error) => {
      await swalSapResponse({
        title: "Reject Response",
        refLabel: "Message",
        results: [{ ref: "", message: e.message || "Rejection failed", ok: false }],
      });
    },
  });

  async function confirmReject() {
    const picked = rows.filter((r) => selectedKeys.has(r.__rowKey));
    if (picked.length === 0) return;
    const ok = await swalConfirm({
      title: "Reject selected records?",
      text: `${picked.length} record(s) will be rejected.`,
      confirmLabel: "Reject",
    });
    if (ok) rejectMutation.mutate(picked);
  }


  const columns = useMemo<CloudscapeColumn<Row>[]>(
    () =>
      RESPONSE_FIELDS.map((field) => ({
        id: field,
        header: HEADER_LABELS[field] ?? field,
        minWidth: 120,
        cell: (row: Row) => {
          const v = row[field];
          if (v === null || v === undefined || String(v).trim() === "") return "—";
          if (NUMERIC_FIELDS.has(field)) {
            const n = Number(String(v).replace(/,/g, "").trim());
            return Number.isFinite(n) ? String(n) : String(v);
          }
          return String(v);
        },
      })),
    [],
  );

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
        title="Vehicle Master Approvals"
        subtitle="Review vehicle master approval records by plant and status."
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
              onValueChange={(value) => setStatus(value as Status)}
              className="flex items-center gap-5"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="pending" id="vma-approval-pending" />
                Pending
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="completed" id="vma-approval-completed" />
                Completed
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="rejected" id="vma-approval-rejected" />
                Rejected
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable
          title="Vehicle Master Approvals"
          countLabel={fetchMutation.isPending ? "Loading…" : `(${rows.length})`}
          rows={rows}
          loading={fetchMutation.isPending}
          rowKey={(row) => row.__rowKey}
          showSelect={executedStatus === "pending"}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          emptyMessage="No records"
          headerExtras={
            executedStatus === "pending" && rows.length > 0 ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={selectedKeys.size === 0 || approveMutation.isPending}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  onClick={() => approveMutation.mutate(rows.filter((r) => selectedKeys.has(r.__rowKey)))}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selectedKeys.size === 0 || rejectMutation.isPending}
                  onClick={confirmReject}
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
