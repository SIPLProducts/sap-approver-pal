import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/approvals/constants";
import type { AppRole } from "@/lib/approvals/constants";
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

function AdminUsers() {
  const qc = useQueryClient();
  const [pick, setPick] = useState<Record<string, AppRole>>({});

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id, role, id")).data ?? [],
  });

  async function addRole(userId: string) {
    const role = pick[userId];
    if (!role) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message); else { toast.success("Role added"); qc.invalidateQueries({ queryKey: ["admin-roles"] }); }
  }
  async function removeRole(id: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Role removed"); qc.invalidateQueries({ queryKey: ["admin-roles"] }); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
        <p className="text-sm text-muted-foreground">Assign SAP release-strategy roles to each user.</p>
      </div>
      <div className="grid gap-3">
        {users.map((u) => {
          const userRoles = roles.filter((r) => r.user_id === u.id);
          return (
            <Card key={u.id} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{u.full_name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email} {u.sap_user_id ? `• SAP: ${u.sap_user_id}` : ""}</div>
                </div>
                <div className="flex flex-wrap gap-1 flex-1">
                  {userRoles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                  {userRoles.map((r) => (
                    <Badge key={r.id} variant="secondary" className="gap-1">
                      {r.role}
                      <button onClick={() => removeRole(r.id)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={pick[u.id] ?? ""} onValueChange={(v) => setPick({ ...pick, [u.id]: v as AppRole })}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Add role…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => addRole(u.id)}>Add</Button>
                </div>
              </div>
            </Card>
          );
        })}
        {!users.length && <Card className="p-8 text-center text-muted-foreground">No users yet. Sign up the first account from /login.</Card>}
      </div>
      <Card className="p-4 bg-accent/40 text-sm">
        <strong>Tip:</strong> The first signed-up user should give themselves the <code>Admin</code> role from the Backend dashboard to manage this page.
      </Card>
    </div>
  );
}
