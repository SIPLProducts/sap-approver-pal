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
import { fetchZgpReport } from "@/lib/mm/zgp-report.functions";
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
  const [rows] = useState<DataRow[]>([]);

  function reset() {
    setDocType(EMPTY);
    setGatePass(EMPTY);
    setPlant(EMPTY);
    setMaterial(EMPTY);
    setVendor(EMPTY);
    setDateFrom(undefined);
    setDateTo(undefined);
    setExecuted(false);
  }

  const columns = useMemo<CloudscapeColumn<DataRow>[]>(
    () => [
      { id: "RGP_NRGP", header: "RGP/NRGP", minWidth: 120, cell: (r) => r.RGP_NRGP ?? "—" },
      {
        id: "GATE_PASS_NUMBER",
        header: "Gate Pass Number",
        minWidth: 160,
        cell: (r) => r.GATE_PASS_NUMBER ?? "—",
      },
      { id: "PLANT", header: "Plant", minWidth: 100, cell: (r) => r.PLANT ?? "—" },
      { id: "MATERIAL", header: "Material", minWidth: 140, cell: (r) => r.MATERIAL ?? "—" },
      { id: "DATE", header: "Date", minWidth: 120, cell: (r) => r.DATE ?? "—" },
      { id: "VENDOR", header: "Vendor", minWidth: 140, cell: (r) => r.VENDOR ?? "—" },
    ],
    [],
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
          <Button variant="outline" onClick={reset} className="h-9 gap-2 shadow-none">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button onClick={() => setExecuted(true)} className="h-9 gap-2 px-5 shadow-sm">
            <Play className="h-3.5 w-3.5" /> Execute
          </Button>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable<DataRow>
          title="ZGP Report Results"
          countLabel={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
          rows={rows}
          columns={columns}
          rowKey={(r, i) => String(r.GATE_PASS_NUMBER ?? i)}
          emptyMessage="The ZGP report service is not connected yet — no records can be fetched from SAP for these filters."
          pageSize={20}
        />
      )}
    </div>
  );
}
