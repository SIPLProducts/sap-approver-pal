import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Filter, RotateCcw, Loader2, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { useActiveContext } from "@/hooks/use-active-context";
import {
  fetchPoGet,
  releasePoItems,
  rejectPoItems,
} from "@/lib/mm/po-release.functions";

export const Route = createFileRoute("/_authenticated/mm/po-release")({
  component: PoReleasePage,
});

const COLUMN_LABELS: Record<string, string> = {
  EBELN: "Purchase Order Number",
  EBELP: "PO Item",
  BATXT: "Document Type",
  PLANT_NAME: "Plant",
  VENDOR_NAME: "Vendor Name",
  RLWRT: "Net Value",
  WAERS: "Currency",
  BUKRS: "Company Code",
  BSTYP: "PO Category",
  BSART: "Document Type",
  LIFNR: "Vendor",
  LIFNR_NAME: "Vendor Name",
  EKORG: "Purchasing Organization",
  EKGRP: "Purchasing Group",
  BEDAT: "PO Date",
  ERNAM: "Created By",
  MATERIAL: "Material Number",
  MATKL: "Material Group",
  TXZ01: "Short Text",
  WERKS: "Plant",
  PLANT: "Plant",
  LGORT: "Storage Location",
  MENGE: "Quantity",
  MEINS: "Unit",
  NETPR: "Net Price",
  NETWR: "Net Value",
  PEINH: "Price Unit",
  EEIND: "Delivery Date",
  REMARKS: "Remarks",
};

const NUMERIC_COLUMNS = new Set(["RLWRT", "NETPR", "NETWR", "MENGE"]);

function rowKey(r: Record<string, any>, idx: number) {
  const ebeln = r.EBELN ?? "";
  const ebelp = r.EBELP ?? "";
  return `${ebeln}-${ebelp}-${idx}`;
}

function PoReleasePage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [releaseGroup, setReleaseGroup] = useState("");
  const [releaseCode, setReleaseCode] = useState("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    setPlants((prev) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = prev.filter((c) => allowed.has(c));
      return kept.length === 0 ? activePlants : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  const fetchFn = useServerFn(fetchPoGet);
  const mutation = useMutation({
    mutationFn: (input: { relgroup: string; relcode: string; plants: string[] }) =>
      fetchFn({ data: input }),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        setRows([]);
        setSelected(new Set());
        setRemarks({});
        return;
      }
      setRows(res.data);
      setSelected(new Set());
      setRemarks({});
      toast.success(`Loaded ${res.data.length} row(s).`);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to fetch PO Release data.");
    },
  });

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one Plant.");
      return;
    }
    if (!releaseGroup.trim() || !releaseCode.trim()) {
      toast.error("Release Group and Release Code are required.");
      return;
    }
    mutation.mutate({
      relgroup: releaseGroup.trim(),
      relcode: releaseCode.trim(),
      plants,
    });
  }

  function reset() {
    setPlants(activePlants);
    setReleaseGroup("");
    setReleaseCode("");
    setRows([]);
    setSelected(new Set());
    setRemarks({});
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withIdx = rows.map((r, i) => ({ r, i }));
    if (!q) return withIdx;
    return withIdx.filter(({ r }) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const allKeys = useMemo(
    () => filteredRows.map(({ r, i }) => rowKey(r, i)),
    [filteredRows],
  );
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = selected.size > 0 && !allSelected;

  const columns = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
    if (!seen.has("REMARKS")) keys.push("REMARKS");
    return keys;
  }, [rows]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allKeys) : new Set());
  }
  function toggleRow(k: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(k);
      else next.delete(k);
      return next;
    });
  }

  const releaseFn = useServerFn(releasePoItems);
  const releaseMutation = useMutation({
    mutationFn: (input: {
      relgroup: string;
      relcode: string;
      items: { EBELN: string; EBELP: string; REMARKS?: string }[];
    }) => releaseFn({ data: input }),
    onSuccess: (res) => {
      const releasedKeys = new Set<string>();
      for (const r of res.results) {
        const label = `PO ${r.ebeln}/${r.ebelp}`;
        const msg = r.msgtxt || r.error || (r.ok ? "Released" : "Failed");
        if (r.ok) {
          toast.success(`${label}: ${msg}`);
          releasedKeys.add(`${r.ebeln}-${r.ebelp}`);
        } else {
          toast.error(`${label}: ${msg}`);
        }
      }
      if (releasedKeys.size > 0) {
        setRows((prev) =>
          prev.filter(
            (r) => !releasedKeys.has(`${String(r.EBELN ?? "")}-${String(r.EBELP ?? "")}`),
          ),
        );
        setSelected(new Set());
        setRemarks({});
      }
      if (plants.length > 0 && releaseGroup.trim() && releaseCode.trim()) {
        mutation.mutate({
          relgroup: releaseGroup.trim(),
          relcode: releaseCode.trim(),
          plants,
        });
      }
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Release failed.");
    },
  });

  function onRelease() {
    if (selected.size === 0) return;
    if (!releaseGroup.trim() || !releaseCode.trim()) {
      toast.error("Release Group and Release Code are required.");
      return;
    }
    const items = rows
      .map((r, i) => ({ r, k: rowKey(r, i) }))
      .filter(({ k }) => selected.has(k))
      .map(({ r, k }) => ({
        EBELN: String(r.EBELN ?? ""),
        EBELP: String(r.EBELP ?? ""),
        REMARKS: remarks[k] ?? (r.REMARKS == null ? "" : String(r.REMARKS)),
      }))
      .filter((it) => it.EBELN);
    if (items.length === 0) return;
    releaseMutation.mutate({
      relgroup: releaseGroup.trim(),
      relcode: releaseCode.trim(),
      items,
    });
  }

  const rejectFn = useServerFn(rejectPoItems);
  const rejectMutation = useMutation({
    mutationFn: (input: {
      relgroup: string;
      relcode: string;
      items: { EBELN: string; EBELP: string; REMARKS?: string }[];
    }) => rejectFn({ data: input }),
    onSuccess: (res) => {
      const rejectedKeys = new Set<string>();
      for (const r of res.results) {
        const label = `PO ${r.ebeln}/${r.ebelp}`;
        const msg = r.msgtxt || r.error || (r.ok ? "Rejected" : "Failed");
        if (r.ok) {
          toast.success(`${label}: ${msg}`);
          rejectedKeys.add(`${r.ebeln}-${r.ebelp}`);
        } else {
          toast.error(`${label}: ${msg}`);
        }
      }
      if (rejectedKeys.size > 0) {
        setRows((prev) =>
          prev.filter(
            (r) => !rejectedKeys.has(`${String(r.EBELN ?? "")}-${String(r.EBELP ?? "")}`),
          ),
        );
        setSelected(new Set());
        setRemarks({});
      }
      if (plants.length > 0 && releaseGroup.trim() && releaseCode.trim()) {
        mutation.mutate({
          relgroup: releaseGroup.trim(),
          relcode: releaseCode.trim(),
          plants,
        });
      }
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Reject failed.");
    },
  });

  function onReject() {
    if (selected.size === 0) return;
    if (!releaseGroup.trim() || !releaseCode.trim()) {
      toast.error("Release Group and Release Code are required.");
      return;
    }
    const items = rows
      .map((r, i) => ({ r, k: rowKey(r, i) }))
      .filter(({ k }) => selected.has(k))
      .map(({ r, k }) => ({
        EBELN: String(r.EBELN ?? ""),
        EBELP: String(r.EBELP ?? ""),
        REMARKS: remarks[k] ?? (r.REMARKS == null ? "" : String(r.REMARKS)),
      }))
      .filter((it) => it.EBELN);
    if (items.length === 0) return;
    rejectMutation.mutate({
      relgroup: releaseGroup.trim(),
      relcode: releaseCode.trim(),
      items,
    });
  }

  const showResults = mutation.isSuccess || rows.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">PO Release</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid gap-3 md:grid-cols-[280px_240px_240px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Release Group</Label>
            <Input
              value={releaseGroup}
              onChange={(e) => setReleaseGroup(e.target.value)}
              placeholder="Release group"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Release Code</Label>
            <Input
              value={releaseCode}
              onChange={(e) => setReleaseCode(e.target.value)}
              placeholder="Release code"
              className="h-9 text-sm"
            />
          </div>
          <div />
          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={mutation.isPending}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onReject}
          disabled={selected.size === 0 || rejectMutation.isPending}
        >
          {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Reject
        </Button>
        <Button
          size="sm"
          onClick={onRelease}
          disabled={selected.size === 0 || releaseMutation.isPending}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {releaseMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Release
        </Button>
      </div>

      {showResults && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="text-xs font-semibold text-muted-foreground">
              RESULTS · {filteredRows.length}
              {search.trim() ? ` / ${rows.length}` : ""} row(s) · {selected.size} selected
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search results..."
                className="h-9 text-sm pl-8"
              />
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  {columns.map((key) => (
                    <TableHead key={key} className="whitespace-nowrap text-xs">
                      {COLUMN_LABELS[key] ?? key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground py-6">
                      {rows.length === 0 ? "No data available." : "No results match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map(({ r, i }) => {
                    const k = rowKey(r, i);
                    const checked = selected.has(k);
                    return (
                      <TableRow key={k} data-state={checked ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleRow(k, v === true)}
                            aria-label={`Select row ${i + 1}`}
                          />
                        </TableCell>
                        {columns.map((key) => (
                          <TableCell key={key} className="whitespace-nowrap text-xs">
                            {key === "REMARKS" ? (
                              <Input
                                value={remarks[k] ?? (r.REMARKS == null ? "" : String(r.REMARKS))}
                                onChange={(e) =>
                                  setRemarks((prev) => ({ ...prev, [k]: e.target.value }))
                                }
                                placeholder="Remarks"
                                className="h-8 text-xs min-w-[180px]"
                              />
                            ) : r[key] === null || r[key] === undefined || r[key] === "" ? (
                              "-"
                            ) : (
                              String(r[key])
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
