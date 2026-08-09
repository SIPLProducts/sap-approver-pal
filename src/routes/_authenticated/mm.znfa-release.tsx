import { Fragment, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { fetchZnfaRelease } from "@/lib/mm/znfa-release.functions";
import { fetchZnfaDisplay } from "@/lib/mm/znfa-display.functions";
import { fetchZnfaClick } from "@/lib/mm/znfa-click.functions";
import { fetchZnfaPrint } from "@/lib/mm/znfa-print.functions";
import { approveZnfa } from "@/lib/mm/znfa-approve.functions";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Filter,
  KeyRound,
  ListChecks,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Paperclip,
  Search,
  User2,
  Wrench,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveContext, releaseKeysFor } from "@/hooks/use-active-context";
import { useSapProfile } from "@/hooks/use-sap-profile";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { NfaNumberSelect } from "@/components/mm/nfa-number-select";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mm/znfa-release")({
  component: ZnfaReleasePage,
});

type Mode = "creation" | "release";

const DEFAULT_ACTIONS = ["Release", "Display", "Approved List"];

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
  { id: "supply", label: "Supply", sapField: "SUPPLY" },
  { id: "installation", label: "Installation", sapField: "INSTALLATION" },
  {
    id: "construction-all",
    label: "Construction works including all supplies",
    sapField: "CONSTRUCTION_S",
  },
  {
    id: "construction-fim",
    label: "Construction with FIM (Free issue Material)",
    sapField: "CONSTRUCTION_R",
  },
  { id: "supervision", label: "Supervision", sapField: "SUPERVISION" },
  { id: "commissioning", label: "Commissioning", sapField: "COMMISION" },
  { id: "service", label: "Service", sapField: "SERVICES" },
  { id: "arc", label: "ARC", sapField: "ARC" },
];

/** SAP sends "X" for a ticked scope category; anything else is unticked. */
function isSapFlag(v: unknown): boolean {
  return String(v ?? "").trim().toUpperCase() === "X";
}

type Buyer = { id: string; name: string; email: string; location: string };

type DetailColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  divider?: boolean;
  /** Render a read-only checkbox from an SAP "X" flag instead of text. */
  checkbox?: boolean;
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

const REL_MATX_COLUMNS: DetailColumn[] = [
  { key: "NFA_NO", label: "NFA No" },
  { key: "REL_CODE", label: "Release Code" },
  { key: "APPROVER", label: "Approver" },
  { key: "APP_NAME", label: "Approver Name" },
  { key: "FRGCT", label: "Release Group" },
  { key: "STATUS", label: "Status" },
  { key: "APPROVER_DATE", label: "Approver Date" },
  { key: "REL_SEQUENCE", label: "Sequence" },
];

const FINAL_RECOMMENDATION_COLUMNS: DetailColumn[] = [
  { key: "APP_VENDOR", label: "Recommended Vendor", checkbox: true },
  { key: "EBELN", label: "RFQ Number" },
  { key: "LIFNR", label: "Vendor Code" },
  { key: "EKGRP", label: "Purchasing Group" },
  { key: "NAME1", label: "Vendor Name" },
  { key: "WERKS", label: "Plant" },
  { key: "VENDOR_RATE", label: "Commercial Rating" },
  { key: "TER_RATE", label: "TER Rating" },
  { key: "BASIC_COST", label: "Basic Cost", numeric: true },
  { key: "WAERS", label: "Currency" },
  { key: "TAX", label: "Tax", numeric: true },
  { key: "DISCOUNT", label: "Discount", numeric: true },
  { key: "FREIGHT", label: "Freight/Transportation", numeric: true },
  { key: "PACK_FWD", label: "Packing & Forward Charges", numeric: true },
  { key: "TOTAL", label: "Total", numeric: true },
  { key: "REMARKS", label: "Remarks" },
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
                      {c.checkbox ? (
                        <Checkbox
                          checked={isSapFlag(row[c.key])}
                          disabled
                          aria-label={c.label}
                        />
                      ) : (
                        cellText(row, c)
                      )}
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

/** Item-level columns for the PR tree (PR number lives on the parent row). */
const PR_ITEM_COLUMNS: DetailColumn[] = [
  { key: "BNFPO", label: "PR Item" },
  { key: "MATNR", label: "Material / Services" },
  { key: "TXZ01", label: "Item Text", divider: true },
  { key: "BADAT", label: "PR Creation Date" },
  { key: "ERNAM", label: "Created By" },
  { key: "MENGE", label: "Qty", numeric: true },
  { key: "MEINS", label: "UOM" },
  { key: "PR_APP_DATE", label: "PR Approval Date" },
  { key: "WERKS", label: "Plant" },
  { key: "NAME1", label: "Plant Name" },
];

function PrDetailsTreeCard({
  rows,
  emptyText,
}: {
  rows?: Record<string, any>[] | null;
  emptyText: string;
}) {
  const data = rows ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, Record<string, any>[]>();
    for (const row of data) {
      const key = String(row?.BANFN ?? "").trim() || "—";
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return Array.from(map.entries()).map(([pr, items]) => ({ pr, items }));
  }, [data]);

  const toggle = (pr: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pr)) next.delete(pr);
      else next.add(pr);
      return next;
    });

  const colCount = PR_ITEM_COLUMNS.length + 1;

  return (
    <Card className="border border-border/60 p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" /> PR DETAILS
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Expand</span>
              </TableHead>
              <TableHead className="whitespace-nowrap text-xs">Purchase Requisition No</TableHead>
              {PR_ITEM_COLUMNS.map((c) => (
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
            {groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount + 1}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => {
                const isOpen = expanded.has(group.pr);
                return (
                  <Fragment key={`pr-${group.pr}`}>
                    <TableRow
                      className="cursor-pointer bg-muted/30"
                      onClick={() => toggle(group.pr)}
                    >
                      <TableCell className="w-10">
                        <button
                          type="button"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          aria-expanded={isOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(group.pr);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {group.pr}
                      </TableCell>
                      <TableCell
                        colSpan={PR_ITEM_COLUMNS.length}
                        className="whitespace-nowrap text-xs text-muted-foreground"
                      >
                        {group.items.length} item{group.items.length === 1 ? "" : "s"}
                      </TableCell>
                    </TableRow>

                    {isOpen &&
                      group.items.map((row, i) => (
                        <TableRow key={`pr-${group.pr}-item-${i}`}>
                          <TableCell className="w-10" />
                          <TableCell />
                          {PR_ITEM_COLUMNS.map((c) => (
                            <TableCell
                              key={c.key}
                              className={cn(
                                "text-sm",
                                c.numeric
                                  ? "whitespace-nowrap text-right tabular-nums"
                                  : "whitespace-nowrap",
                                c.divider &&
                                  "min-w-[320px] whitespace-normal border-r border-border",
                              )}
                            >
                              {cellText(row, c)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/** Item-level columns for the RFQ tree (vendor lives on the parent row). */
const RFQ_ITEM_COLUMNS: DetailColumn[] = [
  { key: "ANFNR", label: "RFQ No" },
  { key: "ANFPS", label: "RFQ Item" },
  { key: "WERKS", label: "Plant" },
  { key: "MATNR", label: "Material / Services" },
  { key: "TXZ01", label: "Item Text", divider: true },
  { key: "ANMNG", label: "Qty", numeric: true },
  { key: "MEINS", label: "UOM" },
  { key: "FINAL_RATE", label: "Unit Rate", numeric: true },
  { key: "WAERS", label: "Currency" },
  { key: "BASIC_COST", label: "Basic Rate", numeric: true },
  { key: "TAX", label: "Tax", numeric: true },
  { key: "MWSKZ", label: "Tax Code" },
  { key: "DISCOUNT", label: "Discount", numeric: true },
  { key: "FREIGHT", label: "Freight / Transportation", numeric: true },
  { key: "PACK_FWD", label: "Packing & Forwarding", numeric: true },
  { key: "TOTAL", label: "Final Rate", numeric: true },
  { key: "FINAL_REV", label: "Final Revision" },
  { key: "TER_RATE", label: "TE Rating" },
  { key: "TER_NAME", label: "Evaluator" },
];

function RfqDetailsTreeCard({
  rows,
  emptyText,
}: {
  rows?: Record<string, any>[] | null;
  emptyText: string;
}) {
  const data = rows ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; items: Record<string, any>[] }
    >();
    for (const row of data) {
      const code = String(row?.LIFNR ?? "").trim();
      const name = String(row?.NAME1 ?? "").trim();
      const key = code || name || "—";
      const label = [name, code].filter(Boolean).join(" / ") || "—";
      const existing = map.get(key);
      if (existing) {
        existing.items.push(row);
      } else {
        map.set(key, { label, items: [row] });

      }
    }
    return Array.from(map.entries()).map(([key, group]) => ({ key, ...group }));
  }, [data]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Card className="border border-border/60 p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" /> RFQ DETAILS
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Expand</span>
              </TableHead>
              <TableHead className="whitespace-nowrap text-xs">
                Vendor Name / Vendor Code
              </TableHead>

              {RFQ_ITEM_COLUMNS.map((c) => (
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
            {groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={RFQ_ITEM_COLUMNS.length + 2}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => {
                const isOpen = expanded.has(group.key);
                return (
                  <Fragment key={`rfq-${group.key}`}>
                    <TableRow
                      className="cursor-pointer bg-muted/30"
                      onClick={() => toggle(group.key)}
                    >
                      <TableCell className="w-10">
                        <button
                          type="button"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          aria-expanded={isOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(group.key);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">

                        {group.label}
                      </TableCell>
                      <TableCell
                        colSpan={RFQ_ITEM_COLUMNS.length}
                        className="whitespace-nowrap text-xs text-muted-foreground"
                      >
                        {group.items.length} item{group.items.length === 1 ? "" : "s"}
                      </TableCell>
                    </TableRow>

                    {isOpen &&
                      group.items.map((row, i) => (
                        <TableRow key={`rfq-${group.key}-item-${i}`}>
                          <TableCell className="w-10" />
                          <TableCell />

                          {RFQ_ITEM_COLUMNS.map((c) => (
                            <TableCell
                              key={c.key}
                              className={cn(
                                "text-sm",
                                c.numeric
                                  ? "whitespace-nowrap text-right tabular-nums"
                                  : "whitespace-nowrap",
                                c.divider &&
                                  "min-w-[320px] whitespace-normal border-r border-border",
                              )}
                            >
                              {cellText(row, c)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })
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
  const [expandedTextVendors, setExpandedTextVendors] = useState<Set<string>>(new Set());
  const [selectedTextKey, setSelectedTextKey] = useState<string | null>(null);
  const [relMatxRows, setRelMatxRows] = useState<Record<string, any>[]>([]);
  const [clickedNfaNo, setClickedNfaNo] = useState<string | null>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [selectedAttachKeys, setSelectedAttachKeys] = useState<string[]>([]);
  const { confirm, confirmDialog } = useConfirm();

  // Print preview state
  const [printOpen, setPrintOpen] = useState(false);
  const [printDataUrl, setPrintDataUrl] = useState<string | null>(null);
  const [printBase64, setPrintBase64] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printMimeType, setPrintMimeType] = useState<string>("application/pdf");



  function applyZnfaDocument(res: {
    znfa: Record<string, any> | null;
    rfqs: Record<string, any>[];
    prDet: Record<string, any>[];
    rfqDet: Record<string, any>[];
    relMatx: Record<string, any>[];
    recommend: Record<string, any>[];
    attach: Record<string, any>[];
    nfaTexts: Record<string, any>[];
  }) {
    const z = res.znfa ?? {};
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
    setScopeCategories(
      SCOPE_CATEGORIES.filter((c) => isSapFlag(z[c.sapField])).map((c) => c.label),
    );
    setApprovedBudget(
      z.APP_BUDGET === null || z.APP_BUDGET === undefined ? "" : String(z.APP_BUDGET),
    );
    setBalanceBudget(
      z.BAL_BUDGET === null || z.BAL_BUDGET === undefined ? "" : String(z.BAL_BUDGET),
    );
    setPrRows(res.prDet);
    setRfqRows(res.rfqDet);
    setRecommendRows(res.recommend);
    setAttachRows(res.attach);
    setRelMatxRows(res.relMatx);
    setNfaTextRows(res.nfaTexts.filter((t) => String(t.AVL_TEXTS ?? "").trim() !== ""));
    const awardRow = res.nfaTexts.find(
      (t) => String(t.VENDOR ?? "").trim() !== "" || String(t.NAME1 ?? "").trim() !== "",
    );
    setProposedToAward(String(awardRow?.VENDOR ?? ""));
    setProposedToAwardDetail(String(awardRow?.NAME1 ?? ""));
    setExpandedTextVendors(new Set());
    setSelectedTextKey(null);
  }

  const fetchDisplay = useServerFn(fetchZnfaDisplay);
  const displayMutation = useMutation({
    mutationFn: (vars: { znfaNum: string }) => fetchDisplay({ data: vars }),
    onSuccess: (res) => {
      const msg = (res.sapMessage?.trim() ? res.sapMessage.trim() : null) ?? res.error;
      if (msg || !res.znfa) {
        setDisplayConfirmed(false);
        if (msg) {
          setDisplayError(msg);
          toast.error(msg);
        }
        return;
      }
      const z = res.znfa;
      setDisplayError(null);
      applyZnfaDocument(res);
      setDocLoaded(true);
      setDisplayConfirmed(true);
      toast.success(`NFA ${z.NFA_NO ?? ""} loaded`);
    },
    onError: () => {
      const msg = "An unexpected error occurred while loading the NFA document.";
      setDisplayConfirmed(false);
      setDisplayError(msg);
      toast.error(msg);
    },
  });


  const fetchClick = useServerFn(fetchZnfaClick);
  const clickMutation = useMutation({
    mutationFn: (vars: { znfaNum: string; relCode: string }) => fetchClick({ data: vars }),
    onSuccess: (res) => {
      const msg = (res.sapMessage?.trim() ? res.sapMessage.trim() : null) ?? res.error;
      if (msg || !res.znfa) {
        setDocLoaded(false);
        setClickedNfaNo(null);
        if (msg) {
          setDisplayError(msg);
          toast.error(msg);
        }
        return;
      }
      setDisplayError(null);
      applyZnfaDocument(res);
      setDocLoaded(true);
      toast.success(`NFA ${res.znfa.NFA_NO ?? ""} loaded`);
    },
    onError: () => {
      const msg = "An unexpected error occurred while loading the NFA document.";
      setDocLoaded(false);
      setClickedNfaNo(null);
      setDisplayError(msg);
      toast.error(msg);
    },
  });

  function onNfaNoClick(nfaNo: string) {
    if (!nfaNo.trim()) return;
    setClickedNfaNo(nfaNo);
    setDocLoaded(false);
    setDisplayError(null);
    clickMutation.mutate({ znfaNum: nfaNo.trim(), relCode: releaseCode });
  }

  const fetchPrint = useServerFn(fetchZnfaPrint);
  const printMutation = useMutation({
    mutationFn: (vars: { znfaNum: string; relCode: string; nfaType: string }) =>
      fetchPrint({ data: vars }),
    onSuccess: (res) => {
      const msg = (res.sapMessage?.trim() ? res.sapMessage.trim() : null) ?? res.error;
      if (msg || !res.base64) {
        setPrintBase64(null);
        setPrintDataUrl(null);
        setPrintMimeType("application/pdf");
        setPrintError(msg || "Could not generate the preview.");
        return;
      }
      setPrintError(null);
      setPrintMimeType(res.mimeType?.trim() || "application/pdf");
      setPrintBase64(res.base64);
      setPrintDataUrl(res.dataUrl);
    },
    onError: (err: any) => {
      setPrintBase64(null);
      setPrintDataUrl(null);
      setPrintMimeType("application/pdf");
      const raw = String(err?.message ?? err ?? "").trim();
      const unauthorized = /401|unauthor/i.test(raw);
      setPrintError(
        unauthorized
          ? "Your session has expired. Please sign in again and retry the preview."
          : raw
            ? `Preview failed: ${raw}`
            : "An unexpected error occurred while generating the preview.",
      );
    },

  });

  // Blob URLs render reliably in an <iframe>; data: URLs of PDFs are blocked by browsers.
  const [printBlobUrl, setPrintBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!printBase64) {
      setPrintBlobUrl(null);
      return;
    }
    let url: string | null = null;
    try {
      let b64 = printBase64.trim().replace(/^["']+/, "").replace(/["']+$/, "");
      b64 = b64.replace(/^data:[^;,]*;base64,/i, "");
      b64 = b64
        .replace(/[^A-Za-z0-9+/=_-]/g, "")
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .replace(/=+$/, "");
      b64 = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      url = URL.createObjectURL(new Blob([bytes], { type: printMimeType || "application/pdf" }));
      setPrintBlobUrl(url);
      setPrintError(null);
    } catch {
      setPrintBlobUrl(null);
      setPrintError("The document returned by SAP could not be decoded for preview.");
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [printBase64, printMimeType]);


  const isImagePreview = (printMimeType || "").toLowerCase().startsWith("image/");

  function printFileExtension(mime: string): string {
    const m = (mime || "").toLowerCase().split(";")[0].trim();
    const known: Record<string, string> = {
      "application/pdf": "pdf",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/bmp": "bmp",
      "image/tiff": "tiff",
      "image/svg+xml": "svg",
    };
    if (known[m]) return known[m];
    const sub = m.split("/")[1]?.replace(/[^\w]+/g, "");
    return sub || "pdf";
  }

  function onDocPreview() {
    if (!openedNfaNo) {
      toast.info("Open an NFA document first to preview it.");
      return;
    }
    setPrintError(null);
    setPrintBase64(null);
    setPrintDataUrl(null);
    setPrintMimeType("application/pdf");
    setPrintOpen(true);
    printMutation.mutate({ znfaNum: openedNfaNo, relCode: releaseCode, nfaType });
  }

  function onPrintDownload() {
    const href = printBlobUrl ?? printDataUrl;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = `${(openedNfaNo || "NFA").replace(/[^\w.-]+/g, "_")}.${printFileExtension(printMimeType)}`;
    a.click();
  }




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
    onError: () => {
      const msg = "An unexpected error occurred while loading ZNFA records.";
      setReleaseRows(null);
      setReleaseError(msg);
      toast.error(msg);
    },
  });

  // Approve / Release action (ZNFA_APPROVE_API)
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [clarifyText, setClarifyText] = useState("");
  const approveFn = useServerFn(approveZnfa);
  const approveMutation = useMutation({
    mutationFn: (vars: { znfaNum: string; user: string; relCode: string }) =>
      approveFn({ data: { ...vars, reject: false, reason: "" } }),
    onSuccess: (res) => {
      const msg = res.sapMessage ?? res.error;
      if (!res.ok) {
        setDisplayError(msg ?? "SAP rejected the request.");
        toast.error(msg ?? "SAP rejected the request.");
        return;
      }
      setDisplayError(null);
      toast.success(msg ? msg : `NFA released${res.number ? ` (${res.number})` : ""}`);
      onDocBack();
      if (releaseId && releaseCode) {
        releaseMutation.mutate({
          user: releaseId,
          relCode: releaseCode,
          mode: action === "Approved List" ? "app_list" : "release",
        });
      }
    },
    onError: (e: any) => {
      const msg =
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : "An unexpected error occurred while releasing the NFA.";
      setDisplayError(msg);
      toast.error(msg);
    },
  });

  // Reject action (ZNFA_REJECT_API)
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const rejectMutation = useMutation({
    mutationFn: (vars: { znfaNum: string; user: string; relCode: string; reason: string }) =>
      approveFn({
        data: {
          znfaNum: vars.znfaNum,
          user: vars.user,
          relCode: vars.relCode,
          reject: true,
          reason: vars.reason,
        },
      }),
    onSuccess: (res) => {
      const msg = res.sapMessage ?? res.error;
      if (!res.ok) {
        setRejectError(msg ?? "SAP rejected the request.");
        toast.error(msg ?? "SAP rejected the request.");
        return;
      }
      setRejectError(null);
      setRejectOpen(false);
      setRejectReason("");
      setDisplayError(null);
      toast.success(msg ? msg : `NFA rejected${res.number ? ` (${res.number})` : ""}`);
      onDocBack();
      if (releaseId && releaseCode) {
        releaseMutation.mutate({
          user: releaseId,
          relCode: releaseCode,
          mode: action === "Approved List" ? "app_list" : "release",
        });
      }
    },
    onError: (e: any) => {
      const msg =
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : "An unexpected error occurred while rejecting the NFA.";
      setRejectError(msg);
      toast.error(msg);
    },
  });

  // Clarification action (ZNFA_Clarification_API)
  const [clarifyError, setClarifyError] = useState<string | null>(null);
  const clarifyMutation = useMutation({
    mutationFn: (vars: { znfaNum: string; user: string; relCode: string; clarifyText: string }) =>
      approveFn({
        data: {
          znfaNum: vars.znfaNum,
          user: vars.user,
          relCode: vars.relCode,
          reject: false,
          reason: "",
          clarify: true,
          clarifyText: vars.clarifyText,
        },
      }),
    onSuccess: (res) => {
      const msg = res.sapMessage ?? res.error;
      if (!res.ok) {
        setClarifyError(msg ?? "SAP rejected the request.");
        toast.error(msg ?? "SAP rejected the request.");
        return;
      }
      setClarifyError(null);
      setClarifyOpen(false);
      setClarifyText("");
      toast.success(msg ? msg : "Clarification mail sent.");
    },
    onError: (e: any) => {
      const msg =
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : "An unexpected error occurred while sending the clarification.";
      setClarifyError(msg);
      toast.error(msg);
    },
  });

  function submitClarify() {
    const nfaNo = openedNfaNo?.trim();
    if (!nfaNo) {
      setClarifyError("No NFA document is open.");
      return;
    }
    if (!releaseId?.trim()) {
      setClarifyError("SAP user id is missing.");
      return;
    }
    if (!releaseCode?.trim()) {
      setClarifyError("Release Code is missing.");
      return;
    }
    setClarifyError(null);
    clarifyMutation.mutate({
      znfaNum: nfaNo,
      user: releaseId.trim(),
      relCode: releaseCode.trim(),
      clarifyText: clarifyText,
    });
  }

  // Display Clarification action (ZNFA_DISPLAY_CLARIFY_API)
  const [disClarifyOpen, setDisClarifyOpen] = useState(false);
  const [disClarifyLines, setDisClarifyLines] = useState<string[]>([]);
  const [disClarifyError, setDisClarifyError] = useState<string | null>(null);
  const disClarifyMutation = useMutation({
    mutationFn: (vars: { znfaNum: string; user: string; relCode: string }) =>
      approveFn({
        data: {
          znfaNum: vars.znfaNum,
          user: vars.user,
          relCode: vars.relCode,
          reject: false,
          reason: "",
          clarify: false,
          clarifyText: "",
          disClarify: true,
        },
      }),
    onSuccess: (res) => {
      const msg = res.sapMessage ?? res.error;
      if (!res.ok) {
        setDisClarifyLines([]);
        setDisClarifyError(msg ?? "SAP rejected the request.");
        toast.error(msg ?? "SAP rejected the request.");
        return;
      }
      setDisClarifyError(null);
      setDisClarifyLines(res.lines ?? []);
    },
    onError: (e: any) => {
      const msg =
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : "An unexpected error occurred while loading the clarification.";
      setDisClarifyLines([]);
      setDisClarifyError(msg);
      toast.error(msg);
    },
  });

  function openDisClarify() {
    const nfaNo = openedNfaNo?.trim();
    setDisClarifyLines([]);
    setDisClarifyError(null);
    setDisClarifyOpen(true);
    if (!nfaNo) {
      setDisClarifyError("No NFA document is open.");
      return;
    }
    if (!releaseId?.trim()) {
      setDisClarifyError("SAP user id is missing.");
      return;
    }
    if (!releaseCode?.trim()) {
      setDisClarifyError("Release Code is missing.");
      return;
    }
    disClarifyMutation.mutate({
      znfaNum: nfaNo,
      user: releaseId.trim(),
      relCode: releaseCode.trim(),
    });
  }



  function clearReleaseResults() {
    setReleaseRows(null);
    setReleaseError(null);
    setClickedNfaNo(null);
    setDocLoaded(false);
    setDisplayError(null);
  }

  const actions = DEFAULT_ACTIONS;
  const showDisplayStep = action === "Display";
  const showReleaseStep = action === "Release" || action === "Approved List";
  // Approve/Reject/Clarification are only offered on the Release path.
  const showDocActions = !showDisplayStep && action !== "Approved List";
  const showCreate =
    (mode === "creation" && (action === "Create" || action === "Change")) ||
    (showDisplayStep && displayConfirmed) ||
    (showReleaseStep && docLoaded);

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
    setExpandedTextVendors(new Set());
    setSelectedTextKey(null);
    setRelMatxRows([]);
    setClickedNfaNo(null);
    setDocLoaded(false);
  }

  const fallbackVendorName = useMemo(() => {
    const rec =
      recommendRows.find((r) => isSapFlag(r.APP_VENDOR)) ?? recommendRows[0] ?? null;
    return String(rec?.NAME1 ?? "").trim() || nfaTitle.trim() || "NFA Texts";
  }, [recommendRows, nfaTitle]);

  const nfaTextGroups = useMemo(() => {
    const map = new Map<string, { vendor: string; items: Record<string, any>[] }>();
    for (const t of nfaTextRows) {
      const vendor = String(t.NAME1 ?? "").trim() || fallbackVendorName;
      if (!map.has(vendor)) map.set(vendor, { vendor, items: [] });
      map.get(vendor)!.items.push(t);
    }
    return Array.from(map.values());
  }, [nfaTextRows, fallbackVendorName]);

  function textLines(t: Record<string, any>) {
    if (Array.isArray(t.HEADER)) {
      const lines = t.HEADER.map((h: any) => String(h?.LINE ?? "")).filter(
        (l: string) => l.trim() !== "",
      );
      if (lines.length > 0) return lines.join("\n");
    }
    return "";
  }

  function toggleTextVendor(vendor: string) {
    setExpandedTextVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  }



  function onSelectNfaText(key: string, t: Record<string, any>) {
    setSelectedTextKey(key);
    setAwardRemarks(textLines(t));
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

  function toggleAttachRow(key: string) {
    setSelectedAttachKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const openedNfaNo = clickedNfaNo?.trim() || mainNfaNumber.trim();

  async function onDocApprove() {
    const ok = await confirm({
      title: `Approve NFA ${openedNfaNo || ""}`.trim() + "?",
      description: "This will release the NFA document in SAP.",
      destructive: false,
      confirmLabel: "Approve",
    });
    if (!ok) return;
    if (!openedNfaNo) {
      toast.error("No NFA number is open.");
      return;
    }
    if (!releaseId) {
      toast.error("No SAP user id found — please sign in again.");
      return;
    }
    if (!releaseCode) {
      toast.error("Select a Release Code");
      return;
    }
    setDisplayError(null);
    approveMutation.mutate({ znfaNum: openedNfaNo, user: releaseId, relCode: releaseCode });
  }

  function onDocReject() {
    if (!openedNfaNo) {
      toast.error("No NFA number is open.");
      return;
    }
    setRejectError(null);
    setRejectReason("");
    setRejectOpen(true);
  }

  function submitReject() {
    if (!openedNfaNo) {
      toast.error("No NFA number is open.");
      return;
    }
    if (!releaseId) {
      toast.error("No SAP user id found — please sign in again.");
      return;
    }
    if (!releaseCode) {
      toast.error("Select a Release Code");
      return;
    }
    if (!rejectReason.trim()) return;
    setRejectError(null);
    rejectMutation.mutate({
      znfaNum: openedNfaNo,
      user: releaseId,
      relCode: releaseCode,
      reason: rejectReason.trim(),
    });
  }

  function onDocBack() {
    resetCreateForm();
    setDisplayError(null);
    setSelectedAttachKeys([]);
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
                      {RELEASE_RESULT_COLUMNS.map((c) => {
                        const raw = row[c.key];
                        const text =
                          raw === null || raw === undefined || raw === "" ? "" : String(raw);
                        const isNfaNo = c.key === "NFA_NO" && text !== "";
                        const isBusy = clickMutation.isPending && clickedNfaNo === text;
                        return (
                          <TableCell
                            key={c.key}
                            className={cn(
                              "whitespace-nowrap text-sm",
                              c.numeric && "text-right tabular-nums",
                            )}
                          >
                            {isNfaNo ? (
                              <button
                                type="button"
                                onClick={() => onNfaNoClick(text)}
                                disabled={clickMutation.isPending}
                                className="font-medium text-primary underline underline-offset-2 hover:opacity-80 disabled:opacity-60"
                              >
                                {isBusy ? "Loading…" : text}
                              </button>
                            ) : (
                              (text || "—")
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {showReleaseStep && displayError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Could not load the NFA document</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {showReleaseStep && clickMutation.isPending && <SkeletonRows columns={6} />}

      {showDisplayStep && (
        <Card className="border border-border/60 p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> DISPLAY
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="grid flex-1 grid-cols-1 items-center gap-2 sm:grid-cols-[160px_1fr]">
              <Label className="text-sm font-medium">Main NFA Number</Label>
              <NfaNumberSelect
                value={mainNfaNumber}
                user={releaseId}
                onChange={(v) => {
                  setMainNfaNumber(v);
                  setDisplayConfirmed(false);
                }}
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
          <Card className="border border-border/60 p-2 shadow-card">
            <div className="flex items-center gap-2 overflow-x-auto">
              {openedNfaNo && (
                <span className="shrink-0 px-2 font-mono text-xs text-muted-foreground">
                  NFA {openedNfaNo}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                {showDocActions && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={onDocApprove}
                      disabled={approveMutation.isPending}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />{" "}
                      {approveMutation.isPending ? "Approving…" : "Approve"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="h-8 px-3 text-xs"
                      onClick={onDocReject}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />{" "}
                      {rejectMutation.isPending ? "Rejecting…" : "Reject"}
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={onDocBack}
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
                </Button>
                {showDocActions && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => {
                        setClarifyText("");
                        setClarifyOpen(true);
                      }}
                    >
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Clarification
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={disClarifyMutation.isPending}
                      onClick={openDisClarify}
                    >
                      <MessagesSquare className="mr-1.5 h-3.5 w-3.5" />{" "}
                      {disClarifyMutation.isPending ? "Loading…" : "Display Clarification"}
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={onDocPreview}
                  disabled={printMutation.isPending}
                >
                  {printMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Preview
                </Button>
              </div>
            </div>
          </Card>


          <DetailsTableCard
            title="APPROVAL / RELEASE MATRIX"
            columns={REL_MATX_COLUMNS}
            rows={relMatxRows}
            emptyText="No approval matrix returned by SAP."
          />

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
                  <Button type="button" className="h-9 px-5" disabled onClick={onGetDetails}>
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
                        disabled={docLoaded}
                        onCheckedChange={() => toggleScopeCategory(category.label)}
                      />
                      <Label
                        htmlFor={`scope-${category.id}`}
                        className={
                          docLoaded
                            ? "text-sm font-normal leading-tight text-muted-foreground"
                            : "cursor-pointer text-sm font-normal leading-tight"
                        }
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

          <PrDetailsTreeCard rows={prRows} emptyText="No PR details returned by SAP." />

          <RfqDetailsTreeCard rows={rfqRows} emptyText="No RFQ details returned by SAP." />


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
                      {nfaTextGroups.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="h-28 text-center text-sm text-muted-foreground"
                          >
                            No NFA texts returned by SAP.
                          </TableCell>
                        </TableRow>
                      ) : (
                        nfaTextGroups.map((g) => {
                          const open = expandedTextVendors.has(g.vendor);
                          return (
                            <Fragment key={g.vendor}>
                              <TableRow>
                                <TableCell colSpan={2} className="text-sm font-medium">
                                  <button
                                    type="button"
                                    onClick={() => toggleTextVendor(g.vendor)}
                                    className="flex items-center gap-2 text-left"
                                    aria-expanded={open}
                                  >
                                    {open ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    {g.vendor}
                                  </button>
                                </TableCell>
                              </TableRow>
                              {open &&
                                g.items.map((t, i) => {
                                  const rfqNo =
                                    String(t.EBELN ?? t.RFQ ?? t.ANFNR ?? "").trim() || "—";
                                  const key = `${g.vendor}-${rfqNo}-${t.AVL_TEXTS ?? "text"}-${i}`;
                                  const selected = selectedTextKey === key;
                                  return (
                                    <TableRow
                                      key={key}
                                      data-state={selected ? "selected" : undefined}
                                      className="cursor-pointer"
                                      onClick={() => onSelectNfaText(key, t)}
                                    >
                                      <TableCell className="whitespace-nowrap pl-10 text-sm">
                                        {rfqNo}
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {String(t.AVL_TEXTS ?? "—")}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </Fragment>
                          );
                        })
                      )}
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
                          <TableHead className="whitespace-nowrap text-right text-xs">
                            Attachments
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attachRows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="h-24 text-center text-sm text-muted-foreground"
                            >
                              No attachments returned by SAP.
                            </TableCell>
                          </TableRow>
                        ) : (
                          attachRows.map((a, i) => {
                            const attachKey = `${a.ATTACHMENT_ID ?? "attach"}-${i}`;
                            return (
                            <TableRow key={attachKey}>
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={selectedAttachKeys.includes(attachKey)}
                                  onCheckedChange={() => toggleAttachRow(attachKey)}
                                  aria-label={`Select attachment ${String(a.NAME1 ?? i + 1)}`}
                                />
                              </TableCell>

                              <TableCell className="whitespace-nowrap text-sm">
                                {String(a.VENDOR ?? "—").trim() || "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {String(a.NAME1 ?? "—").trim() || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                                {String(a.NO_ATTACHMENTS ?? "").trim() || "—"}
                              </TableCell>
                            </TableRow>
                            );
                          })

                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {confirmDialog}

      <Dialog
        open={rejectOpen}
        onOpenChange={(o) => {
          setRejectOpen(o);
          if (!o) {
            setRejectReason("");
            setRejectError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject NFA {openedNfaNo ? `— ${openedNfaNo}` : ""}</DialogTitle>
            <DialogDescription>
              Enter the reason for rejecting this NFA document.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={5}
            placeholder="Reject reason…"
            className="text-sm"
          />
          {rejectError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {rejectError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={submitReject}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />{" "}
              {rejectMutation.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clarifyOpen}
        onOpenChange={(o) => {
          setClarifyOpen(o);
          if (!o) {
            setClarifyText("");
            setClarifyError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Clarification {openedNfaNo ? `— ${openedNfaNo}` : ""}</DialogTitle>
            <DialogDescription>
              Enter the clarification you want to send for this NFA document.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={clarifyText}
            onChange={(e) => setClarifyText(e.target.value)}
            rows={6}
            placeholder="Type your clarification…"
            className="text-sm"
          />
          {clarifyError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {clarifyError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setClarifyOpen(false)}
              disabled={clarifyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!clarifyText.trim() || clarifyMutation.isPending}
              onClick={submitClarify}
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />{" "}
              {clarifyMutation.isPending ? "Sending…" : "Send Mail"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={disClarifyOpen}
        onOpenChange={(o) => {
          setDisClarifyOpen(o);
          if (!o) {
            setDisClarifyLines([]);
            setDisClarifyError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Display Clarification {openedNfaNo ? `— ${openedNfaNo}` : ""}
            </DialogTitle>
            <DialogDescription>
              Clarification text recorded in SAP for this NFA document.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            rows={10}
            value={
              disClarifyMutation.isPending
                ? "Loading…"
                : disClarifyLines.length > 0
                  ? disClarifyLines.join("\n")
                  : disClarifyError
                    ? ""
                    : "No clarification found for this NFA."
            }
            className="font-mono text-xs"
          />
          {disClarifyError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {disClarifyError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisClarifyOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>





      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-5xl p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>NFA Preview {openedNfaNo ? `— ${openedNfaNo}` : ""}</DialogTitle>
            <DialogDescription>
              PDF generated from SAP. Use your browser print controls if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {printMutation.isPending ? (
              <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating preview…
              </div>
            ) : printError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                {printError}
              </div>
            ) : printBlobUrl || printDataUrl ? (
              <>
                <div className="rounded-md border bg-white">
                  {isImagePreview ? (
                    <div className="flex h-[65vh] w-full items-center justify-center overflow-auto rounded-md p-2">
                      <img
                        src={printBlobUrl ?? printDataUrl ?? undefined}
                        alt={`NFA preview${openedNfaNo ? ` for ${openedNfaNo}` : ""}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={printBlobUrl ?? printDataUrl ?? undefined}
                      title="NFA preview"
                      className="h-[65vh] w-full rounded-md"
                    />
                  )}
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => window.open(printBlobUrl ?? printDataUrl ?? "", "_blank")}
                  >
                    Open in new tab
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={onPrintDownload}
                  >
                    Download
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No preview data available.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

