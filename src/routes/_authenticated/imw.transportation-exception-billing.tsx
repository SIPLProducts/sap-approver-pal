import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/exec/page-header";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomerSelect } from "@/components/sap/customer-select";
import {
  CloudscapeApprovalTable,
  type CloudscapeColumn,
} from "@/components/aws/cloudscape-approval-table";

export const Route = createFileRoute("/_authenticated/imw/transportation-exception-billing")({
  head: () => ({
    meta: [
      { title: "Transportation (90%) Exception Billing — IWM Approvals" },
      {
        name: "description",
        content: "Review transportation 90% exception billing records by customer.",
      },
      { property: "og:title", content: "Transportation (90%) Exception Billing — IWM Approvals" },
      {
        property: "og:description",
        content: "Review transportation 90% exception billing records by customer.",
      },
    ],
  }),
  component: TransportationExceptionBillingPage,
});

type Row = Record<string, unknown>;

const columns: CloudscapeColumn<Row>[] = [];

function TransportationExceptionBillingPage() {
  const [customer, setCustomer] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [executed, setExecuted] = useState(false);

  function execute() {
    setExecuted(true);
  }

  function reset() {
    setCustomer("");
    setCustomerName("");
    setExecuted(false);
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="IWM Approvals"
        title="Transportation (90%) Exception Billing"
        subtitle="Review transportation 90% exception billing records for the selected customer."
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[220px_220px_1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <CustomerSelect
              value={customer}
              onChange={setCustomer}
              onEnter={() => execute()}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Customer Name</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="Customer name"
              className="h-9"
            />
          </div>

          <div />

          <div className="flex gap-2">
            <Button size="sm" onClick={() => execute()}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {executed && (
        <CloudscapeApprovalTable
          title="Transportation (90%) Exception Billing"
          countLabel="(0)"
          rows={[]}
          loading={false}
          rowKey={(_r: Row, i: number) => String(i)}
          emptyMessage="The exception billing service is not connected yet. Results will appear here once it is configured."
          columns={columns}
        />
      )}
    </div>
  );
}
