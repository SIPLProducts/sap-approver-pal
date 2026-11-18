import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/exec/page-header";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useActiveContext } from "@/hooks/use-active-context";

type Status = "pending" | "completed" | "rejected";

export const Route = createFileRoute("/_authenticated/imw/transportation-exception-billing-approvals")({
  head: () => ({
    meta: [
      { title: "Transportation (90%) Exception Billing Approvals — IWM Approvals" },
      {
        name: "description",
        content: "Review transportation 90% exception billing approvals by plant and status.",
      },
      {
        property: "og:title",
        content: "Transportation (90%) Exception Billing Approvals — IWM Approvals",
      },
      {
        property: "og:description",
        content: "Review transportation 90% exception billing approvals by plant and status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransportationExceptionBillingApprovalsPage,
});

function TransportationExceptionBillingApprovalsPage() {
  const { activePlants } = useActiveContext();
  const [plants, setPlants] = useState<string[]>(activePlants);
  const [status, setStatus] = useState<Status>("pending");

  function execute() {
    if (plants.length === 0) {
      toast.error("Select at least one plant");
      return;
    }
    toast.info("This screen is UI-only; SAP execution is not connected.");
  }

  useEffect(() => {
    setPlants((current) => {
      if (activePlants.length === 0) return [];
      const allowed = new Set(activePlants);
      const kept = current.filter((plant) => allowed.has(plant));
      return kept.length > 0 ? kept : activePlants;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlants.join(",")]);

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Transportation (90%) Exception Billing Approvals"
        subtitle="Review transportation exception billing approval records by plant and status."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[220px_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Plant <span className="text-destructive">*</span>
            </Label>
            <PlantMultiSelect value={plants} onChange={setPlants} source="iwm-plant" />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={execute} disabled={plants.length === 0}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Execute
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
              onValueChange={(value) => setStatus(value as Status)}
              className="flex items-center gap-5"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="pending" id="transport-approval-pending" />
                Pending
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="completed" id="transport-approval-completed" />
                Completed
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="rejected" id="transport-approval-rejected" />
                Rejected
              </label>
            </RadioGroup>
          </div>
        </div>
      </Card>
    </div>
  );
}