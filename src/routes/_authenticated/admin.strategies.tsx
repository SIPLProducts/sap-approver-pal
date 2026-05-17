import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DOC_TYPE_LABELS } from "@/lib/approvals/constants";

export const Route = createFileRoute("/_authenticated/admin/strategies")({ component: Strategies });

function Strategies() {
  const { data: rows = [] } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => (await supabase.from("approval_strategies").select("*").order("doc_type")).data ?? [],
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Release Strategies</h1>
        <p className="text-sm text-muted-foreground">Approval chains for each SAP transaction. Editable per BU / value band.</p>
      </div>
      <div className="grid gap-3">
        {rows.map((s) => {
          const meta = DOC_TYPE_LABELS[s.doc_type];
          return (
            <Card key={s.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <div className="font-semibold">{meta?.label ?? s.doc_type}</div>
                  <div className="text-xs text-muted-foreground">T-code: <span className="font-mono">{meta?.tcode}</span> • Module: {meta?.module} {s.business_unit ? `• BU: ${s.business_unit}` : ""}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(s.roles_in_order ?? []).map((r, i) => (
                    <Badge key={i} variant="outline">{i + 1}. {r}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
