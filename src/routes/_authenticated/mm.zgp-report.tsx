import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarIcon, Filter, Play, RotateCcw } from "lucide-react";
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
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";
import { PageHeader } from "@/components/exec/page-header";
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
    <div className="grid gap-1.5 md:grid-cols-[180px_minmax(0,1fr)] md:items-center md:gap-4">
      <Label className="text-xs font-medium text-muted-foreground md:text-right">{label}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        {children}
      </div>
    </div>
  );
}

function ToSeparator() {
  return <span className="px-1 text-xs text-muted-foreground">to</span>;
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
            "h-9 w-full justify-start gap-2 text-left font-normal",
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

      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="space-y-3">
          <FilterRow label="RGP/NRGP">
            <Select
              value={docType.from || "__all"}
              onValueChange={(v) => setDocType((s) => ({ ...s, from: v === "__all" ? "" : v }))}
            >
              <SelectTrigger className="h-9 text-xs">
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
              className="h-9 text-xs uppercase"
            />
          </FilterRow>

          <FilterRow label="Gate Pass Number">
            <Input
              value={gatePass.from}
              onChange={(e) => setGatePass((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-9 font-mono text-xs"
            />
            <ToSeparator />
            <Input
              value={gatePass.to}
              onChange={(e) => setGatePass((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-9 font-mono text-xs"
            />
          </FilterRow>

          <FilterRow label="Plant">
            <Input
              value={plant.from}
              onChange={(e) => setPlant((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-9 font-mono text-xs"
            />
            <ToSeparator />
            <Input
              value={plant.to}
              onChange={(e) => setPlant((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-9 font-mono text-xs"
            />
          </FilterRow>

          <FilterRow label="Material">
            <Input
              value={material.from}
              onChange={(e) => setMaterial((s) => ({ ...s, from: e.target.value }))}
              placeholder="From"
              className="h-9 font-mono text-xs"
            />
            <ToSeparator />
            <Input
              value={material.to}
              onChange={(e) => setMaterial((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-9 font-mono text-xs"
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
              className="h-9 font-mono text-xs"
            />
            <ToSeparator />
            <Input
              value={vendor.to}
              onChange={(e) => setVendor((s) => ({ ...s, to: e.target.value }))}
              placeholder="To"
              className="h-9 font-mono text-xs"
            />
          </FilterRow>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={() => setExecuted(true)} className="gap-2">
            <Play className="h-3.5 w-3.5" /> Execute
          </Button>
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
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
