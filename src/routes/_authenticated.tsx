import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, History, Settings, Users, LogOut, Leaf, Bell, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncFromSAP } from "@/lib/sap/sap.functions";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role);
    },
  });

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", user!.id).is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("inbox-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["unread", user.id] });
        qc.invalidateQueries({ queryKey: ["inbox"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_steps" }, () => {
        qc.invalidateQueries({ queryKey: ["inbox"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const isAdmin = roles?.includes("Admin");
  const sync = useServerFn(syncFromSAP);

  async function pullSap() {
    const t = toast.loading("Syncing from SAP…");
    try {
      const res = await sync();
      toast.success(`Synced — ${res.inserted} new document${res.inserted === 1 ? "" : "s"}`, { id: t });
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Sync failed", { id: t });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const nav_items = [
    { to: "/inbox", label: "Inbox", icon: Inbox },
    { to: "/history", label: "History", icon: History },
    ...(isAdmin ? [
      { to: "/admin/users", label: "Users & Roles", icon: Users },
      { to: "/admin/strategies", label: "Release Strategies", icon: ShieldCheck },
    ] : []),
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-gradient-primary grid place-items-center"><Leaf className="h-4 w-4 text-primary-foreground" /></div>
          <div>
            <div className="font-display font-semibold leading-tight">Resustainability</div>
            <div className="text-xs text-sidebar-foreground/60">SAP Approvals</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav_items.map((it) => {
            const active = pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link key={it.to} to={it.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <Icon className="h-4 w-4" /> {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 text-xs text-sidebar-foreground/60 truncate">{profile?.full_name || user.email}</div>
          <div className="px-2 flex flex-wrap gap-1">
            {(roles ?? []).slice(0, 4).map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
            {!roles?.length && <span className="text-[10px] text-sidebar-foreground/60">No roles assigned</span>}
          </div>
          <Button onClick={logout} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {open && <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0">
        <header className="h-14 border-b bg-card flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-20">
          <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(true)}>☰</button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={pullSap}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Sync SAP
          </Button>
          <Link to="/notifications" className="relative p-2 rounded-md hover:bg-accent">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute top-0 right-0 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] grid place-items-center">{unread}</span>}
          </Link>
        </header>
        <main className="p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
