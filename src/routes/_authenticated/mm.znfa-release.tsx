import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Filter, Info, KeyRound, ListChecks, Paperclip, Search, User2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/exec/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

const CREATION_ACTIONS = [
  "Create",
  "Change",
  "Clarification",
  "Release",
  "Display",
  "Approved List",
];

const RELEASE_ACTIONS = ["Release", "Display", "Approved List"];

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
};

const PR_DETAIL_COLUMNS: DetailColumn[] = [
  { key: "vendor", label: "Vendor Name/Vendor Code", divider: true },

  { key: "check", label: "Check" },
  { key: "rfq_no", label: "RFQ No" },
  { key: "rfq_item", label: "RFQ Item" },
  { key: "plant", label: "Plant" },
  { key: "material", label: "Material" },
  { key: "item_text", label: "Item Text" },
  { key: "qty", label: "Qty", numeric: true },
  { key: "uom", label: "UOM" },
  { key: "unit_rate", label: "Unit Rate", numeric: true },
  { key: "currency", label: "Currency" },
  { key: "basic_value", label: "Basic Value", numeric: true },
  { key: "tax", label: "Tax", numeric: true },
  { key: "tax_value", label: "Tax Value", numeric: true },
  { key: "total_value", label: "Total Value", numeric: true },
];

const FINAL_RECOMMENDATION_COLUMNS: DetailColumn[] = [
  { key: "recommended_vendor", label: "Recommended Vendor", divider: true },
  { key: "vendor", label: "Vendor" },
  { key: "name", label: "Name" },
  { key: "rfq_no", label: "RFQ No" },
  { key: "commercial_rating", label: "Commercial Rating" },
  { key: "ter_rating", label: "TER Rating" },
  { key: "basic_cost", label: "Basic Cost", numeric: true },
  { key: "currency", label: "Currency" },
  { key: "conversion_rate", label: "Conversion Rate", numeric: true },
  { key: "tax", label: "Tax", numeric: true },
  { key: "discount", label: "Discount", numeric: true },
  { key: "freight", label: "Freight/Transportation", numeric: true },
  { key: "packing_fwd", label: "Packing & FWD Charges", numeric: true },
];

function DetailsTableCard({
  title,
  emptyText,
  columns = PR_DETAIL_COLUMNS,
}: {
  title: string;
  emptyText: string;
  columns?: DetailColumn[];
}) {
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
            <TableRow>
              <TableCell
                colSpan={columns.length + 1}
                className="h-28 text-center text-sm text-muted-foreground"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}


const EMPTY_BUYER: Buyer = { id: "", name: "", email: "", location: "" };


function ZnfaReleasePage() {
  const [mode, setMode] = useState<Mode>("creation");
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
  const releaseKeyOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; relGroup: string; releaseCode: string }[] = [];
    for (const k of nfaKeys) {
      if (!k.releaseCode) continue;
      const value = `${k.relGroup ?? ""}\u0000${k.releaseCode}`;
      if (seen.has(value)) continue;
      seen.add(value);
      out.push({ value, relGroup: k.relGroup ?? "", releaseCode: k.releaseCode });
    }
    return out.sort(
      (a, b) =>
        a.relGroup.localeCompare(b.relGroup) || a.releaseCode.localeCompare(b.releaseCode),
    );
  }, [nfaKeys]);
  const [releaseKey, setReleaseKey] = useState("");
  const selectedKey = releaseKeyOptions.find((o) => o.value === releaseKey);
  const releaseCode = selectedKey?.releaseCode ?? "";
  const releaseGroup = selectedKey?.relGroup ?? "";

  // Drop a selection that is no longer offered (e.g. after a plant change).
  useEffect(() => {
    if (releaseKey && !releaseKeyOptions.some((o) => o.value === releaseKey)) {
      setReleaseKey("");
    }
  }, [releaseKey, releaseKeyOptions]);


  const actions = mode === "creation" ? CREATION_ACTIONS : RELEASE_ACTIONS;
  const showCreate =
    mode === "creation" && (action === "Create" || action === "Change");
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
  }

  function onModeChange(v: string) {
    setMode(v as Mode);
    setAction(null);
    resetCreateForm();
  }

  function onAction(label: string) {
    setAction(label);
    resetCreateForm();
    toast.info(`${label} selected`);
  }

  function onReleaseNext() {
    if (!releaseCode) {
      toast.error("Select a Release Code");
      return;
    }
    toast.info(
      `Release Code ${releaseCode} selected — the ZNFA list will load once the SAP API is configured.`,
    );
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
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="MM Approvals"
        title="ZNFA Release"
        subtitle="Prepare and release Note For Approval documents."
      />

      <Alert>
        <Info className="h-4 w-4" aria-hidden />
        <AlertTitle>SAP service not connected yet</AlertTitle>
        <AlertDescription>
          This screen is fully laid out, but the ZNFA SAP APIs are not configured. F4 help, Get Details,
          attachments and posting will start working as soon as they are set up in API Settings.
        </AlertDescription>
      </Alert>



      <Card className="border border-border/60 p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={onModeChange}
              className="flex flex-wrap items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="creation" id="znfa-mode-creation" />
                <Label htmlFor="znfa-mode-creation" className="text-sm font-normal">
                  Creation
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="release" id="znfa-mode-release" />
                <Label htmlFor="znfa-mode-release" className="text-sm font-normal">
                  Release
                </Label>
              </div>
            </RadioGroup>
          </div>

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
                      : "border-border bg-muted/60 text-muted-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground hover:shadow-md"
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
                  onValueChange={setReleaseCode}
                  disabled={releaseCodes.length === 0}
                >
                  <SelectTrigger className="h-9 w-full max-w-[220px] text-sm">
                    <SelectValue
                      placeholder={
                        releaseCodes.length === 0 ? "No keys assigned" : "Select code"
                      }
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
              disabled={!releaseCode}
              onClick={onReleaseNext}
            >
              Next
            </Button>
          </div>
        </Card>
      )}



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
                  <SelectContent />
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

          <DetailsTableCard title="PR DETAILS" emptyText="No PR details yet — enter an RFQ Number and click Get Details." />

          <DetailsTableCard title="RFQ DETAILS" emptyText="No RFQ details yet — enter an RFQ Number and click Get Details." />

          <DetailsTableCard
            title="FINAL RECOMMENDATION"
            columns={FINAL_RECOMMENDATION_COLUMNS}
            emptyText="No recommendation data yet — enter an RFQ Number and click Get Details."
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
                        <TableCell colSpan={2} className="h-28 text-center text-sm text-muted-foreground">
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
                          <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">
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
