import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { CalendarIcon, Filter, Loader2, Play, RotateCcw } from "lucide-react";
import { format } from "date-fns";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import {
  SapResponseDialog,
  type SapResponseDialogState,
} from "@/components/mm/sap-response-dialog";
import { PageHeader } from "@/components/exec/page-header";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import { fetchZmcReport } from "@/lib/mm/zmc-report.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mm/zmc-report")({
  head: () => ({
    meta: [
      { title: "ZMC Report — Material Reservation Status" },
      {
        name: "description",
        content: "Filter and review material reservation status records by plant, date, document and movement type.",
      },
      { property: "og:title", content: "ZMC Report — Material Reservation Status" },
      {
        property: "og:description",
        content: "Filter and review material reservation status records by plant, date, document and movement type.",
      },
    ],
  }),
  component: ZmcReportPage,
});

type DataRow = Record<string, any>;

type RangeState = { from: string; to: string };

const EMPTY: RangeState = { from: "", to: "" };

type ZmcFilters = {
  plant_from: string;
  plant_to: string;
  date_from: string;
  date_to: string;
  doc_from: string;
  doc_to: string;
  type_from: string;
  type_to: string;
};

/** Readable headers for the documented ZMC report keys. */
const HEADER_LABELS: Record<string, string> = {
  DOCUMENT_NO: "Document Number",
  PLANT: "Plant",
  MATERIAL: "Material Number",
  MATERIAL_DESCRIPTION: "Material Description",
  REQUESTED_QUANTITY: "Requested Quantity",
  UOM: "Unit",
  CREATED_ON: "Created On",
  STORAGE_LOCATION: "Storage Location",
  ORDER_NUMBER: "Order Number",
  HOD_APRROVAL: "HOD Approval",
  HOD_APPROVAL: "HOD Approval",
  HOD_REJECTION: "HOD Rejection",
  HOD_APPROVAL_DATE: "HOD Approval Date",
  GL_ACCOUNT: "GL Account",
  MOVEMENT_TYPE: "Movement Type",
  COST_CENTER: "Cost Center",
  APPROVED_QUANTITY: "Approved Quantity",
  ISSUED_QUANTITY: "Issued Quantity",
  SAP_REVERVATION_NO: "Reservation Number",
  SAP_MATERIAL_DOCUMENT: "Material Document",
  ZEILE: "Material Document Item",
  REVERSAL_NO: "Reversal No",
  POSTED_BY: "Posted By",
  POSTED_ON: "Posted On",
  VALUE: "Net Value",
  CANCEL: "Cancel Status",
  CANCELED_BY: "Canceled By",
  CANCELED_ON: "Canceled On",
  CANCELED_TIME: "Canceled Time",
};

const TEXT_KEYS = [
  "DOCUMENT_NO",
  "PLANT",
  "MATERIAL",
  "MOVEMENT_TYPE",
  "COST_CENTER",
  "GL_ACCOUNT",
  "STORAGE_LOCATION",
  "ORDER_NUMBER",
  "SAP_MATERIAL_DOCUMENT",
  "SAP_REVERVATION_NO",
  "ZEILE",
  "REVERSAL_NO",
  "UOM",
  "HOD_APRROVAL",
  "HOD_APPROVAL",
  "HOD_REJECTION",
  "CANCEL",
  "CANCELED_TIME",
  "POSTED_BY",
  "CANCELED_BY",
];

const NUMERIC_KEYS = ["REQUESTED_QUANTITY", "APPROVED_QUANTITY", "ISSUED_QUANTITY", "VALUE"];

/** SAP placeholder values ("0000-00-00", "00:00:00") display as a dash. */
const PLACEHOLDERS = new Set(["0000-00-00", "00000000", "00:00:00", "0000-00:00"]);

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row ?? {})) {
    const s = typeof v === "string" ? v.trim() : v;
    out[k] = typeof s === "string" && PLACEHOLDERS.has(s) ? "" : s;
  }
  return out;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
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

const calendarStyles = {
  nav: "absolute inset-x-2 top-2 flex w-auto items-center justify-between gap-1",
  button_previous:
    "h-(--cell-size) w-(--cell-size) rounded-lg border border-border bg-background p-0 hover:bg-muted aria-disabled:opacity-50",
  button_next:
    "h-(--cell-size) w-(--cell-size) rounded-lg border border-border bg-background p-0 hover:bg-muted aria-disabled:opacity-50",
  month_caption: "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
  caption_label: "text-sm font-medium select-none",
  weekday:
    "text-muted-foreground flex-1 select-none text-center text-[0.8rem] font-normal",
  outside: "text-muted-foreground/40 pointer-events-none",
  today: "border border-border rounded-md text-foreground bg-transparent",
};

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
            "h-10 w-full min-w-0 justify-start gap-1.5 text-left font-normal shadow-none",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3 w-3 shrink-0 opacity-60" />
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
          className={cn("p-2 pointer-events-auto [--cell-size:1.75rem]")}
          classNames={calendarStyles}
        />
      </PopoverContent>
    </Popover>
  );
}

function ZmcReportPage() {
  const [plant, setPlant] = useState<RangeState>(EMPTY);
  const [docNumber, setDocNumber] = useState<RangeState>(EMPTY);
  const [movementType, setMovementType] = useState<RangeState>(EMPTY);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [executed, setExecuted] = useState(false);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<SapResponseDialogState | null>(null);

  const runFetch = useServerFn(fetchZmcReport);
  const report = useMutation({
    mutationFn: (vars: ZmcFilters) => runFetch({ data: vars }),
  });

  function reset() {
    setPlant(EMPTY);
    setDocNumber(EMPTY);
    setMovementType(EMPTY);
    setDateFrom(undefined);
    setDateTo(undefined);
    setExecuted(false);
    setRows([]);
    setSelected(new Set());
  }

  function showMessage(message: string) {
    setDialog({
      open: true,
      title: "ZMC Report",
      refLabel: "Report",
      results: [{ ref: "ZMC Report", message, ok: false }],
    });
  }

  async function execute() {
    setExecuted(true);
    setRows([]);
    setSelected(new Set());
    try {
      const res = await report.mutateAsync({
        plant_from: plant.from.trim(),
        plant_to: plant.to.trim(),
        date_from: dateFrom ? format(dateFrom, "yyyy-MM-dd") : "",
        date_to: dateTo ? format(dateTo, "yyyy-MM-dd") : "",
        doc_from: docNumber.from.trim(),
        doc_to: docNumber.to.trim(),
        type_from: movementType.from.trim(),
        type_to: movementType.to.trim(),
      });
      if (res.error || res.sapMessage) {
        showMessage(res.sapMessage ?? res.error ?? "No records returned by SAP.");
        return;
      }
      setRows((res.rows as DataRow[]).map(normalizeRow));
    } catch (e) {
      showMessage((e as Error).message || "Could not fetch the ZMC report.");
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
        title="ZMC Report"
        subtitle="Material reservation status report — filter records by plant, date, document number or movement type."
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

          <FilterRow label="Date">
            <DateField value={dateFrom} onChange={setDateFrom} placeholder="From date" />
            <ToSeparator />
            <DateField value={dateTo} onChange={setDateTo} placeholder="To date" />
          </FilterRow>

          <FilterRow label="Document Number">
            <Input
              value={docNumber.from}
              onChange={(e) => setDocNumber((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-10 font-mono text-xs shadow-none"
            />
            <ToSeparator />
            <Input
              value={docNumber.to}
              onChange={(e) => setDocNumber((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-10 font-mono text-xs shadow-none"
            />
          </FilterRow>

          <FilterRow label="Movement Type">
            <Input
              value={movementType.from}
              onChange={(e) => setMovementType((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-10 font-mono text-xs uppercase shadow-none"
            />
            <ToSeparator />
            <Input
              value={movementType.to}
              onChange={(e) => setMovementType((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-10 font-mono text-xs uppercase shadow-none"
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
          title="ZMC Report Results"
          countLabel={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
          rows={rows}
          columns={columns}
          loading={report.isPending}
          rowKey={(r, i) => `${r.DOCUMENT_NO ?? r.DOCUMENT_NUMBER ?? "row"}-${i}`}
          emptyMessage="No records found for the selected filters."
          pageSize={20}
        />
      )}

      <SapResponseDialog
        dialog={dialog}
        onOpenChange={(open) => setDialog((d) => (d ? { ...d, open } : d))}
        defaultTitle="ZMC Report"
      />
    </div>
  );
}
