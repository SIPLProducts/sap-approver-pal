import { createFileRoute } from "@tanstack/react-router";
import { SdApprovalShell, fmtINR, fmtDate, type ColumnDef } from "@/components/sd/sd-approval-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/sd/contract")({ component: ContractPage });

const columns: ColumnDef[] = [
  { key: "customer", label: "Customer", mono: true, render: (d) => d.customer_name?.slice(0, 10) ?? "—" },
  { key: "customer_name", label: "Customer Name", render: (d) => <span className="font-medium">{d.customer_name ?? "—"}</span> },
  { key: "contract_no", label: "Contract No", mono: true, render: (d) => d.sap_doc_no },
  { key: "creation", label: "Con. Creation", render: (d) => fmtDate(d.document_date) },
  { key: "material", label: "Material", render: (d) => d.title },
  { key: "net", label: "Net Value", align: "right", render: (d) => fmtINR(d.total_value) },
  { key: "tax", label: "Tax Value", align: "right", render: (d) => fmtINR(Number(d.total_value) * 0.18) },
  { key: "total", label: "Total Agreement", align: "right", render: (d) => fmtINR(Number(d.total_value) * 1.18) },
  { key: "from", label: "From Agreement", render: (d) => fmtDate(d.document_date) },
  { key: "to", label: "To Service Valid", render: (d) => fmtDate(d.created_at) },
  { key: "sales_org", label: "Sales Org", mono: true, render: (d) => "3801" },
  { key: "company", label: "Co. Code", mono: true, render: (d) => "3101" },
  { key: "step", label: "Level", align: "center", render: (d) => <Badge variant="secondary">L{d.current_step_seq}</Badge> },
];

function ContractPage() {
  return (
    <SdApprovalShell
      title="Contract Approvals"
      subtitle="BMW contract value approvals with 2-level release strategy."
      tCode="ZBMW_CONTRACT_APP"
      levels="2 levels"
      docType="BMW_CONTRACT"
      columns={columns}
    />
  );
}
