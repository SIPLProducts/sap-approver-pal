import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({ component: Notifications });

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  async function markAll() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
    qc.invalidateQueries();
    toast.success("All marked as read");
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Real-time approval alerts.</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAll}>Mark all read</Button>
      </div>
      {rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground"><Bell className="h-8 w-8 mx-auto mb-2 opacity-40" /> No notifications yet.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Link key={n.id} to="/approval/$id" params={{ id: n.document_id! }}>
              <Card className={`p-4 hover:shadow-elegant ${!n.read_at ? "border-l-4 border-l-primary" : ""}`}>
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground mt-1">{n.body}</div>}
                <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
