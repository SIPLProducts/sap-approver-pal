import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { fetchZnfaRelease } from "@/lib/mm/znfa-release.functions";
import { fetchZnfaDisplay } from "@/lib/mm/znfa-display.functions";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import {
  AlertTriangle,
  Award,
  Filter,
  KeyRound,
  ListChecks,
  Paperclip,
  Search,
  User2,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/exec/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveContext, releaseKeysFor } from "@/hooks/use-active-context";
import { useSapProfile } from "@/hooks/use-sap-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mm/znfa-release")({
  component: ZnfaReleasePage,
});

type Mode = "creation" | "release";

const DEFAULT_ACTIONS = ["Release", "Display", "Approved List", "Clarification"];

// Commented out per request: Creation/Change mode actions are temporarily disabled.
// const CREATION_ACTIONS = [
//   "Create",
//   "Change",
//   "Clarification",
//   "Release",
//   "Display",
//   "Approved List",
// ];
// const RELEASE_ACTIONS = ["Release", "Display", "Approved List"];

const SCOPE_CATEGORIES = [
  { id: "supply", label: "Supply" },
  { id: "installation", label: "Installation" },
  { id: "construction-all", label: "Construction works including all supplies" },
  { id: "construction-fim", label: "Construction with FIM (Free issue Material)" },
  { id: "supervision", label: "Supervision" },
  { id: "commissioning", label: "Commissioning" },
  { id: "service", label: "Service" },
  { id: "arc", label: "ARC" },
];

type Buyer = { id: string; name: string; email: string; location: string };

type DetailColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  divider?: boolean;
  /** Optional second SAP field rendered as "primary / secondary". */
  also?: string;
};

const PR_DETAIL_COLUMNS: DetailColumn[] = [
  { key: "BANFN", label: "PR No" },
  { key: "BNFPO", label: "PR Item" },
  { key: "MATNR", label: "Material" },
  { key: "TXZ01", label: "Item Text", divider: true },
  { key: "MENGE", label: "Qty", numeric: true },
  { key: "MEINS", label: "UOM" },
  { key: "WERKS", label: "Plant" },
  { key: "NAME1", label: "Plant Name" },
  { key: "PR_APP_DATE", label: "PR Date" },
];

const RFQ_DETAIL_COLUMNS: DetailColumn[] = [
  { key: "NAME1", also: "LIFNR", label: "Vendor" },
  { key: "ANFNR", label: "RFQ No" },
  { key: "ANFPS", label: "RFQ Item" },
  { key: "WERKS", also: "PLANT_NAME", label: "Plant" },
  { key: "MATNR", label: "Material" },
  { key: "TXZ01", label: "Item Text", divider: true },
  { key: "ANMNG", label: "Qty", numeric: true },
  { key: "MEINS", label: "UOM" },
  { key: "FINAL_RATE", label: "Unit Rate", numeric: true },
  { key: "WAERS", label: "Currency" },
  { key: "BASIC_COST", label: "Basic Value", numeric: true },
  { key: "TAX_PER", label: "Tax %" },
  { key: "TAX", label: "Tax Value", numeric: true },
  { key: "TOTAL", label: "Total Value", numeric: true },
];

const RELEASE_RESULT_COLUMNS: DetailColumn[] = [
  { key: "NFA_NO", label: "NFA No" },
  { key: "LIFNR", label: "Vendor Code" },
  { key: "EKGRP", label: "Purch. Group" },
  { key: "NAME1", label: "Vendor Name" },
  { key: "WERKS", label: "Plant" },
  { key: "WERKS_NAME", label: "Plant Name" },
  { key: "VENDOR_RATE", label: "Vendor Rate" },
  { key: "TER_RATE", label: "TER Rate" },
  { key: "TOTAL", label: "Total", numeric: true },
  { key: "TITLE", label: "Title" },
  { key: "NFA_DATE", label: "NFA Date" },
  { key: "RELEASE", label: "Release" },
  { key: "ACCEP_REJECT", label: "Accept/Reject" },
];

const FINAL_RECOMMENDATION_COLUMNS: DetailColumn[] = [
  { key: "LIFNR", label: "Vendor" },
  { key: "NAME1", label: "Name", divider: true },
  { key: "__rfq_no", label: "RFQ No" },
  { key: "VENDOR_RATE", label: "Commercial Rating" },
  { key: "TER_RATE", label: "TER Rating" },
  { key: "BASIC_COST", label: "Basic Cost", numeric: true },
  { key: "WAERS", label: "Currency" },
  { key: "__conversion_rate", label: "Conversion Rate", numeric: true },
  { key: "TAX", label: "Tax", numeric: true },
  { key: "DISCOUNT", label: "Discount", numeric: true },
  { key: "FREIGHT", label: "Freight/Transportation", numeric: true },
  { key: "PACK_FWD", label: "Packing & FWD Charges", numeric: true },
];

function cellText(row: Record<string, any>, column: DetailColumn) {
  const primary = row[column.key];
  const secondary = column.also ? row[column.also] : undefined;
  const parts = [primary, secondary]
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .map((v) => String(v).trim());
  return parts.length ? parts.join(" / ") : "—";
}

function DetailsTableCard({
  title,
  emptyText,
  columns = PR_DETAIL_COLUMNS,
  rows,
}: {
  title: string;
  emptyText: string;
  columns?: DetailColumn[];
  rows?: Record<string, any>[] | null;
}) {
  const data = rows ?? [];
  return (
    <Card className="border border-border/60 p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" /> {title}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Select</span>
              </TableHead>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap text-xs",
                    c.numeric && "text-right",
                    c.divider && "min-w-[320px] border-r border-border",
                  )}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow key={`${title}-${i}`}>
                  <TableCell className="w-10" />
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "text-sm",
                        c.numeric ? "whitespace-nowrap text-right tabular-nums" : "whitespace-nowrap",
                        c.divider && "min-w-[320px] whitespace-normal border-r border-border",
                      )}
                    >
                      {cellText(row, c)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}


const EMPTY_BUYER: Buyer = { id: "", name: "", email: "", location: "" };

function ZnfaReleasePage() {
  // Default mode is kept as "release" so the Release/Display/Approved List/Clarification
  // actions behave as they did under Release mode. The mode toggle is hidden from the UI.
  const [mode] = useState<Mode>("release");
  const [action, setAction] = useState<string | null>(null);

  // Create form state (UI only for now)
  const [nfaType, setNfaType] = useState("");
  const [rfqNumber, setRfqNumber] = useState("");
  const [nfaTitle, setNfaTitle] = useState("");
  const [buyer, setBuyer] = useState<Buyer>(EMPTY_BUYER);

  // Scope of Work state
  const [scopeCategories, setScopeCategories] = useState<string[]>([]);
  const [remarks, setRemarks] = useState("");
  const [spendCategory, setSpendCategory] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [purchasingGroup, setPurchasingGroup] = useState("");

  // Award & attachments state (UI only for now)
  const [proposedToAward, setProposedToAward] = useState("");
  const [proposedToAwardDetail, setProposedToAwardDetail] = useState("");
  const [awardRemarks, setAwardRemarks] = useState("");
  const [approvedBudget, setApprovedBudget] = useState("");
  const [balanceBudget, setBalanceBudget] = useState("");

  // Release / Approved List step state
  const { plants: assignedPlants, activePlants } = useActiveContext();
  const profile = useSapProfile();
  const releaseId = profile?.user ?? "";
  const nfaKeys = useMemo(
    () => releaseKeysFor(assignedPlants, "nfa", activePlants),
    [assignedPlants, activePlants.join(",")],
  );
  const releaseCodes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of nfaKeys) {
      if (!k.releaseCode || seen.has(k.releaseCode)) continue;
      seen.add(k.releaseCode);
      out.push(k.releaseCode);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [nfaKeys]);
  const [releaseCode, setReleaseCode] = useState("");

  // Display step state
  const [mainNfaNumber, setMainNfaNumber] = useState("");
  const [displayConfirmed, setDisplayConfirmed] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [prRows, setPrRows] = useState<Record<string, any>[]>([]);
  const [rfqRows, setRfqRows] = useState<Record<string, any>[]>([]);
  const [recommendRows, setRecommendRows] = useState<Record<string, any>[]>([]);
  const [attachRows, setAttachRows] = useState<Record<string, any>[]>([]);
  const [nfaTextRows, setNfaTextRows] = useState<Record<string, any>[]>([]);

  const fetchDisplay = useServerFn(fetchZnfaDisplay);
  const displayMutation = useMutation({
    mutationFn: (vars: { znfaNum: string }) => fetchDisplay({ data: vars }),
    onSuccess: (res) => {
      const msg = res.sapMessage ?? res.error;
      if (msg || !res.znfa) {
        setDisplayConfirmed(false);
        setDisplayError(msg ?? "SAP returned no NFA document.");
        toast.error(msg ?? "SAP returned no NFA document.");
        return;
      }
      const z = res.znfa;
      setDisplayError(null);
      setNfaType(String(z.TYPE_NFA ?? ""));
      setNfaTitle(String(z.TITLE ?? ""));
      setRfqNumber(String(res.rfqs[0]?.RFQ ?? ""));
      setBuyer({
        id: String(z.BUYER_ID ?? ""),
        name: String(z.BUYER_NAME ?? ""),
        email: String(z.BUYER_EMAIL ?? ""),
        location: String(z.LOCATION ?? ""),
      });
      setSpendCategory(String(z.SPENDCATEGORY ?? ""));
      setItemCategory(String(z.ITEM_CATEGORY ?? ""));
      setPurchasingGroup(String(z.EKGRP ?? ""));
      setRemarks(String(z.REMARKS ?? ""));
      setApprovedBudget(z.APP_BUDGET === null || z.APP_BUDGET === undefined ? "" : String(z.APP_BUDGET));
      setBalanceBudget(z.BAL_BUDGET === null || z.BAL_BUDGET === undefined ? "" : String(z.BAL_BUDGET));
      setPrRows(res.prDet);
      setRfqRows(res.rfqDet);
      setRecommendRows(res.recommend);
      setAttachRows(res.attach);
      setNfaTextRows(
        res.nfaTexts.filter((t) => String(t.AVL_TEXTS ?? "").trim() !== ""),
      );
      setDisplayConfirmed(true);
      toast.success(`NFA ${z.NFA_NO ?? ""} loaded`);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to load the NFA document";
      setDisplayConfirmed(false);
      setDisplayError(msg);
      toast.error(msg);
    },
  });


  // Release / Approved List results
  const [releaseRows, setReleaseRows] = useState<Record<string, any>[] | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const fetchRelease = useServerFn(fetchZnfaRelease);
  const releaseMutation = useMutation({
    mutationFn: (vars: { user: string; relCode: string; mode: "release" | "app_list" }) =>
      fetchRelease({ data: vars }),
    onSuccess: (res) => {
      const msg = res.sapMessage ?? res.error;
      if (msg) {
        setReleaseRows(null);
        setReleaseError(msg);
        toast.error(msg);
        return;
      }
      setReleaseError(null);
      setReleaseRows(res.rows);
      toast.success(`${res.rows.length} record(s) loaded`);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to load ZNFA records";
      setReleaseRows(null);
      setReleaseError(msg);
      toast.error(msg);
    },
  });

  function clearReleaseResults() {
    setReleaseRows(null);
    setReleaseError(null);
  }

  const actions = DEFAULT_ACTIONS;
  const showDisplayStep = action === "Display";
  const showCreate =
    (mode === "creation" && (action === "Create" || action === "Change")) ||
    (showDisplayStep && displayConfirmed);
  const showReleaseStep = action === "Release" || action === "Approved List";

  function resetCreateForm() {
    setNfaType("");
    setRfqNumber("");
    setNfaTitle("");
    setBuyer(EMPTY_BUYER);
    setScopeCategories([]);
    setRemarks("");
    setSpendCategory("");
    setItemCategory("");
    setPurchasingGroup("");
    setProposedToAward("");
    setProposedToAwardDetail("");
    setAwardRemarks("");
    setApprovedBudget("");
    setBalanceBudget("");
    setReleaseCode("");
    setMainNfaNumber("");
    setDisplayConfirmed(false);
    setDisplayError(null);
    setPrRows([]);
    setRfqRows([]);
    setRecommendRows([]);
    setAttachRows([]);
    setNfaTextRows([]);
  }




  function onAction(label: string) {
    setAction(label);
    resetCreateForm();
    clearReleaseResults();
    toast.info(`${label} selected`);
  }

  function onReleaseNext() {
    if (!releaseCode) {
      toast.error("Select a Release Code");
      return;
    }
    if (!releaseId) {
      toast.error("No SAP user id found — please sign in again.");
      return;
    }
    clearReleaseResults();
    releaseMutation.mutate({
      user: releaseId,
      relCode: releaseCode,
      mode: action === "Approved List" ? "app_list" : "release",
    });
  }

  function onDisplayNext() {
    if (!mainNfaNumber.trim()) {
      toast.error("Enter a Main NFA Number");
      return;
    }
    setDisplayError(null);
    displayMutation.mutate({ znfaNum: mainNfaNumber.trim() });
  }

  function onRfqF4() {
    toast.info("RFQ Number F4 help will be enabled once the SAP API is configured.");
  }

  function onGetDetails() {
    if (!rfqNumber.trim()) {
      toast.error("Enter an RFQ Number");
      return;
    }
    toast.info("Get Details will fetch buyer details once the SAP API is configured.");
  }

  function onDisplayAttachments() {
    toast.info("Attachments will be available once the SAP API is configured.");
  }

  function toggleScopeCategory(value: string) {
    setScopeCategories((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="MM Approvals"
        title="ZNFA Release"
        subtitle="Prepare and release Note For Approval documents."
      />

      <Card className="border border-border/60 p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="space-y-4">

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {actions.map((label) => {
              const active = action === label;
              return (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-11 min-w-[140px] justify-center rounded-xl border px-4 font-medium transition-all duration-200",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] hover:bg-primary/90 hover:text-primary-foreground"
                      : "border-border bg-muted/60 text-muted-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground hover:shadow-md",
                  )}
                  onClick={() => onAction(label)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      {showReleaseStep && (
        <Card className="border border-border/60 p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> {action?.toUpperCase()}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[120px_1fr]">
                <Label className="text-sm font-medium">Release Code</Label>
                <Select
                  value={releaseCodes.includes(releaseCode) ? releaseCode : ""}
                  onValueChange={(v) => {
                    setReleaseCode(v);
                    clearReleaseResults();
                  }}
                  disabled={releaseCodes.length === 0}
                >
                  <SelectTrigger className="h-9 w-full max-w-[220px] text-sm">
                    <SelectValue
                      placeholder={releaseCodes.length === 0 ? "No keys assigned" : "Select code"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {releaseCodes.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[120px_1fr]">
                <Label className="text-sm font-medium">Release Id</Label>
                <Input
                  readOnly
                  value={releaseId}
                  className="h-9 w-full max-w-[220px] bg-muted/60 text-sm font-medium"
                  placeholder="—"
                />
              </div>
            </div>

            <Button
              type="button"
              className="h-9 px-6 sm:self-end"
              disabled={!releaseCode || releaseMutation.isPending}
              onClick={onReleaseNext}
            >
              {releaseMutation.isPending ? "Loading…" : "Next"}
            </Button>
          </div>
        </Card>
      )}

      {showReleaseStep && releaseError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Could not load ZNFA records</AlertTitle>
          <AlertDescription>{releaseError}</AlertDescription>
        </Alert>
      )}

      {showReleaseStep && releaseMutation.isPending && <SkeletonRows columns={6} />}

      {showReleaseStep && !releaseMutation.isPending && !releaseError && releaseRows && (
        <Card className="border border-border/60 p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" /> {action?.toUpperCase()} — {releaseRows.length}{" "}
            RECORD(S)
          </div>

          {releaseRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records found for this Release Code.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {RELEASE_RESULT_COLUMNS.map((c) => (
                      <TableHead
                        key={c.key}
                        className={cn("whitespace-nowrap text-xs", c.numeric && "text-right")}
                      >
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releaseRows.map((row, i) => (
                    <TableRow key={`${row.NFA_NO ?? "row"}-${i}`}>
                      {RELEASE_RESULT_COLUMNS.map((c) => (
                        <TableCell
                          key={c.key}
                          className={cn(
                            "whitespace-nowrap text-sm",
                            c.numeric && "text-right tabular-nums",
                          )}
                        >
                          {row[c.key] === null || row[c.key] === undefined || row[c.key] === ""
                            ? "—"
                            : String(row[c.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {showDisplayStep && (
        <Card className="border border-border/60 p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> DISPLAY
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="grid flex-1 grid-cols-1 items-center gap-2 sm:grid-cols-[160px_1fr]">
              <Label className="text-sm font-medium">Main NFA Number</Label>
              <Input
                value={mainNfaNumber}
                onChange={(e) => {
                  setMainNfaNumber(e.target.value);
                  setDisplayConfirmed(false);
                }}
                className="h-9 w-full max-w-[320px] text-sm"
                placeholder="Enter Main NFA Number"
              />
            </div>

            <Button
              type="button"
              className="h-9 px-6 sm:self-end"
              disabled={!mainNfaNumber.trim() || displayMutation.isPending}
              onClick={onDisplayNext}
            >
              {displayMutation.isPending ? "Loading…" : "Next"}
            </Button>
          </div>
        </Card>
      )}

      {showDisplayStep && displayError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Could not load the NFA document</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {showDisplayStep && displayMutation.isPending && <SkeletonRows columns={6} />}


      {showCreate && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className="space-y-4 border border-border/60 p-5 shadow-card lg:col-span-2">
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[160px_1fr]">
                <Label className="text-sm font-medium">Type of NFA</Label>
                <Select value={nfaType} onValueChange={setNfaType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="No values available" />
                  </SelectTrigger>
                  <SelectContent>
                    {nfaType ? <SelectItem value={nfaType}>{nfaType}</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[160px_1fr]">
                <Label className="text-sm font-medium">RFQ Number</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={rfqNumber}
                    onChange={(e) => setRfqNumber(e.target.value)}
                    className="h-9 w-full max-w-[200px] text-sm"
                    placeholder="RFQ Number"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="RFQ Number F4 help"
                    onClick={onRfqF4}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button type="button" className="h-9 px-5" onClick={onGetDetails}>
                    Get Details
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[160px_1fr]">
                <Label className="text-sm font-medium">NFA Title</Label>
                <Input
                  value={nfaTitle}
                  onChange={(e) => setNfaTitle(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="NFA Title"
                />
              </div>
            </Card>

            <Card className="border border-border/60 p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <User2 className="h-3.5 w-3.5" /> BUYER DETAILS
              </div>
              <div className="space-y-3">
                {[
                  { label: "Buyer Id", value: buyer.id },
                  { label: "Name", value: buyer.name },
                  { label: "E-Mail", value: buyer.email },
                  { label: "Location", value: buyer.location },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[110px_1fr]"
                  >
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Input
                      readOnly
                      value={f.value}
                      className="h-9 bg-muted/60 text-sm"
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="border border-border/60 p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" /> SCOPE OF WORK
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Scope Category</Label>
                <div className="space-y-2">
                  {SCOPE_CATEGORIES.map((category) => (
                    <div key={category.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`scope-${category.id}`}
                        checked={scopeCategories.includes(category.label)}
                        onCheckedChange={() => toggleScopeCategory(category.label)}
                      />
                      <Label
                        htmlFor={`scope-${category.id}`}
                        className="cursor-pointer text-sm font-normal leading-tight"
                      >
                        {category.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="min-h-0 text-sm"
                  placeholder="Enter remarks"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Purchase Type</Label>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[120px_1fr]">
                    <Label className="text-xs text-muted-foreground">Spend Category</Label>
                    <Input
                      value={spendCategory}
                      onChange={(e) => setSpendCategory(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="Spend Category"
                    />
                  </div>
                  <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[120px_1fr]">
                    <Label className="text-xs text-muted-foreground">Item Category</Label>
                    <Input
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="Item Category"
                    />
                  </div>
                  <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[120px_1fr]">
                    <Label className="text-xs text-muted-foreground">Purch. Group</Label>
                    <Input
                      value={purchasingGroup}
                      onChange={(e) => setPurchasingGroup(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="Purchasing Group"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <DetailsTableCard
            title="PR DETAILS"
            rows={prRows}
            emptyText="No PR details returned by SAP."
          />

          <DetailsTableCard
            title="RFQ DETAILS"
            columns={RFQ_DETAIL_COLUMNS}
            rows={rfqRows}
            emptyText="No RFQ details returned by SAP."
          />

          <DetailsTableCard
            title="FINAL RECOMMENDATION"
            columns={FINAL_RECOMMENDATION_COLUMNS}
            rows={recommendRows}
            emptyText="No recommendation data returned by SAP."
          />


          <Card className="border border-border/60 p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Award className="h-3.5 w-3.5" /> AWARD &amp; ATTACHMENTS
            </div>

            <div className="mb-6 grid grid-cols-1 items-start gap-3 sm:grid-cols-[160px_1fr]">
              <Label className="text-sm font-medium sm:pt-2">Proposed to award</Label>
              <div className="space-y-2">
                <Input
                  value={proposedToAward}
                  onChange={(e) => setProposedToAward(e.target.value)}
                  className="h-9 max-w-md text-sm"
                  placeholder="Proposed to award"
                />
                <Input
                  value={proposedToAwardDetail}
                  onChange={(e) => setProposedToAwardDetail(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Additional details"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-3">
                <Label className="text-sm font-medium">NFA Texts</Label>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap text-xs">NFA Texts</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">T&amp;C</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="h-28 text-center text-sm text-muted-foreground"
                        >
                          No NFA texts yet.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Remarks</Label>
                <Textarea
                  value={awardRemarks}
                  onChange={(e) => setAwardRemarks(e.target.value)}
                  rows={8}
                  className="text-sm"
                  placeholder="Enter remarks"
                />
              </div>

              <div className="space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Budget</Label>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[130px_1fr]">
                      <Label className="text-xs text-muted-foreground">Approved Budget</Label>
                      <Input
                        value={approvedBudget}
                        onChange={(e) => setApprovedBudget(e.target.value)}
                        inputMode="decimal"
                        className="h-9 text-right text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[130px_1fr]">
                      <Label className="text-xs text-muted-foreground">Balance Budget</Label>
                      <Input
                        readOnly
                        value={balanceBudget}
                        className="h-9 bg-muted/60 text-right text-sm"
                        placeholder="—"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Paperclip className="h-3.5 w-3.5" /> Attachments List
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-4"
                      onClick={onDisplayAttachments}
                    >
                      Display
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-xs">CB</TableHead>
                          <TableHead className="whitespace-nowrap text-xs">Vendor</TableHead>
                          <TableHead className="whitespace-nowrap text-xs">Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="h-24 text-center text-sm text-muted-foreground"
                          >
                            No attachments yet.
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
