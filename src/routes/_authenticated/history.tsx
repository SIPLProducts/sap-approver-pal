import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveContext } from "@/hooks/use-active-context";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { History as HistoryIcon } from "lucide-react";
import { PageHeader } from "@/components/exec/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

function HistoryPage() {
  const { user } = useAuth();
  const { activePlant } = useActiveContext();
  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mySteps } = await supabase.from("approval_steps").select("document_id, status, decided_at").eq("assigned_user", user!.id).not("decided_at", "is", null).order("decided_at", { ascending: false });
      const ids = Array.from(new Set((mySteps ?? []).map((s) => s.document_id)));
      if (!ids.length) return [];
      const { data: docs } = await supabase.from("approval_documents").select("*").in("id", ids).order("updated_at", { ascending: false });
      return docs ?? [];
    },
  });
  const rows = useMemo(() => activePlant ? allRows.filter((d) => d.plant === activePlant) : allRows, [allRows, activePlant]);

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="Approvals" title="History" subtitle="Documents you've actioned." />
      {isLoading ? (
        <SkeletonRows rows={6} columns={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="h-5 w-5" />} title="No history yet" description="Documents you action will appear here." />
      ) : (
        <div className="grid gap-3">
          {rows.map((d) => (
            <Link key={d.id} to="/approval/$id" params={{ id: d.id }}>
              <Card className="p-4 hover:shadow-elegant flex justify-between items-center">
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-xs text-muted-foreground">{d.sap_doc_no} • {d.plant}/{d.business_unit} • {formatDateTime(d.updated_at)}</div>
                </div>
                <StatusBadge status={d.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
