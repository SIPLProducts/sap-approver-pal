import { createFileRoute } from "@tanstack/react-router";
import { SdApprovalShell, fmtINR, fmtDate, type ColumnDef } from "@/components/sd/sd-approval-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/sd/price")({ component: PricePage });

const columns: ColumnDef[] = [
  { key: "plant", label: "Plant", mono: true, render: (d) => d.plant },
  { key: "sap_doc_no", label: "Condition Doc", mono: true, render: (d) => d.sap_doc_no },
  { key: "customer", label: "Customer", mono: true, render: (d) => d.customer_sap_id ?? "—" },
  { key: "customer_name", label: "Customer Name", render: (d) => <span className="font-medium">{d.customer_name ?? "—"}</span> },
  { key: "material", label: "Material / Title", render: (d) => d.title },
  { key: "valid_from", label: "Valid From", render: (d) => fmtDate(d.document_date) },
  { key: "amount", label: "Amount (₹)", align: "right", render: (d) => fmtINR(d.total_value) },
  { key: "raised_by", label: "Raised By", render: (d) => d.requester_name },
  { key: "status", label: "Status", render: (d) => <Badge variant="outline" className="capitalize">{d.status}</Badge> },
];

function PricePage() {
  return (
    <SdApprovalShell
      title="Price Approvals"
      subtitle="BMW VK11 condition approvals synced from SAP. Single-level release."
      tCode="ZBMW_VK11_APP"
      levels="Single level"
      docType="BMW_PRICE"
      columns={columns}
    />
  );
}
