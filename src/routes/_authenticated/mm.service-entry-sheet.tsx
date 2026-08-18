import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Filter, Info, KeyRound, ListChecks, Loader2, RotateCcw, Search } from "lucide-react";

import type { CloudscapeColumn } from "@/components/aws/cloudscape-approval-table";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import {
  fetchServiceEntrySheetPending,
  releaseServiceEntrySheets,
  rejectServiceEntrySheets,
  deleteServiceEntrySheets,
} from "@/lib/mm/ses.functions";




import { PageHeader } from "@/components/exec/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlantSelect } from "@/components/sap/plant-select";
import { useActiveContext, releaseKeysFor } from "@/hooks/use-active-context";

export const Route = createFileRoute("/_authenticated/mm/service-entry-sheet")({
  head: () => ({
    meta: [
      { title: "Service Entry Sheet Release — SAP Approvals" },
      {
        name: "description",
        content:
          "Select release code, PO data and entry sheet data to list service entry sheets pending release.",
      },
      { property: "og:title", content: "Service Entry Sheet Release — SAP Approvals" },
      {
        property: "og:description",
        content: "Service entry sheet selection screen for release and acceptance processing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServiceEntrySheetPage,
});

type RangeField = {
  key: string;
  label: string;
  type?: "text" | "date";
  wide?: boolean;
  component?: "plant";
};

const PO_FIELDS: RangeField[] = [
  { key: "EBELN", label: "Purchase Order", wide: true },
  { key: "BEDAT", label: "Document Date", type: "date" },
  { key: "BSART", label: "Document Type" },
  { key: "LIFNR", label: "Supplier", wide: true },
  { key: "EKORG", label: "Purchasing Organization" },
  { key: "EKGRP", label: "Purchasing Group" },
  { key: "WERKS", label: "Plant", component: "plant" },
  { key: "MATKL", label: "Material/Service Group" },
];

const ENTRY_SHEET_FIELDS: RangeField[] = [
  { key: "LBLNI", label: "Entry Sheet", wide: true },
  { key: "LBLNE", label: "External Number", wide: true },
  { key: "ERDAT", label: "Created on", type: "date" },
  { key: "PACKNO", label: "Model Service Specifications" },
  { key: "BANFN", label: "Purchase Requisition" },
  { key: "WARPL", label: "Maintenance Plan" },
  { key: "FKNUM", label: "Freight Cost Document" },
];

type RangeState = Record<string, { from: string; to: string }>;

const BLANK = "__blank__";

const SES_HEADER_LABELS: Record<string, string> = {
  relCode: "Release Code",
  relGrp: "Release Group",
  purOrder: "Purchase Order Number",
  porg: "Purchasing Organization",
  pgrp: "Purchasing Group",
  supplier: "Supplier / Vendor Code",
  name: "Supplier / Vendor Name",
  currency: "Currency",
  poDate: "PO Date",
  poItem: "PO Item",
  plant: "Plant",
  finEntPo: "Final Entry Indicator (PO)",
  matGrp: "Material Group",
  shTextPo: "PO Short Text",
  netValuePo: "PO Net Value",
  delDate: "Delivery Date",
  entrySh: "Entry Sheet Number",
  accIn: "Acceptance Indicator",
  finEnt: "Final Entry Indicator",
  blkgInd: "Blocking Indicator",
  shText: "Entry Sheet Short Text",
  netValue: "Entry Sheet Net Value",
  crDate: "Created On",
  relStr: "Release Strategy",
  relIn: "Release / Acceptance Status",
  releaseOption: "Release Option",
};

function emptyRanges(fields: RangeField[]): RangeState {
  return Object.fromEntries(fields.map((f) => [f.key, { from: "", to: "" }]));
}

function RangeRows({
  fields,
  state,
  onChange,
  disabled,
}: {
  fields: RangeField[];
  state: RangeState;
  onChange: (key: string, part: "from" | "to", value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {fields.map((f) => (
        <div
          key={f.key}
          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_minmax(0,1fr)]"
        >
          <Label className="text-xs text-muted-foreground sm:text-sm">{f.label}</Label>
          {f.component === "plant" ? (
            <PlantSelect
              value={state[f.key]?.from ?? ""}
              onChange={(v) => onChange(f.key, "from", v)}
              disabled={disabled}
              source="user-plant"
              className="text-sm"
            />
          ) : (
            <Input
              type={f.type === "date" ? "date" : "text"}
              value={state[f.key]?.from ?? ""}
              onChange={(e) => onChange(f.key, "from", e.target.value)}
              disabled={disabled}
              className="h-9 text-sm"
              aria-label={`${f.label} from`}
            />
          )}
          <span className="hidden text-xs text-muted-foreground sm:block">to</span>
          {f.component === "plant" ? (
            <PlantSelect
              value={state[f.key]?.to ?? ""}
              onChange={(v) => onChange(f.key, "to", v)}
              disabled={disabled}
              source="user-plant"
              className="text-sm"
            />
          ) : (
            <Input
              type={f.type === "date" ? "date" : "text"}
              value={state[f.key]?.to ?? ""}
              onChange={(e) => onChange(f.key, "to", e.target.value)}
              disabled={disabled}
              className="h-9 text-sm"
              aria-label={`${f.label} to`}
            />
          )}

        </div>
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Filter; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </div>
  );
}

function ServiceEntrySheetPage() {
  const { plants: assignedPlants, activePlants } = useActiveContext();

  const sesKeys = useMemo(
    () => releaseKeysFor(assignedPlants, "ses", activePlants),
    [assignedPlants, activePlants.join(",")],
  );

  const codes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of sesKeys) {
      if (seen.has(k.releaseCode)) continue;
      seen.add(k.releaseCode);
      out.push(k.releaseCode);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [sesKeys]);

  const [releaseCode, setReleaseCode] = useState("");
  const [releaseGroup, setReleaseGroup] = useState("");
  const [setRelease, setSetRelease] = useState(false);
  const [cancelRelease, setCancelRelease] = useState(false);

  const [poRanges, setPoRanges] = useState<RangeState>(() => emptyRanges(PO_FIELDS));
  const [entryRanges, setEntryRanges] = useState<RangeState>(() => emptyRanges(ENTRY_SHEET_FIELDS));

  const [blocking, setBlocking] = useState("");
  const [acceptance, setAcceptance] = useState("");

  const [scopeOfList, setScopeOfList] = useState("ENTRY_REL");

  const [messageDialog, setMessageDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    lines?: { entrySheet: string; ok: boolean; message: string }[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const runFetch = useServerFn(fetchServiceEntrySheetPending);
  const runRelease = useServerFn(releaseServiceEntrySheets);
  const runReject = useServerFn(rejectServiceEntrySheets);
  const runDelete = useServerFn(deleteServiceEntrySheets);



  const columns: CloudscapeColumn<Record<string, any>>[] = useMemo(
    () => buildDynamicColumns<Record<string, any>>(rows, { headerLabels: SES_HEADER_LABELS }),
    [rows],
  );
  const rowKey = (r: Record<string, any>, i: number) =>
    `${r?.entrySh ?? ""}-${r?.purOrder ?? ""}-${r?.poItem ?? ""}-${i}`;
  const allKeys = useMemo(() => rows.map((r, i) => rowKey(r, i)), [rows]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.has(k));
  const someSelected = !allSelected && allKeys.some((k) => selectedKeys.has(k));

  function toggleAll(next: boolean) {
    setSelectedKeys(next ? new Set(allKeys) : new Set());
  }
  function toggleRow(key: string, next: boolean) {
    setSelectedKeys((prev) => {
      const s = new Set(prev);
      if (next) s.add(key);
      else s.delete(key);
      return s;
    });
  }

  const hasKeys = codes.length > 0;


  function updatePo(key: string, part: "from" | "to", value: string) {
    setPoRanges((p) => ({ ...p, [key]: { ...p[key], [part]: value } }));
  }
  function updateEntry(key: string, part: "from" | "to", value: string) {
    setEntryRanges((p) => ({ ...p, [key]: { ...p[key], [part]: value } }));
  }

  function onGroupPick(v: string) {
    setReleaseGroup(v === BLANK ? "" : v);
  }

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of sesKeys) {
      if (releaseCode && k.releaseCode !== releaseCode) continue;
      if (seen.has(k.relGroup)) continue;
      seen.add(k.relGroup);
      out.push(k.relGroup);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [sesKeys, releaseCode]);

  function reset() {
    setReleaseCode("");
    setReleaseGroup("");
    setSetRelease(false);
    setCancelRelease(false);
    setPoRanges(emptyRanges(PO_FIELDS));
    setEntryRanges(emptyRanges(ENTRY_SHEET_FIELDS));
    setBlocking("");
    setAcceptance("");

    setScopeOfList("ENTRY_REL");
    setRows([]);
    setSelectedKeys(new Set());
    setHasRun(false);
  }


  async function execute(opts?: { silent?: boolean }) {
    if (!releaseCode) {
      setMessageDialog({
        open: true,
        title: "Service Entry Sheet",
        message: "Please select a Release Code before running the selection.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await runFetch({
        data: {
          releaseCode,
          releaseGroup,
          releaseFilter: cancelRelease ? "CANCEL_RELEASE" : "SET_RELEASE",
          poFrom: poRanges.EBELN?.from ?? "",
          poTo: poRanges.EBELN?.to ?? "",
          docDateFrom: poRanges.BEDAT?.from ?? "",
          docDateTo: poRanges.BEDAT?.to ?? "",
          purchOrgFrom: poRanges.EKORG?.from ?? "",
          purchOrgTo: poRanges.EKORG?.to ?? "",
          purchGroupFrom: poRanges.EKGRP?.from ?? "",
          purchGroupTo: poRanges.EKGRP?.to ?? "",
          plantFrom: poRanges.WERKS?.from ?? "",
          plantTo: poRanges.WERKS?.to ?? "",
          matGroupFrom: poRanges.MATKL?.from ?? "",
          matGroupTo: poRanges.MATKL?.to ?? "",
          entrySheetFrom: entryRanges.LBLNI?.from ?? "",
          entrySheetTo: entryRanges.LBLNI?.to ?? "",
          blockedFilter:
            blocking === "blocked" ? "BLOCKED" : blocking === "not_blocked" ? "NOT_BLOCKED" : "ALL",
          acceptedFilter:
            acceptance === "accepted"
              ? "ACCEPTED"
              : acceptance === "not_accepted"
                ? "NOT_ACCEPTED"
                : "ALL",
          scopeOfList,
        },
      });

      if (res.error) {
        setRows([]);
        setSelectedKeys(new Set());
        setHasRun(false);
        if (!opts?.silent) {
          setMessageDialog({ open: true, title: "Service Entry Sheet", message: res.error });
        }
        return;
      }
      setRows(res.data ?? []);
      setSelectedKeys(new Set());
      setHasRun(true);
      if (res.message && !opts?.silent) {
        setMessageDialog({ open: true, title: "Service Entry Sheet", message: res.message });
      }
      if (!opts?.silent) {
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (e) {
      setRows([]);
      setSelectedKeys(new Set());
      setHasRun(false);
      if (!opts?.silent) {
        setMessageDialog({
          open: true,
          title: "Service Entry Sheet",
          message: (e as Error).message || "Could not fetch service entry sheets.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function doRelease() {
    const items = rows
      .map((r, i) => ({ r, key: rowKey(r, i) }))
      .filter(({ key }) => selectedKeys.has(key))
      .map(({ r }) => ({
        entrySheet: String(r?.entrySh ?? "").trim(),
        releaseCode: String(r?.relCode ?? releaseCode ?? "").trim(),
      }))
      .filter((it) => it.entrySheet && it.releaseCode);

    if (items.length === 0) {
      setMessageDialog({
        open: true,
        title: "Release",
        message: "Selected rows have no Entry Sheet / Release Code to release.",
      });
      return;
    }

    setReleasing(true);
    try {
      const res = await runRelease({ data: { items } });
      if (res.error) {
        setMessageDialog({ open: true, title: "Release", message: res.error });
        return;
      }
      setMessageDialog({
        open: true,
        title: "Release",
        message: "",
        lines: res.results ?? [],
      });
    } catch (e) {
      setMessageDialog({
        open: true,
        title: "Release",
        message: (e as Error).message || "Could not release the selected entry sheets.",
      });
    } finally {
      setReleasing(false);
    }
  }
  async function doReject() {
    const items = rows
      .map((r, i) => ({ r, key: rowKey(r, i) }))
      .filter(({ key }) => selectedKeys.has(key))
      .map(({ r }) => ({
        entrySheet: String(r?.entrySh ?? "").trim(),
        releaseCode: String(r?.relCode ?? releaseCode ?? "").trim(),
      }))
      .filter((it) => it.entrySheet && it.releaseCode);

    if (items.length === 0) {
      setMessageDialog({
        open: true,
        title: "Reject",
        message: "Selected rows have no Entry Sheet / Release Code to reject.",
      });
      return;
    }

    setRejecting(true);
    try {
      const res = await runReject({ data: { items } });
      if (res.error) {
        setMessageDialog({ open: true, title: "Reject", message: res.error });
        return;
      }
      setMessageDialog({
        open: true,
        title: "Reject",
        message: "",
        lines: res.results ?? [],
      });
    } catch (e) {
      setMessageDialog({
        open: true,
        title: "Reject",
        message: (e as Error).message || "Could not reject the selected entry sheets.",
      });
    } finally {
      setRejecting(false);
    }
  }

  async function doDelete() {
    const items = rows
      .map((r, i) => ({ r, key: rowKey(r, i) }))
      .filter(({ key }) => selectedKeys.has(key))
      .map(({ r }) => ({
        entrySheet: String(r?.entrySh ?? "").trim(),
      }))
      .filter((it) => it.entrySheet);

    if (items.length === 0) {
      setMessageDialog({
        open: true,
        title: "Delete",
        message: "Selected rows have no Entry Sheet to delete.",
      });
      return;
    }

    setDeleting(true);
    try {
      const res = await runDelete({ data: { items } });
      if (res.error) {
        setMessageDialog({ open: true, title: "Delete", message: res.error });
        return;
      }
      setMessageDialog({
        open: true,
        title: "Delete",
        message: "",
        lines: res.results ?? [],
      });
    } catch (e) {
      setMessageDialog({
        open: true,
        title: "Delete",
        message: (e as Error).message || "Could not delete the selected entry sheets.",
      });
    } finally {
      setDeleting(false);
    }
  }




  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="MM Approvals"
        title="Service Entry Sheet"
        subtitle="Select release, purchase order and entry sheet criteria to list service entry sheets."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reset} disabled={loading}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={() => execute()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-2 h-3.5 w-3.5" />
              )}
              {loading ? "Executing…" : "Execute"}
            </Button>

          </>
        }
      />

      {/* Release */}
      <Card className="p-4">
        <SectionTitle icon={KeyRound}>Release</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Release Code</Label>
            <Select
              value={codes.includes(releaseCode) ? releaseCode : ""}
              onValueChange={(v) => {
                setReleaseCode(v);
                setReleaseGroup("");
              }}
              disabled={!hasKeys}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={hasKeys ? "Select code" : "No keys assigned"} />
              </SelectTrigger>
              <SelectContent>
                {codes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Release Group</Label>
            <Select
              value={groups.includes(releaseGroup) ? releaseGroup || BLANK : ""}
              onValueChange={onGroupPick}
              disabled={!hasKeys || groups.length === 0}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue
                  placeholder={
                    !hasKeys ? "No keys assigned" : releaseCode ? "Select group" : "Select code first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g || BLANK} value={g || BLANK}>
                    {g || "(blank)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={setRelease}
                onCheckedChange={(v) => {
                  const next = v === true;
                  setSetRelease(next);
                  if (next) setCancelRelease(false);
                }}
              />
              Set Release
            </label>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={cancelRelease}
                onCheckedChange={(v) => {
                  const next = v === true;
                  setCancelRelease(next);
                  if (next) setSetRelease(false);
                }}
              />
              Cancel Release
            </label>
          </div>
        </div>
      </Card>

      {/* PO Data */}
      <Card className="p-4">
        <SectionTitle icon={Filter}>PO Data</SectionTitle>
        <RangeRows fields={PO_FIELDS} state={poRanges} onChange={updatePo} />
      </Card>

      {/* Entry Sheet Data */}
      <Card className="p-4">
        <SectionTitle icon={ListChecks}>Entry Sheet Data</SectionTitle>
        <RangeRows fields={ENTRY_SHEET_FIELDS} state={entryRanges} onChange={updateEntry} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle icon={Filter}>Blocking Indicator</SectionTitle>
          <RadioGroup value={blocking} onValueChange={setBlocking} className="space-y-2">
            {[
              { v: "not_blocked", l: "Not Blocked" },
              { v: "blocked", l: "Blocked" },
              { v: "all", l: "All" },
            ].map((o) => (
              <label key={o.v} className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value={o.v} id={`blocking-${o.v}`} />
                {o.l}
              </label>
            ))}
          </RadioGroup>
        </Card>

        <Card className="p-4">
          <SectionTitle icon={Filter}>Acceptance Indicator</SectionTitle>
          <RadioGroup value={acceptance} onValueChange={setAcceptance} className="space-y-2">
            {[
              { v: "not_accepted", l: "Not Accepted" },
              { v: "accepted", l: "Accepted" },
              { v: "all", l: "All" },
            ].map((o) => (
              <label key={o.v} className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value={o.v} id={`acceptance-${o.v}`} />
                {o.l}
              </label>
            ))}
          </RadioGroup>
        </Card>
      </div>

      {/* Scope of List */}
      <Card className="p-4">
        <SectionTitle icon={ListChecks}>Scope of List</SectionTitle>
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,320px)]">
          <Label className="text-xs text-muted-foreground sm:text-sm">Scope of List</Label>
          <Input
            value={scopeOfList}
            onChange={(e) => setScopeOfList(e.target.value)}
            className="h-9 font-mono text-sm"
            aria-label="Scope of List"
          />
        </div>
      </Card>

      {/* Results */}
      {hasRun && (
        <Card ref={resultsRef} className="p-0 scroll-mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" /> Entry Sheets
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {rows.length} record{rows.length === 1 ? "" : "s"} · {selectedKeys.size} selected
              </span>
              <Button
                variant="success"
                size="sm"
                disabled={selectedKeys.size === 0 || releasing}
                onClick={doRelease}
              >
                {releasing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Release
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedKeys.size === 0 || rejecting}
                onClick={doReject}
              >
                {rejecting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Reject
              </Button>

              <Button
                variant="destructive"
                size="sm"
                disabled={selectedKeys.size === 0 || deleting}
                onClick={doDelete}
              >
                {deleting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Delete
              </Button>

            </div>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No entry sheets found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-10 whitespace-nowrap px-3 py-2 text-left">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleAll(v === true)}
                        aria-label="Select all entry sheets"
                      />
                    </th>
                    {columns.map((c) => (
                      <th
                        key={c.id}
                        style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                        className={`whitespace-nowrap px-3 py-2 text-xs font-semibold ${
                          c.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const key = rowKey(r, i);
                    return (
                      <tr key={key} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2">
                          <Checkbox
                            checked={selectedKeys.has(key)}
                            onCheckedChange={(v) => toggleRow(key, v === true)}
                            aria-label={`Select ${key}`}
                          />
                        </td>
                        {columns.map((c) => (
                          <td
                            key={c.id}
                            className={`whitespace-nowrap px-3 py-2 ${
                              c.align === "right" ? "text-right tabular-nums" : ""
                            }`}
                          >
                            {c.cell(r)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}



      <Dialog
        open={!!messageDialog?.open}
        onOpenChange={(o) => setMessageDialog((p) => (p ? { ...p, open: o } : p))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" /> {messageDialog?.title}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-foreground">
              {messageDialog?.lines?.length ? (
                <span className="block space-y-2">
                  {messageDialog.lines.map((l, i) => (
                    <span key={`${l.entrySheet}-${i}`} className="block rounded-md border px-3 py-2">
                      <span className="block font-mono text-xs text-muted-foreground">
                        {l.entrySheet}
                      </span>
                      <span
                        className={`block whitespace-pre-wrap text-sm ${
                          l.ok ? "text-foreground" : "text-destructive"
                        }`}
                      >
                        {l.message}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                messageDialog?.message
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setMessageDialog((p) => (p ? { ...p, open: false } : p))}
              size="sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
