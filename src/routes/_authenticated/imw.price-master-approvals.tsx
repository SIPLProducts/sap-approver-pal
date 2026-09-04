import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/exec/page-header";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { CustomerSelect } from "@/components/sap/customer-select";
import { CloudscapeApprovalTable } from "@/components/aws/cloudscape-approval-table";
import { useActiveContext } from "@/hooks/use-active-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imw/price-master-approvals")({
  head: () => ({
    meta: [
      { title: "Price Master Update Approvals — IWM Approvals" },
      {
        name: "description",
        content:
          "Review pending, approved and rejected price master update requests by plant, customer and date range.",
      },
      { property: "og:title", content: "Price Master Update Approvals — IWM Approvals" },
      {
        property: "og:description",
        content:
          "Review pending, approved and rejected price master update requests by plant, customer and date range.",
      },
    ],
  }),
  component: PriceMasterApprovalsPage,
});

type Status = "pending" | "approved" | "rejected";

function PriceMasterApprovalsPage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [customer, setCustomer] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<Status>("pending");

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
    toast.info("Approvals data will load once the SAP approvals API is configured.");
  }

  function reset() {
    setPlants(activePlants);
    setCustomer("");
    setDateFrom("");
    setDateTo("");
    setStatus("pending");
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Price Master Update Approvals"
        subtitle="Review price master update requests routed from SAP for the selected plant, customer and date range."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-3 lg:grid-cols-5">
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
            <Label className="text-xs">Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9"
            />
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

        <div className="mt-4 -mx-4 border-t px-4 pt-3">
          <div className="flex flex-wrap items-center gap-6">
            <Label className="text-xs text-muted-foreground">
              Status <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as Status)}
              className="flex items-center gap-5"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="pending" id="pma-pending" />
                Pending
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="approved" id="pma-approved" />
                Approved
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="rejected" id="pma-rejected" />
                Rejected
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>

      <CloudscapeApprovalTable
        title={`Price Master Update Approvals — ${status}`}
        countLabel="(0)"
        rows={[]}
        rowKey={(_r: Record<string, unknown>, i: number) => String(i)}
        emptyMessage="Select a Plant and click Execute to load approval records from SAP."
        columns={[]}
      />
    </div>
  );
}
