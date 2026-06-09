import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SdApprovalShell, fmtINR, fmtDate, type ColumnDef } from "@/components/sd/sd-approval-shell";

const searchSchema = z.object({
  status: fallback(z.enum(["pending", "accepted", "rejected"]), "pending").default("pending"),
});

export const Route = createFileRoute("/_authenticated/sd/sc-so")({
  validateSearch: zodValidator(searchSchema),
  component: ScSoPage,
});

const columns: ColumnDef[] = [
  { key: "company", label: "Co. Code", mono: true, render: () => "3101" },
  { key: "sales_org", label: "Sales Org", mono: true, render: () => "3801" },
  { key: "customer", label: "Customer", mono: true, render: (d) => d.customer_name?.slice(0, 10) ?? "—" },
  { key: "customer_name", label: "Customer Name", render: (d) => <span className="font-medium">{d.customer_name ?? "—"}</span> },
  { key: "year", label: "Year", render: (d) => new Date(d.document_date ?? d.created_at).getFullYear() },
  { key: "contract_no", label: "Contract No", mono: true, render: (d) => d.sap_doc_no },
  { key: "contract_item", label: "Item", mono: true, render: () => "10" },
  { key: "ref_no", label: "Contract Ref No", mono: true, render: (d) => d.sap_doc_no.slice(-4) },
  { key: "ref_date", label: "Ref Date", render: (d) => fmtDate(d.document_date) },
  { key: "creation", label: "Creation Date", render: (d) => fmtDate(d.created_at) },
  { key: "start", label: "Contract Start", render: (d) => fmtDate(d.document_date) },
  { key: "end", label: "Contract End", render: (d) => fmtDate(d.created_at) },
  { key: "down_pay", label: "Down Pay Req", align: "right", render: () => "0.00" },
  { key: "adv_amount", label: "Adv. Amount", align: "right", render: (d) => fmtINR(Number(d.total_value) * 0.1) },
  { key: "total", label: "Net Value", align: "right", render: (d) => fmtINR(d.total_value) },
];

function ScSoPage() {
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: "/_authenticated/sd/sc-so" });
  return (
    <SdApprovalShell
      title="Service Certificate & SO Approvals"
      subtitle="BMW Service Certificate / Sales Order PH approvals. Toggle the approval type checkbox to filter."
      tCode="ZBMW_SC_ISSUE_PH"
      levels="Single level"
      docType="BMW_SC_ISSUE"
      columns={columns}
      extraFilters={[
        { id: "sc", label: "Service Certificate Approvals" },
        { id: "so", label: "Sales Order Approvals" },
      ]}
      defaultExtra={["sc"]}
      status={status}
      onStatusChange={(s) => navigate({ search: (prev: any) => ({ ...prev, status: s }) })}
    />
  );
}
