import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/exec/page-header";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/notifications")({ component: Notifications });

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  async function markAll() {
    if (!(await confirm({
      title: "Mark all notifications as read?",
      description: "This will clear the unread indicator on every notification.",
      confirmLabel: "Mark all read",
      destructive: false,
    }))) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
    qc.invalidateQueries();
    toast.success("All marked as read");
  }

  return (
    <div className="page-shell page-stack max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title="Notifications"
        subtitle="Real-time approval alerts."
        actions={<Button variant="outline" size="sm" onClick={markAll}>Mark all read</Button>}
      />
      {isLoading ? (
        <SkeletonRows rows={5} columns={1} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title="No notifications yet" description="You'll see real-time approval alerts here." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Link key={n.id} to="/approval/$id" params={{ id: n.document_id! }}>
              <Card className={`p-4 hover:shadow-elegant ${!n.read_at ? "border-l-4 border-l-primary" : ""}`}>
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground mt-1">{n.body}</div>}
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">{formatDateTime(n.created_at)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
