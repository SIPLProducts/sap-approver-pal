import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Filter, ListChecks, Paperclip, Search, User2, Wrench } from "lucide-react";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const actions = mode === "creation" ? CREATION_ACTIONS : RELEASE_ACTIONS;
  const showCreate = mode === "creation" && action === "Create";

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

  function toggleScopeCategory(value: string) {
    setScopeCategories((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ZNFA Release</h1>
      </div>

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


        </>
      )}
    </div>
  );
}
