import { createFileRoute } from "@tanstack/react-router";
import { SdApprovalShell, fmtINR, fmtDate, type ColumnDef } from "@/components/sd/sd-approval-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/sd/sales-order")({ component: SoPage });

const columns: ColumnDef[] = [
  { key: "sales_org", label: "Sales Org", mono: true, render: () => "3801" },
  { key: "plant", label: "Plant", mono: true, render: (d) => d.plant },
  { key: "sold_to", label: "Sold-To", mono: true, render: (d) => d.customer_name?.slice(0, 10) ?? "—" },
  { key: "customer_name", label: "Customer Name", render: (d) => <span className="font-medium">{d.customer_name ?? "—"}</span> },
  { key: "so_no", label: "SO No", mono: true, render: (d) => d.sap_doc_no },
  { key: "so_date", label: "SO Date", render: (d) => fmtDate(d.document_date) },
  { key: "material", label: "Material / Title", render: (d) => d.title },
  { key: "net", label: "Net Value", align: "right", render: (d) => fmtINR(d.total_value) },
  { key: "tax", label: "Tax", align: "right", render: (d) => fmtINR(Number(d.total_value) * 0.18) },
  { key: "total", label: "Total", align: "right", render: (d) => fmtINR(Number(d.total_value) * 1.18) },
  { key: "delivery", label: "Delivery Date", render: (d) => fmtDate(d.created_at) },
  { key: "status", label: "Status", render: (d) => <Badge variant="outline" className="capitalize">{d.status}</Badge> },
];

function SoPage() {
  return (
    <SdApprovalShell
      title="Sales Order Approvals"
      subtitle="BMW sales order release approvals synced from SAP."
      tCode="ZSD_BMW_SO_APP"
      levels="Single level"
      docType="BMW_SO"
      columns={columns}
    />
  );
}
