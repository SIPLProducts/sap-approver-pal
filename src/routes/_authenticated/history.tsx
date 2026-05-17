import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

function HistoryPage() {
  const { user } = useAuth();
  const { data: rows = [] } = useQuery({
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Documents you've actioned.</p>
      </div>
      {rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No history yet.</Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((d) => (
            <Link key={d.id} to="/approval/$id" params={{ id: d.id }}>
              <Card className="p-4 hover:shadow-elegant flex justify-between items-center">
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-xs text-muted-foreground">{d.sap_doc_no} • {d.plant}/{d.business_unit}</div>
                </div>
                <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>{d.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
