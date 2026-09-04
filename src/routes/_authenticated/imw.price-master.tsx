import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, Filter, RotateCcw } from "lucide-react";


import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/exec/page-header";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";
import { useActiveContext } from "@/hooks/use-active-context";
import { fetchPriceMaster, type PriceMasterRow } from "@/lib/imw/price-master.functions";
import { formatAmount, formatSapDateDMY } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/imw/price-master")({
  head: () => ({
    meta: [
      { title: "Price Master Update — IMW Approvals" },
      {
        name: "description",
        content: "Display or update SAP price master records by plant and customer.",
      },
      { property: "og:title", content: "Price Master Update — IMW Approvals" },
      {
        property: "og:description",
        content: "Display or update SAP price master records by plant and customer.",
      },
    ],
  }),
  component: PriceMasterUpdatePage,
});

type Mode = "display" | "update";
type Row = PriceMasterRow;

/** SAP key → business label, in display order. */
const COLUMN_DEFS: { key: string; label: string; kind: "text" | "amount" | "date" }[] = [
  { key: "WERKS", label: "Plant", kind: "text" },
  { key: "KUNNR", label: "Customer ID", kind: "text" },
  { key: "ZCUST_NAME", label: "Customer Name", kind: "text" },
  { key: "WST_TYPE", label: "Waste Type", kind: "text" },
  { key: "MATNR", label: "Material Number", kind: "text" },
  { key: "PRICE", label: "Price", kind: "amount" },
  { key: "ZCHECK", label: "Default", kind: "text" },
  { key: "ESCRO", label: "Escrow Chg", kind: "text" },
  { key: "TRIP", label: "Trip Chg", kind: "text" },
  { key: "ZDEACTIVE", label: "Deactive", kind: "text" },
  { key: "ZKGS", label: "Kgs", kind: "text" },
  { key: "LUMSUMM", label: "Lumsum", kind: "text" },
  { key: "INCLUSIVE", label: "Inclusive", kind: "text" },
  { key: "MF_QTY", label: "Manifest Qty", kind: "text" },
  { key: "MF_VALID_FROM", label: "Manifest From Date", kind: "date" },
  { key: "MF_VALID_TO", label: "Manifest To Date", kind: "date" },
  { key: "PRICE_WB02", label: "ZWB02 Price", kind: "amount" },
  { key: "TRIP_PRICE", label: "Trip Price", kind: "amount" },
  { key: "VALID_FROM", label: "Valid From", kind: "date" },
  { key: "VALID_TO", label: "Valid To", kind: "date" },
  { key: "ZZ_CA_DATE", label: "CA Date", kind: "date" },
  { key: "PRUEFLOS", label: "CA Number", kind: "text" },
  { key: "SPE_HANDLING", label: "Spc Handling Chg", kind: "amount" },
  { key: "EQP_HIRE", label: "Eqp Hire Chg", kind: "amount" },
  { key: "UNLOADING_LOAD", label: "Un / Ln Chg", kind: "amount" },
  { key: "OTHERS", label: "Others Chg", kind: "amount" },
  { key: "TON1", label: "1 Ton", kind: "amount" },
  { key: "TON5", label: "5 Ton", kind: "amount" },
  { key: "TON8", label: "8 Ton", kind: "amount" },
  { key: "TON10", label: "10 Ton", kind: "amount" },
  { key: "TON12", label: "12 Ton", kind: "amount" },
  { key: "TON15", label: "15 Ton", kind: "amount" },
  { key: "TON18", label: "18 Ton", kind: "amount" },
  { key: "TON20", label: "20 Ton", kind: "amount" },
  { key: "TON25", label: "25 Ton", kind: "amount" },
  { key: "TON30", label: "30 Ton", kind: "amount" },
  { key: "TON35", label: "35 Ton", kind: "amount" },
  { key: "PRICE_REMARKS", label: "Price Remarks", kind: "text" },
];

const ZERO_DATES = new Set(["00000000", "0000-00-00", "0000000000", ""]);

function renderCell(row: Row, def: (typeof COLUMN_DEFS)[number]) {
  const v = row?.[def.key];
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const s = String(v).trim();
  if (def.kind === "date") return ZERO_DATES.has(s) ? "—" : formatSapDateDMY(s, "—");
  if (def.kind === "amount") return formatAmount(s, s);
  return s;
}

function PriceMasterUpdatePage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [customer, setCustomer] = useState("");
  const [mode, setMode] = useState<Mode>("display");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<
    Record<string, { PRICE?: string; PRICE_WB02?: string; PRICE_REMARKS?: string }>
  >({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogUserId, setDialogUserId] = useState("");
  const [dialogPassword, setDialogPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const runFetch = useServerFn(fetchPriceMaster);

  const mutation = useMutation({
    mutationFn: (vars: {
      plants: string[];
      customer?: string;
      mode: Mode;
      user_name?: string;
      password?: string;
    }) => runFetch({ data: vars }),
    onSuccess: (res) => {
      setSelected(new Set());
      setRows(res.rows ?? []);
      if (res.error) toast.error(res.error);
      else if (res.sapMessage) toast.info(res.sapMessage);
    },
    onError: (e: Error) => {
      setRows([]);
      setSelected(new Set());
      toast.error(e.message || "Could not load price master records");
    },
  });

  const columns = useMemo<CloudscapeColumn<Row>[]>(
    () =>
      COLUMN_DEFS.map((def) => ({
        id: def.key,
        header: def.label,
        align: def.kind === "amount" ? ("right" as const) : undefined,
        cell: (r: Row) => renderCell(r, def),
      })),
    [],
  );

  useEffect(() => {
    setPlants((prev) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = prev.filter((c) => allowed.has(c));
      return kept.length === 0 ? activePlants : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  function execute(creds?: { user_name: string; password: string }) {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    const isUpdate = mode === "update";
    if (isUpdate && !creds) {
      setDialogOpen(true);
      return;
    }
    mutation.mutate({
      plants,
      customer: customer.trim() || undefined,
      mode,
      user_name: isUpdate ? creds!.user_name : "",
      password: isUpdate ? creds!.password : "",
    });
  }

  function reset() {
    setPlants(activePlants);
    setCustomer("");
    setMode("display");
    setRows([]);
    setSelected(new Set());
    setDialogOpen(false);
    setDialogUserId("");
    setDialogPassword("");
    setShowPassword(false);
  }

  function executeFromDialog() {
    if (!dialogUserId.trim() || !dialogPassword.trim()) return;
    setDialogOpen(false);
    execute({ user_name: dialogUserId.trim(), password: dialogPassword });
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IMW Approvals"
        title="Price Master Update"
        subtitle="Display or update price master records for the selected plant and customer."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[220px_220px_1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <CustomerSelect
              value={customer}
              onChange={setCustomer}
              plants={plants}
              onEnter={() => execute()}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => {
                const next = v as Mode;
                setMode(next);
                if (next === "update") {
                  setDialogOpen(true);
                } else {
                  setDialogOpen(false);
                  setDialogUserId("");
                  setDialogPassword("");
                  setShowPassword(false);
                }
              }}
              className="flex h-9 items-center gap-5"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="display" id="imw-mode-display" />
                Display
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="update" id="imw-mode-update" />
                Update
              </label>
            </RadioGroup>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => execute()}
              disabled={plants.length === 0 || mutation.isPending}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {mutation.isPending ? "Loading…" : "Execute"}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <CloudscapeApprovalTable
        title="Price Master"
        countLabel={`(${rows.length})`}
        rows={rows}
        loading={mutation.isPending}
        showSelect
        selectedKeys={selected}
        onSelectionChange={setSelected}
        rowKey={(_r: Row, i: number) => String(i)}
        emptyMessage="Select a Plant and click Execute to load price master records from SAP."
        columns={columns}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Price Master Update — Credentials</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="imw-update-userid" className="text-xs font-medium">
                User ID
              </Label>
              <Input
                id="imw-update-userid"
                type="text"
                autoComplete="username"
                placeholder="Enter User ID"
                value={dialogUserId}
                onChange={(e) => setDialogUserId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imw-update-password" className="text-xs font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="imw-update-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={dialogPassword}
                  onChange={(e) => setDialogPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={executeFromDialog}
              disabled={!dialogUserId.trim() || !dialogPassword.trim()}
            >
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
