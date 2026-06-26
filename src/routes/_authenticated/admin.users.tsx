import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { ROLE_LABELS, type AppRole } from "@/lib/approvals/constants";
import { SCREEN_GROUPS, PERMISSION_ACTIONS } from "@/lib/admin/screen-keys";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  UserPlus, Search, Trash2, Plus, ShieldCheck, Building2,
  UsersRound, UserCog, RefreshCw, Pencil, UserX,
} from "lucide-react";
import { inviteUser, deleteUser, setBuiltInRole } from "@/lib/admin/user-mgmt.functions";
import { PlantMultiSelect } from "@/components/sap/plant-multi-select";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UserManagementPage,
});

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];
const ADMIN_ROLES: AppRole[] = ["Admin"];
const HEAD_ROLE_KEYS: AppRole[] = [
  "PlantHead", "SCMHead", "StoreHOD", "ProjectHead", "FinanceHead", "HOD",
  "M1", "S4", "T6",
];

function UserManagementPage() {
  const [tab, setTab] = useState("users");
  const [tenantScope, setTenantScope] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "" as AppRole | "", plants: [] as string[] });
  const [roleCreateOpen, setRoleCreateOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", tenant_id: "" });
  const qc = useQueryClient();
  const inviteFn = useServerFn(inviteUser);

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => (await supabase.from("tenants").select("*").order("name")).data ?? [],
  });

  async function submitInvite() {
    if (!inviteForm.email || !inviteForm.full_name) return toast.error("Email and full name are required");
    try {
      await inviteFn({ data: {
        email: inviteForm.email, full_name: inviteForm.full_name,
        role: (inviteForm.role || undefined) as AppRole | undefined,
        plants: inviteForm.plants.length > 0 ? inviteForm.plants : undefined,
      } });
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInviteForm({ email: "", full_name: "", role: "", plants: [] });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-user-tenants"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function submitCreateRole() {
    if (!roleForm.name) return toast.error("Name required");
    const { error } = await supabase.from("custom_roles").insert({
      name: roleForm.name,
      description: roleForm.description || null,
      tenant_id: roleForm.tenant_id || (tenantScope !== "all" ? tenantScope : null),
    });
    if (error) return toast.error(error.message);
    toast.success("Custom role created");
    setRoleCreateOpen(false);
    setRoleForm({ name: "", description: "", tenant_id: "" });
    qc.invalidateQueries({ queryKey: ["admin-custom-roles"] });
  }

  function refreshAll() {
    if (tab === "custom_roles") {
      qc.invalidateQueries({ queryKey: ["admin-custom-roles"] });
    } else {
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
      qc.invalidateQueries({ queryKey: ["admin-user-custom-roles"] });
      qc.invalidateQueries({ queryKey: ["admin-user-tenants"] });
    }
    toast.success("Refreshed");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-10 w-10 rounded-lg bg-primary/10 text-primary items-center justify-center mt-0.5">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User &amp; Role Management</h1>
            <p className="text-sm text-muted-foreground">
              Create user accounts, assign roles (from Role Management), and manage access
            </p>
          </div>
        </div>
        {tab === "users" ? (
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="h-4 w-4 mr-2" /> Create User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite a new user</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Full name</Label><Input value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} /></div>
                  <div>
                    <Label>Initial role (optional)</Label>
                    <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as AppRole })}>
                      <SelectTrigger><SelectValue placeholder="No role" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plants (optional)</Label>
                    <PlantMultiSelect
                      value={inviteForm.plants}
                      onChange={(plants) => setInviteForm({ ...inviteForm, plants })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button onClick={submitInvite}>Send invite</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={refreshAll}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          </div>
        ) : tab === "custom_roles" ? (
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <Button variant="outline" onClick={refreshAll}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
            <Dialog open={roleCreateOpen} onOpenChange={setRoleCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add Role</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create custom role</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} /></div>
                  <div><Label>Description</Label><Input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} /></div>
                  <div>
                    <Label>Tenant scope</Label>
                    <Select value={roleForm.tenant_id} onValueChange={(v) => setRoleForm({ ...roleForm, tenant_id: v })}>
                      <SelectTrigger><SelectValue placeholder={tenantScope !== "all" ? "Current tenant" : "Global"} /></SelectTrigger>
                      <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRoleCreateOpen(false)}>Cancel</Button>
                  <Button onClick={submitCreateRole}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={tenantScope} onValueChange={setTenantScope}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Tenant scope" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="custom_roles">Custom Roles</TabsTrigger>
          <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
          <TabsTrigger value="matrix">Approval Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="custom_roles"><CustomRolesTab tenantScope={tenantScope} /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="matrix"><ApprovalMatrixTab tenantScope={tenantScope} tenants={tenants} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
 * KPI TILE
 * ============================================================ */
function KpiTile({
  icon: Icon, value, label, tone,
}: {
  icon: typeof UsersRound;
  value: number;
  label: string;
  tone: "primary" | "destructive" | "accent" | "muted";
}) {
  const toneCls =
    tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "destructive" ? "bg-destructive/10 text-destructive"
    : tone === "accent" ? "bg-accent text-accent-foreground"
    : "bg-muted text-muted-foreground";
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${toneCls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

/* ============================================================
 * USERS TAB
 * ============================================================ */
function UsersTab() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [plantFilter, setPlantFilter] = useState<string>("all");
  const deleteFn = useServerFn(deleteUser);
  const roleFn = useServerFn(setBuiltInRole);

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const { data: customLinks = [] } = useQuery({
    queryKey: ["admin-user-custom-roles"],
    queryFn: async () => (await supabase.from("user_custom_roles").select("*, custom_roles(name)")).data ?? [],
  });
  const { data: tenantLinks = [] } = useQuery({
    queryKey: ["admin-user-tenants"],
    queryFn: async () => (await supabase.from("user_tenants").select("*, tenants(name, code)")).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (s && !`${p.full_name ?? ""} ${p.email ?? ""} ${p.sap_user_id ?? ""}`.toLowerCase().includes(s)) return false;
      if (plantFilter !== "all") {
        const userPlants = tenantLinks.filter((t: any) => t.user_id === p.id).map((t: any) => t.tenants?.code);
        if (!userPlants.includes(plantFilter)) return false;
      }
      return true;
    });
  }, [profiles, tenantLinks, search, plantFilter]);

  const kpis = useMemo(() => {
    const total = profiles.length;
    const adminIds = new Set(roles.filter((r) => ADMIN_ROLES.includes(r.role as AppRole)).map((r) => r.user_id));
    const headIds = new Set(roles.filter((r) => HEAD_ROLE_KEYS.includes(r.role as AppRole)).map((r) => r.user_id));
    const assignedIds = new Set([
      ...roles.map((r) => r.user_id),
      ...customLinks.map((r: any) => r.user_id),
    ]);
    const unassigned = profiles.filter((p) => !assignedIds.has(p.id)).length;
    return { total, admins: adminIds.size, heads: headIds.size, unassigned };
  }, [profiles, roles, customLinks]);




  async function handleDelete(userId: string) {
    if (!confirm("Delete this user permanently?")) return;
    try {
      await deleteFn({ data: { user_id: userId } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggleRole(userId: string, role: AppRole, has: boolean) {
    try {
      await roleFn({ data: { user_id: userId, role, action: has ? "remove" : "add" } });
      qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
    } catch (e: any) { toast.error(e.message); }
  }

  function rolePillFor(userId: string) {
    const built = roles.filter((r) => r.user_id === userId).map((r) => r.role as AppRole);
    const custom = customLinks.filter((r: any) => r.user_id === userId);
    if (built.length === 0 && custom.length === 0) return null;
    const primary: AppRole | undefined = built.find((r) => ADMIN_ROLES.includes(r))
      ?? built.find((r) => HEAD_ROLE_KEYS.includes(r))
      ?? built[0];

    if (primary && ADMIN_ROLES.includes(primary)) {
      return { label: ROLE_LABELS[primary], cls: "bg-primary text-primary-foreground" };
    }
    if (primary) {
      return { label: ROLE_LABELS[primary], cls: "bg-secondary text-secondary-foreground" };
    }
    return { label: custom[0]?.custom_roles?.name ?? "Custom", cls: "bg-accent text-accent-foreground" };
  }

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile icon={UsersRound} value={kpis.total} label="Total Users" tone="primary" />
        <KpiTile icon={ShieldCheck} value={kpis.admins} label="Administrators" tone="destructive" />
        <KpiTile icon={Building2} value={kpis.heads} label="Role Heads" tone="accent" />
        <KpiTile icon={UserX} value={kpis.unassigned} label="Unassigned" tone="muted" />
      </div>

      {/* Users panel */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="text-sm text-muted-foreground">View and manage user roles</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-1">
              <div className="w-56">
                <PlantSelect
                  value={plantFilter === "all" ? "" : plantFilter}
                  onChange={(v) => setPlantFilter(v ? v : "all")}
                  placeholder="All plants"
                />
              </div>
              {plantFilter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setPlantFilter("all")}>
                  Clear
                </Button>
              )}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plants</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const userRoles = roles.filter((r) => r.user_id === p.id);
                const userTenants = tenantLinks.filter((r: any) => r.user_id === p.id);
                const isSelf = p.id === me?.id;
                const pill = rolePillFor(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.full_name || "—"}{" "}
                      {isSelf && <Badge variant="outline" className="ml-1">you</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.sap_user_id || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {userTenants.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {userTenants.map((t: any) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-foreground/80"
                          >
                            {t.tenants?.code ?? "?"}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pill ? (
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${pill.cls}`}>
                          {pill.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline" disabled={isSelf}>
                              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 max-h-80 overflow-y-auto p-2">
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Toggle roles</div>
                            {ALL_ROLES.map((r) => {
                              const has = userRoles.some((ur) => ur.role === r);
                              return (
                                <button key={r} onClick={() => toggleRole(p.id, r, has)}
                                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center justify-between">
                                  <span>{ROLE_LABELS[r]}</span>
                                  {has && <Badge variant="secondary" className="text-[10px]">on</Badge>}
                                </button>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isSelf}
                          onClick={() => handleDelete(p.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users match the filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
 * CUSTOM ROLES TAB
 * ============================================================ */
function CustomRolesTab({ tenantScope: _tenantScope }: { tenantScope: string }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ id: string; name: string; description: string; is_active: boolean } | null>(null);

  const { data: customRoles = [] } = useQuery({
    queryKey: ["admin-custom-roles"],
    queryFn: async () => (await supabase.from("custom_roles").select("*, user_custom_roles(count)").order("name")).data ?? [],
  });

  async function toggleActive(id: string, next: boolean) {
    const { error } = await supabase.from("custom_roles").update({ is_active: next }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-custom-roles"] });
  }

  async function saveEdit() {
    if (!editForm) return;
    if (!editForm.name) return toast.error("Name required");
    const { error } = await supabase.from("custom_roles").update({
      name: editForm.name,
      description: editForm.description || null,
      is_active: editForm.is_active,
    }).eq("id", editForm.id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    setEditOpen(false);
    setEditForm(null);
    qc.invalidateQueries({ queryKey: ["admin-custom-roles"] });
  }

  async function deleteRole(id: string, userCount: number) {
    if (userCount > 0) return toast.error("Unassign users from this role first");
    const { error } = await supabase.from("custom_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-custom-roles"] });
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-base font-semibold">All Roles</h2>
        <p className="text-xs text-muted-foreground">{customRoles.length} role(s) configured</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customRoles.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-semibold">{r.name}</TableCell>
              <TableCell className="text-muted-foreground">{r.description || "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch checked={!!r.is_active} onCheckedChange={(v) => toggleActive(r.id, v)} />
                  <Badge variant={r.is_active ? "default" : "outline"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditForm({ id: r.id, name: r.name, description: r.description ?? "", is_active: !!r.is_active }); setEditOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRole(r.id, r.user_custom_roles?.[0]?.count ?? 0)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {customRoles.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No custom roles yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit role</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editForm.is_active} onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============================================================
 * PERMISSIONS TAB
 * ============================================================ */
function PermissionsTab() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<string>("builtin:Admin");

  const { data: customRoles = [] } = useQuery({
    queryKey: ["admin-custom-roles-simple"],
    queryFn: async () => (await supabase.from("custom_roles").select("id, name").order("name")).data ?? [],
  });
  const { data: perms = [] } = useQuery({
    queryKey: ["role-permissions", target],
    queryFn: async () => {
      const q = supabase.from("role_permissions").select("*");
      if (target.startsWith("builtin:")) q.eq("built_in_role", target.slice(8) as AppRole);
      else q.eq("custom_role_id", target.slice(7));
      return (await q).data ?? [];
    },
  });

  const allowedSet = useMemo(() => new Set(perms.filter((p) => p.allowed).map((p) => `${p.screen_key}:${p.action}`)), [perms]);

  async function toggle(screen: string, action: string) {
    const key = `${screen}:${action}`;
    const allowed = !allowedSet.has(key);
    const row: any = { screen_key: screen, action, allowed };
    if (target.startsWith("builtin:")) row.built_in_role = target.slice(8);
    else row.custom_role_id = target.slice(7);

    const existing = perms.find((p) => p.screen_key === screen && p.action === action);
    if (existing) {
      await supabase.from("role_permissions").update({ allowed }).eq("id", existing.id);
    } else {
      await supabase.from("role_permissions").insert(row);
    }
    qc.invalidateQueries({ queryKey: ["role-permissions", target] });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-medium">Role permission matrix</p>
          <p className="text-sm text-muted-foreground">Toggles persist immediately. Select a role to load its current allowed permissions.</p>
        </div>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Built-in roles</div>
            {ALL_ROLES.map((r) => <SelectItem key={r} value={`builtin:${r}`}>{ROLE_LABELS[r]}</SelectItem>)}
            {customRoles.length > 0 && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Custom roles</div>}
            {customRoles.map((r) => <SelectItem key={r.id} value={`custom:${r.id}`}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {SCREEN_GROUPS.map((g) => (
        <div key={g.module}>
          <h3 className="font-semibold mb-2 text-sm tracking-wide uppercase text-muted-foreground">{g.module}</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Screen</TableHead>
                {PERMISSION_ACTIONS.map((a) => <TableHead key={a} className="capitalize text-center">{a}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {g.screens.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell className="font-medium">{s.label} <code className="text-[10px] text-muted-foreground">{s.key}</code></TableCell>
                    {PERMISSION_ACTIONS.map((a) => (
                      <TableCell key={a} className="text-center">
                        <Switch checked={allowedSet.has(`${s.key}:${a}`)} onCheckedChange={() => toggle(s.key, a)} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ============================================================
 * APPROVAL MATRIX TAB
 * ============================================================ */
function ApprovalMatrixTab({ tenantScope, tenants }: { tenantScope: string; tenants: any[] }) {
  const qc = useQueryClient();
  const activeTenant = tenantScope !== "all" ? tenantScope : tenants[0]?.id;

  const { data: rows = [] } = useQuery({
    queryKey: ["approval-matrix", activeTenant],
    enabled: !!activeTenant,
    queryFn: async () => (await supabase.from("approval_matrix").select("*").eq("tenant_id", activeTenant).order("stage_no")).data ?? [],
  });

  async function addRow() {
    if (!activeTenant) return toast.error("Select a tenant scope first");
    const { error } = await supabase.from("approval_matrix").insert({
      tenant_id: activeTenant, stage_no: (rows.at(-1)?.stage_no ?? 0) + 1,
      role_key: "Admin", min_amount: 0, max_amount: null, currency: "INR",
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["approval-matrix", activeTenant] });
  }
  async function patchRow(id: string, patch: any) {
    const { error } = await supabase.from("approval_matrix").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["approval-matrix", activeTenant] });
  }
  async function deleteRow(id: string) {
    await supabase.from("approval_matrix").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["approval-matrix", activeTenant] });
  }

  if (!activeTenant) {
    return <Card className="p-8 text-center text-muted-foreground"><ShieldCheck className="h-8 w-8 mx-auto mb-2" />Create a tenant first to configure an approval matrix.</Card>;
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Tenant: <b>{tenants.find((t) => t.id === activeTenant)?.name ?? activeTenant}</b></p>
        <Button onClick={addRow}><Plus className="h-4 w-4 mr-2" /> Add stage</Button>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Stage</TableHead><TableHead>Role</TableHead>
            <TableHead>Min amount</TableHead><TableHead>Max amount</TableHead>
            <TableHead>Currency</TableHead><TableHead>Active</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Input type="number" value={r.stage_no} onChange={(e) => patchRow(r.id, { stage_no: Number(e.target.value) })} className="w-20" />
                </TableCell>
                <TableCell>
                  <Select value={r.role_key} onValueChange={(v) => patchRow(r.id, { role_key: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">{ALL_ROLES.map((rr) => <SelectItem key={rr} value={rr}>{rr}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Input type="number" value={r.min_amount} onChange={(e) => patchRow(r.id, { min_amount: Number(e.target.value) })} className="w-32" /></TableCell>
                <TableCell><Input type="number" value={r.max_amount ?? ""} onChange={(e) => patchRow(r.id, { max_amount: e.target.value ? Number(e.target.value) : null })} className="w-32" placeholder="∞" /></TableCell>
                <TableCell><Input value={r.currency} onChange={(e) => patchRow(r.id, { currency: e.target.value })} className="w-20" /></TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => patchRow(r.id, { is_active: v })} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => deleteRow(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No stages configured for this tenant.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
