import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Filter, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/exec/page-header";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import { buildDynamicColumns } from "@/lib/sd/dynamic-columns";
import { useActiveContext } from "@/hooks/use-active-context";

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
type Row = Record<string, unknown>;

function PriceMasterUpdatePage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [customer, setCustomer] = useState("");
  const [mode, setMode] = useState<Mode>("display");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    setPlants((prev) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = prev.filter((c) => allowed.has(c));
      return kept.length === 0 ? activePlants : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    setRows([]);
    toast.info("SAP connection for Price Master Update is not configured yet.");
  }

  function reset() {
    setPlants(activePlants);
    setCustomer("");
    setMode("display");
    setRows([]);
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
              onEnter={execute}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
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
            <Button size="sm" onClick={execute} disabled={plants.length === 0}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Execute
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
        rowKey={(_r: Row, i: number) => String(i)}
        emptyMessage="Select a Plant and click Execute to load price master records from SAP."
        columns={buildDynamicColumns(rows)}
      />
    </div>
  );
}
