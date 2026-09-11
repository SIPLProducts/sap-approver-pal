import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { CalendarIcon, Filter, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { format } from "date-fns";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import {
  SapResponseDialog,
  type SapResponseDialogState,
} from "@/components/mm/sap-response-dialog";
import { PageHeader } from "@/components/exec/page-header";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import { cancelZgpRecords, fetchZgpReport } from "@/lib/mm/zgp-report.functions";
import { swalConfirm } from "@/lib/mm/swal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mm/zgp-report")({
  head: () => ({
    meta: [
      { title: "ZGP Report — RGP & NRGP Status" },
      {
        name: "description",
        content: "Filter and review returnable and non-returnable gate pass status records.",
      },
      { property: "og:title", content: "ZGP Report — RGP & NRGP Status" },
      {
        property: "og:description",
        content: "Filter and review returnable and non-returnable gate pass status records.",
      },
    ],
  }),
  component: ZgpReportPage,
});

type DataRow = Record<string, any>;

type RangeState = { from: string; to: string };

const EMPTY: RangeState = { from: "", to: "" };

type ZgpFilters = {
  type_from: string;
  type_to: string;
  number_from: string;
  number_to: string;
  material_from: string;
  material_to: string;
  date_from: string;
  date_to: string;
  plant_from: string;
  plant_to: string;
  vendor_from: string;
  vendor_to: string;
};

/** Readable headers for the documented ZGP report keys. */
const HEADER_LABELS: Record<string, string> = {
  TYPE: "Type",
  UNIQUE_NO: "Gate Pass Number",
  GATEPASSDATE: "Gate Pass Date",
  MATERIAL: "Material",
  DESCRIPTION: "Description",
  MEINS: "Unit of measure",
  QUANTITY: "Requested Quantity",
  VALUE: "Net Value",
  PLANT: "Plant",
  NAME: "Plant Name",
  COMPANY_CODE: "Company Code",
  VEHICLE_NO: "Vehicle No",
  VENDOR: "Vendor",
  ZNAME1: "Vendor Name",
  EXPECTED_DATE_OF_RETURN: "Expected Return Date",
  USER_REMARKS: "User Remarks",
  ZPURPOSE: "Purpose",
  USER_ID: "User",
  USER_DATE: "User Date",
  HOD_USER: "HOD User",
  HOD_APPROVAL: "HOD Approval",
  HOD_REJECTION: "HOD Rejection",
  HOD_APP_DATE: "HOD Date",
  HOD_REMARKS: "HOD Remarks",
  HOD_APP_TIME: "HOD Time",
  ISSUED_QUANTITY: "Issued Qty",
  STORE_APPROVAL: "Store Approval",
  JUSTIFICATION: "Justification",
  SCM_HEAD: "SCM Head",
  SCM_APPROVAL_DATE: "SCM Date",
  SCM_USER: "SCM User",
  SCM_HEAD_TIME: "SCM Time",
  ACTUAL_RETURN_DATE: "Actual Return Date",
  STORE_USER: "Store User",
  STORE_APP_DATE: "Store Date",
  PH_APPROVAL: "PH Approval",
  PH_REJECTION: "PH Rejection",
  RECEIPT_BUTTON: "Receipt Button",
  RETURNED_QUANTITY: "Returned Quantity",
  RETURN_STATUS: "Return Status",
  RETURN_RECEIPT_USER: "Return User",
  RETURN_RECEIPT_DATE: "Return Date",
  RETURN_RECEIPT_TIME: "Return Time",
  PLANT_HEAD_USER: "Plant Head User",
  PLANT_APP_DATE: "Plant Date",
  PALNT_HEAD_TIME: "Plant Time",
  REMARKS: "Remarks",
  CANCEL: "Cancel Status",
  CANCELED_BY: "Canceled by",
  CANCELED_ON: "Canceled on",
  CANCELED_TIME: "Canceled time",
};

const TEXT_KEYS = [
  "TYPE",
  "UNIQUE_NO",
  "MATERIAL",
  "MEINS",
  "PLANT",
  "NAME",
  "COMPANY_CODE",
  "VEHICLE_NO",
  "VENDOR",
  "ZNAME1",
  "USER_ID",
  "HOD_USER",
  "HOD_APPROVAL",
  "HOD_REJECTION",
  "HOD_APP_TIME",
  "STORE_APPROVAL",
  "SCM_HEAD",
  "SCM_USER",
  "SCM_HEAD_TIME",
  "STORE_USER",
  "PH_APPROVAL",
  "PH_REJECTION",
  "RECEIPT_BUTTON",
  "RETURN_STATUS",
  "RETURN_RECEIPT_USER",
  "RETURN_RECEIPT_TIME",
  "PLANT_HEAD_USER",
  "PALNT_HEAD_TIME",
  "CANCEL",
  "CANCELED_BY",
  "CANCELED_TIME",
];

const NUMERIC_KEYS = ["QUANTITY", "VALUE", "ISSUED_QUANTITY", "RETURNED_QUANTITY"];

/** SAP placeholder values ("0000-00-00", "00:00:00") display as a dash. */
const PLACEHOLDERS = new Set(["0000-00-00", "00000000", "00:00:00", "0000-00:00", "00.00.0000"]);

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row ?? {})) {
    const s = typeof v === "string" ? v.trim() : v;
    out[k] = typeof s === "string" && PLACEHOLDERS.has(s) ? "" : s;
  }
  return out;
}

/** Label + From/To pair, aligned on wide screens and stacked on mobile. */
function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label className="block text-xs font-semibold text-foreground">{label}</Label>
      <div className="grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {children}
      </div>
    </div>
  );
}

function ToSeparator() {
  return (
    <span className="hidden px-0.5 text-center text-[11px] font-medium uppercase text-muted-foreground sm:block">
      to
    </span>
  );
}

function DateField({
  value,
  onChange,
  placeholder,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full min-w-0 justify-start gap-2 text-left font-normal shadow-none",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">
            {value ? format(value, "dd-MM-yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function ZgpReportPage() {
  const [docType, setDocType] = useState<RangeState>(EMPTY);
  const [gatePass, setGatePass] = useState<RangeState>(EMPTY);
  const [plant, setPlant] = useState<RangeState>(EMPTY);
  const [material, setMaterial] = useState<RangeState>(EMPTY);
  const [vendor, setVendor] = useState<RangeState>(EMPTY);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [executed, setExecuted] = useState(false);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [rawRows, setRawRows] = useState<DataRow[]>([]);
  const [lastFilters, setLastFilters] = useState<ZgpFilters | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<SapResponseDialogState | null>(null);

  const runFetch = useServerFn(fetchZgpReport);
  const runCancel = useServerFn(cancelZgpRecords);
  const report = useMutation({
    mutationFn: (vars: ZgpFilters) => runFetch({ data: vars }),
  });
  const cancelMut = useMutation({
    mutationFn: (vars: { filters: ZgpFilters; rows: DataRow[] }) => runCancel({ data: vars }),
  });

  function reset() {
    setDocType(EMPTY);
    setGatePass(EMPTY);
    setPlant(EMPTY);
    setMaterial(EMPTY);
    setVendor(EMPTY);
    setDateFrom(undefined);
    setDateTo(undefined);
    setExecuted(false);
    setRows([]);
    setSelected(new Set());
  }

  function showMessage(message: string) {
    setDialog({
      open: true,
      title: "ZGP Report",
      refLabel: "Report",
      results: [{ ref: "ZGP Report", message, ok: false }],
    });
  }

  async function execute() {
    setExecuted(true);
    setRows([]);
    setSelected(new Set());
    try {
      const res = await report.mutateAsync({
        type_from: docType.from.trim(),
        type_to: docType.to.trim(),
        number_from: gatePass.from.trim(),
        number_to: gatePass.to.trim(),
        material_from: material.from.trim(),
        material_to: material.to.trim(),
        date_from: dateFrom ? format(dateFrom, "yyyy-MM-dd") : "",
        date_to: dateTo ? format(dateTo, "yyyy-MM-dd") : "",
        plant_from: plant.from.trim(),
        plant_to: plant.to.trim(),
        vendor_from: vendor.from.trim(),
        vendor_to: vendor.to.trim(),
      });
      if (res.error || res.sapMessage) {
        showMessage(res.sapMessage ?? res.error ?? "No records returned by SAP.");
        return;
      }
      setRows((res.rows as DataRow[]).map(normalizeRow));
    } catch (e) {
      showMessage((e as Error).message || "Could not fetch the ZGP report.");
    }
  }

  const columns = useMemo(
    () =>
      buildDynamicColumns<DataRow>(rows, {
        headerLabels: HEADER_LABELS,
        textKeys: TEXT_KEYS,
        numericKeys: NUMERIC_KEYS,
      }),
    [rows],
  );

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="MM Approvals"
        title="ZGP Report"
        subtitle="RGP and NRGP status report — filter gate pass records by document, plant, material, date or vendor."
      />

      <Card className="overflow-hidden p-0 shadow-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-muted/30 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-card text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">Report filters</h2>
              <p className="truncate text-xs text-muted-foreground">Selection screen</p>
            </div>
          </div>
          <span className="hidden text-[11px] font-semibold uppercase text-muted-foreground sm:block">
            From / To
          </span>
        </div>

        <div className="grid gap-x-6 gap-y-4 px-4 py-5 sm:px-5 lg:grid-cols-2 lg:gap-y-5">
          <FilterRow label="RGP/NRGP">
            <Select
              value={docType.from || "__all"}
              onValueChange={(v) => setDocType((s) => ({ ...s, from: v === "__all" ? "" : v }))}
            >
              <SelectTrigger className="h-10 text-xs shadow-none">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All</SelectItem>
                <SelectItem value="RGP">RGP — Returnable gate pass</SelectItem>
                <SelectItem value="NRGP">NRGP — Non returnable gate pass</SelectItem>
              </SelectContent>
            </Select>
            <ToSeparator />
            <Input
              value={docType.to}
              onChange={(e) => setDocType((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-10 text-xs uppercase shadow-none"
            />
          </FilterRow>

          <FilterRow label="Gate Pass Number">
            <Input
              value={gatePass.from}
              onChange={(e) => setGatePass((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-10 font-mono text-xs shadow-none"
            />
            <ToSeparator />
            <Input
              value={gatePass.to}
              onChange={(e) => setGatePass((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-10 font-mono text-xs shadow-none"
            />
          </FilterRow>

          <FilterRow label="Plant">
            <Input
              value={plant.from}
              onChange={(e) => setPlant((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-10 font-mono text-xs shadow-none"
            />
            <ToSeparator />
            <Input
              value={plant.to}
              onChange={(e) => setPlant((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-10 font-mono text-xs shadow-none"
            />
          </FilterRow>

          <FilterRow label="Material">
            <Input
              value={material.from}
              onChange={(e) => setMaterial((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-10 font-mono text-xs shadow-none"
            />
            <ToSeparator />
            <Input
              value={material.to}
              onChange={(e) => setMaterial((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-10 font-mono text-xs shadow-none"
            />
          </FilterRow>

          <FilterRow label="Date">
            <DateField value={dateFrom} onChange={setDateFrom} placeholder="From date" />
            <ToSeparator />
            <DateField value={dateTo} onChange={setDateTo} placeholder="To date" />
          </FilterRow>

          <FilterRow label="Vendor">
            <Input
              value={vendor.from}
              onChange={(e) => setVendor((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-10 font-mono text-xs shadow-none"
            />
            <ToSeparator />
            <Input
              value={vendor.to}
              onChange={(e) => setVendor((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-10 font-mono text-xs shadow-none"
            />
          </FilterRow>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3 sm:px-5">
          <Button
            variant="outline"
            onClick={reset}
            disabled={report.isPending}
            className="h-9 gap-2 shadow-none"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button
            onClick={() => void execute()}
            disabled={report.isPending}
            className="h-9 gap-2 px-5 shadow-sm"
          >
            {report.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {report.isPending ? "Executing…" : "Execute"}
          </Button>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable<DataRow>
          title="ZGP Report Results"
          countLabel={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
          rows={rows}
          columns={columns}
          loading={report.isPending}
          rowKey={(r, i) => `${r.UNIQUE_NO ?? "row"}-${i}`}
          emptyMessage="No records found for the selected filters."
          pageSize={20}
          showSelect
          selectedKeys={selected}
          onSelectionChange={setSelected}
          headerExtras={
            <Button
              variant="destructive"
              size="sm"
              disabled={selected.size === 0 || report.isPending}
              onClick={() =>
                showMessage(
                  "The cancel service is not connected yet. Share the ZGP cancel API details to enable this action.",
                )
              }
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              {`Cancel${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </Button>
          }
        />
      )}

      <SapResponseDialog
        dialog={dialog}
        onOpenChange={(open) => setDialog((d) => (d ? { ...d, open } : d))}
        defaultTitle="ZGP Report"
      />
    </div>
  );
}
