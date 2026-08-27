import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SapResponseDialog } from "@/components/mm/sap-response-dialog";
import { CloudscapeApprovalTable, type CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";
import { getMySapUserId } from "@/lib/sd/price-approval.functions";
import { fetchGatePass, saveGatePass } from "@/lib/mm/gate-pass.functions";
import { GatePassNumberSelect, type GatePassF4Flag } from "@/components/mm/gate-pass-number-select";
import { swalConfirm } from "@/lib/mm/swal";
import { PageHeader } from "@/components/exec/page-header";

export const Route = createFileRoute("/_authenticated/mm/gate-pass")({
  component: GatePassPage,
});

type DataRow = Record<string, any> & { __key?: string };

function rowKey(r: DataRow, i: number) {
  return [r.GATEPASS_NUMBER, r.GATE_PASS_NUMBER, r.SNO, r.MATERIAL, i].map((x) => x ?? "").join("|");
}

function toStr(v: any): string {
  if (v == null) return "";
  return String(v);
}

function humanize(k: string): string {
  return k
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function GatePassPage() {
  const fetchFn = useServerFn(fetchGatePass);
  const userIdFn = useServerFn(getMySapUserId);

  const { data: userIdData } = useQuery({
    queryKey: ["mm-gate-pass", "sap-user-id"],
    queryFn: () => userIdFn(),
  });

  const [userId, setUserId] = useState("");
  const [gatePassNumber, setGatePassNumber] = useState("");
  // Single-selection group: only one approval flag may be active at a time.
  type FlagKey = "" | "hod" | "store" | "scm" | "plant" | "return";
  const [flag, setFlag] = useState<FlagKey>("");
  const hodApproval = flag === "hod";
  const storeApproval = flag === "store";
  const scmHead = flag === "scm";
  const plantHead = flag === "plant";
  const returnReceipt = flag === "return";
  const pickFlag = (k: Exclude<FlagKey, "">, on: boolean) => {
    setFlag(on ? k : "");
    setGatePassNumber("");
  };
  const f4Flag: GatePassF4Flag =
    flag === "hod" ? "hod" : flag === "store" ? "stores" : flag === "scm" ? "scm" : flag === "plant" ? "plant" : "";


  // Mode captured at the moment Execute succeeded — drives which row fields stay editable.
  const [executedFlag, setExecutedFlag] = useState<FlagKey>("");

  const [header, setHeader] = useState<Record<string, any> | null>(null);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hasResults = header !== null || rows.length > 0;

  useEffect(() => {
    if (userIdData?.sap_user_id && !userId) setUserId(userIdData.sap_user_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdData?.sap_user_id]);

  const mutation = useMutation({
    mutationFn: async (vars: {
      user_id: string;
      gate_pass_number: string;
      hod_approval: boolean;
      store_approval: boolean;
      scm_head: boolean;
      plant_head: boolean;
      return_receipt: boolean;
    }) => {
      const v: any = await fetchFn({ data: vars });
      const data = Array.isArray(v?.data) ? (v.data as DataRow[]) : [];
      return {
        header: (v?.header ?? null) as Record<string, any> | null,
        data,
        count: data.length,
        error: v?.error ?? null,
        messages: Array.isArray(v?.messages)
          ? (v.messages as Array<{ type: string; message: string }>)
          : [],
      };
    },
    onSuccess: (res) => {
      setHeader(res.header);
      setRows(res.data);
      setSelected(new Set());
      setExecutedFlag(flag);
      if (res.messages.length > 0) {
        setResponseDialog({
          open: true,
          title: "Gate Pass Response",
          messageOnly: true,
          results: res.messages.map((m) => ({
            label: m.type ? `Type ${m.type}` : "Gate Pass",
            message: m.message,
            ok: !["E", "A"].includes(String(m.type ?? "").trim().toUpperCase()),
          })),
        });
      } else if (res.error) {
        setResponseDialog({
          open: true,
          title: "Gate Pass Response",
          messageOnly: true,
          results: [{ label: "Gate Pass", message: res.error, ok: false }],
        });
      } else {
        toast.success(`Loaded ${res.count} record${res.count === 1 ? "" : "s"} from SAP`);
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to fetch from SAP"),
  });

  const [responseDialog, setResponseDialog] = useState<
    | {
        open: boolean;
        title: string;
        messageOnly?: boolean;
        results: Array<{ label: string; message: string; ok: boolean; response?: any }>;
      }
    | null
  >(null);

  const saveFn = useServerFn(saveGatePass);
  const saveMutation = useMutation({
    mutationFn: async (selectedRows: DataRow[]) => {
      if (selectedRows.length === 0) throw new Error("Select at least one row to save");
      const h = header ?? {};
      const res: any = await saveFn({
        data: {
          header: {
            GATEPASS_NUMBER: h.GATEPASS_NUMBER ?? h.GATE_PASS_NUMBER ?? "",
            GATE_PASS_TYPE: h.GATE_PASS_TYPE ?? h.GATEPASS_TYPE ?? "",
            GATEPASS_DATE: h.GATEPASS_DATE ?? h.GATE_PASS_DATE ?? "",
            PLANT: h.PLANT ?? "",
            VEHICLE_NO: h.VEHICLE_NO ?? "",
            VENDOR: h.VENDOR ?? "",
            VENDOR_NAME: h.VENDOR_NAME ?? "",
            PURPOSE: h.PURPOSE ?? "",
          },
          data: selectedRows,
        },
      });
      return res as {
        ok: boolean;
        message: string;
        document_number: string | null;
        error: string | null;
        messages?: Array<{ type: string; message: string }>;
      };
    },
    onSuccess: (res) => {
      const msg = res.document_number
        ? `${res.message} (Doc: ${res.document_number})`
        : res.message;
      const sapMessages = Array.isArray(res.messages) ? res.messages : [];
      setResponseDialog({
        open: true,
        title: "Gate Pass Response",
        results:
          sapMessages.length > 0
            ? sapMessages.map((m) => ({
                label: res.document_number
                  ? `Doc ${res.document_number}`
                  : m.type
                    ? `Type ${m.type}`
                    : "Gate Pass",
                message: m.message,
                ok: !["E", "A"].includes(String(m.type ?? "").trim().toUpperCase()),
                response: res,
              }))
            : [
                {
                  label: res.document_number ? `Doc ${res.document_number}` : "Gate Pass",
                  message: res.ok ? msg : (res.error ?? msg),
                  ok: !!res.ok,
                  response: res,
                },
              ],
      });
      if (res.ok) {
        setSelected(new Set());
        // Refresh the results
        if (userId.trim()) {
          mutation.mutate({
            user_id: userId.trim(),
            gate_pass_number: gatePassNumber.trim(),
            hod_approval: hodApproval,
            store_approval: storeApproval,
            scm_head: scmHead,
            plant_head: plantHead,
            return_receipt: returnReceipt,
          });
        }
      }
    },
    onError: (e: Error) => {
      const message = e.message ?? "Failed to save";
      setResponseDialog({
        open: true,
        title: "Gate Pass Response",
        results: [{ label: "Gate Pass", message, ok: false }],
      });
    },
  });

  function execute() {
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    mutation.mutate({
      user_id: userId.trim(),
      gate_pass_number: gatePassNumber.trim(),
      hod_approval: hodApproval,
      store_approval: storeApproval,
      scm_head: scmHead,
      plant_head: plantHead,
      return_receipt: returnReceipt,
    });
  }

  function reset() {
    setUserId(userIdData?.sap_user_id ?? "");
    setGatePassNumber("");
    setFlag("");
    setExecutedFlag("");
    setHeader(null);
    setRows([]);
    setSelected(new Set());
  }

  function onSave() {
    const selectedRows = rows.filter((r, i) => selected.has(rowKey(r, i)));
    if (selectedRows.length === 0) {
      toast.error("Select at least one row to save");
      return;
    }
    saveMutation.mutate(selectedRows);
  }

  function updateRowField(item: DataRow, key: string, value: any) {
    setRows((prev) => prev.map((r) => (r === item ? { ...r, [key]: value } : r)));
  }

  const headerKeys = useMemo<string[]>(() => {
    if (!header) return [];
    return Object.keys(header);
  }, [header]);

  const lockedKeys = useMemo<Set<string>>(() => {
    const map: Record<Exclude<FlagKey, "">, string[]> = {
      hod: [
        "ISSUED_QUANTITY",
        "STORE_APPROVAL",
        "JUSTIFICATION",
        "SCM_HEAD",
        "PH_APPROVAL",
        "PH_REJECTION",
        "RETURN_STATUS",
        "REMARKS",
      ],
      store: [
        "HOD_APPROVAL",
        "HOD_REJECTION",
        "HOD_REMARKS",
        "SCM_HEAD",
        "PH_APPROVAL",
        "PH_REJECTION",
        "RETURN_STATUS",
        "REMARKS",
        "RETURNED_QUANTITY",
      ],
      scm: [
        "HOD_APPROVAL",
        "HOD_REJECTION",
        "HOD_REMARKS",
        "ISSUED_QUANTITY",
        "STORE_APPROVAL",
        "JUSTIFICATION",
        "PH_APPROVAL",
        "PH_REJECTION",
        "RETURN_STATUS",
        "REMARKS",
      ],
      plant: [
        "HOD_APPROVAL",
        "HOD_REJECTION",
        "HOD_REMARKS",
        "ISSUED_QUANTITY",
        "STORE_APPROVAL",
        "JUSTIFICATION",
        "SCM_HEAD",
        "RETURN_STATUS",
      ],
      return: [
        "HOD_APPROVAL",
        "HOD_REJECTION",
        "HOD_REMARKS",
        "ISSUED_QUANTITY",
        "STORE_APPROVAL",
        "JUSTIFICATION",
        "SCM_HEAD",
        "PH_APPROVAL",
        "PH_REJECTION",
      ],
    };
    return new Set(executedFlag ? map[executedFlag] : []);
  }, [executedFlag]);

  const columns = useMemo<CloudscapeColumn<DataRow>[]>(() => {
    const readonly = (k: string, label?: string, minWidth = 120): CloudscapeColumn<DataRow> => ({
      id: k,
      header: label ?? humanize(k),
      minWidth,
      cell: (item) => {
        const v = (item as any)[k];
        if (v == null || v === "") return "—";
        return String(v);
      },
    });

    const editCheckbox = (
      k: string,
      label?: string,
      partnerKey?: string,
    ): CloudscapeColumn<DataRow> => ({
      id: k,
      header: label ?? humanize(k),
      minWidth: 110,
      cell: (item) => (
        <Checkbox
          checked={(item as any)[k] === "X"}
          disabled={lockedKeys.has(k)}
          onCheckedChange={(v) => {
            const on = v === true;
            setRows((prev) =>
              prev.map((r) =>
                r === item
                  ? { ...r, [k]: on ? "X" : "", ...(partnerKey && on ? { [partnerKey]: "" } : {}) }
                  : r,
              ),
            );
          }}
        />
      ),
    });

    const editInput = (k: string, label?: string, minWidth = 200): CloudscapeColumn<DataRow> => ({
      id: k,
      header: label ?? humanize(k),
      minWidth,
      cell: (item) => (
        <Input
          value={toStr((item as any)[k])}
          disabled={lockedKeys.has(k)}
          onChange={(e) => updateRowField(item, k, e.target.value)}
          className="h-8 text-sm"
        />
      ),
    });

    return [
      readonly("MATERIAL"),
      readonly("DESCRIPTION", "Description", 220),
      readonly("MEINS", "UoM", 80),
      readonly("QUANTITY"),
      readonly("VALUE"),
      readonly("EXPECTED_DATE_OF_RETURN", "Expected Return", 150),
      readonly("USER_REMARKS", "User Remarks", 180),
      editCheckbox("HOD_APPROVAL", "HOD Approval", "HOD_REJECTION"),
      editCheckbox("HOD_REJECTION", "HOD Rejection", "HOD_APPROVAL"),
      editInput("HOD_REMARKS", "HOD Remarks"),
      editInput("ISSUED_QUANTITY", "Issued Qty", 130),
      editCheckbox("STORE_APPROVAL", "Store Approval"),
      editInput("JUSTIFICATION", "Justification"),
      editCheckbox("SCM_HEAD", "SCM Head"),
      editCheckbox("PH_APPROVAL", "PH Approval", "PH_REJECTION"),
      editCheckbox("PH_REJECTION", "PH Rejection", "PH_APPROVAL"),
      editCheckbox("RETURN_STATUS", "Return Status"),
      editInput("REMARKS", "Remarks"),
      editInput("RETURNED_QUANTITY", "Returned Qty", 130),
    ];
  }, [lockedKeys]);

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="MM Approvals" title="Gate Pass" subtitle="Review and approve gate pass items." />

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Gate Pass Number</Label>
            <GatePassNumberSelect
              value={gatePassNumber}
              onChange={setGatePassNumber}
              userId={userId}
              flag={f4Flag}
              onFailure={(message) =>
                setResponseDialog({
                  open: true,
                  title: "Gate Pass Response",
                  results: [{ label: "Gate Pass", message, ok: false }],
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">HOD Approval</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={hodApproval}
                  onCheckedChange={(v) => pickFlag("hod", v === true)}
                />
                HOD Approval
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Store Approval</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={storeApproval}
                  onCheckedChange={(v) => pickFlag("store", v === true)}
                />
                Store Approval
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SCM Head</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={scmHead}
                  onCheckedChange={(v) => pickFlag("scm", v === true)}
                />
                SCM Head
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plant Head</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={plantHead}
                  onCheckedChange={(v) => pickFlag("plant", v === true)}
                />
                Plant Head
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Return Receipt</Label>
            <div className="h-9 flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={returnReceipt}
                  onCheckedChange={(v) => pickFlag("return", v === true)}
                />
                Return Receipt
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button size="sm" onClick={execute} disabled={!userId.trim() || mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Execute
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>
      </Card>

      {hasResults && (
        <>
          {headerKeys.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
                <Filter className="h-3.5 w-3.5" /> HEADER
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                {headerKeys.map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs">{humanize(k)}</Label>
                    <Input
                      value={toStr(header?.[k])}
                      readOnly
                      className="h-9 text-sm bg-muted/40"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={selected.size === 0 || saveMutation.isPending}
              onClick={onSave}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>

          <CloudscapeApprovalTable
            title="Gate Pass Items"
            countLabel={`(${rows.length})`}
            rows={rows}
            rowKey={rowKey}
            loading={mutation.isPending}
            emptyMessage="No line items."
            showSelect
            selectedKeys={selected}
            onSelectionChange={setSelected}
            columns={columns}
          />
        </>
      )}

      <SapResponseDialog
        dialog={
          responseDialog
            ? {
                open: responseDialog.open,
                title: responseDialog.title,
                refLabel: "Gate Pass",
                results: responseDialog.results.map((r) => ({
                  ref: r.label,
                  message: r.message,
                  ok: r.ok,
                  response: r.response,
                })),
              }
            : null
        }
        onOpenChange={(open) =>
          setResponseDialog((prev) => (prev ? { ...prev, open } : prev))
        }
        defaultTitle="Gate Pass Response"
      />
    </div>
  );
}
