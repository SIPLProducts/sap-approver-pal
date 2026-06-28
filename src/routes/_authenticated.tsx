import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Truck, History, Settings, Users, LogOut, Bell, RefreshCcw, ShieldCheck, Plug, Server, ChevronDown, Tag, FileText, FileCheck2, ShoppingCart } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncFromSAP } from "@/lib/sap/sap.functions";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const perms = usePermissions();
  const sdOpen = pathname.startsWith("/sd") || pathname.startsWith("/inbox/sd");
  const [sdExpanded, setSdExpanded] = useState(sdOpen);
  useEffect(() => { if (sdOpen) setSdExpanded(true); }, [sdOpen]);

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

  const sdChildren = [
    { to: "/sd/price", label: "Price Approvals", icon: Tag },
    { to: "/sd/contract", label: "Contract Approvals", icon: FileText },
    { to: "/sd/sc-so", label: "Service Cert & SO", icon: FileCheck2 },
    { to: "/sd/sales-order", label: "Sales Order Approvals", icon: ShoppingCart },
  ];

  const nav_items = [
    { to: "/inbox/mm", label: "MM Approvals", icon: Package },
    { to: "/history", label: "History", icon: History },
    ...(isAdmin ? [
      { to: "/admin/users", label: "Users & Roles", icon: Users },
     { to: "/admin/strategies", label: "Release Strategies", icon: ShieldCheck },
     { to: "/admin/sap-api", label: "SAP API Settings", icon: Server },
     { to: "/admin/integrations", label: "Integrations", icon: Plug },
    ] : []),
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky lg:top-0 lg:h-screen z-40 inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-4 py-4 flex items-center gap-3 border-b border-sidebar-border">
          <div className="rounded-lg bg-white px-2 py-1.5 shadow-card flex items-center">
            <BrandLogo className="h-7" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold leading-tight text-[13px] tracking-tight">Re Sustainability</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Executive Approvals</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">Workspaces</div>
          <Link to="/inbox/mm" onClick={() => setOpen(false)}
            className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${pathname.startsWith("/inbox/mm") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
            {pathname.startsWith("/inbox/mm") && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />}
            <Package className="h-4 w-4 shrink-0" /> <span className="truncate">MM Approvals</span>
          </Link>

          {/* SD Approvals expandable group */}
          <button
            type="button"
            onClick={() => setSdExpanded((v) => !v)}
            className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${sdOpen ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}
          >
            {sdOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />}
            <Truck className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left truncate">SD Approvals</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sdExpanded ? "rotate-0" : "-rotate-90"}`} />
          </button>
          {sdExpanded && (
            <div className="ml-5 pl-3 border-l border-sidebar-border/70 space-y-0.5 mt-0.5 mb-1">
              {sdChildren.map((it) => {
                const active = pathname.startsWith(it.to);
                const Icon = it.icon;
                return (
                  <Link key={it.to} to={it.to} onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors ${active ? "bg-sidebar-primary/15 text-sidebar-primary-foreground/95 font-medium" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">Manage</div>
          {nav_items.slice(1).map((it) => {
            const active = pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link key={it.to} to={it.to} onClick={() => setOpen(false)}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />}
                <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-sidebar-accent/40">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-xs font-semibold">
              {(profile?.full_name || user.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium truncate text-sidebar-foreground">{profile?.full_name || user.email}</div>
              <div className="text-[10px] text-sidebar-foreground/55 truncate">{(roles ?? []).join(" · ") || "No roles"}</div>
            </div>
          </div>
          <Button onClick={logout} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/75 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {open && <div className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="h-14 border-b bg-card/80 backdrop-blur-md flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-20">
          <button className="lg:hidden text-muted-foreground p-2 -ml-2 rounded-md hover:bg-accent" onClick={() => setOpen(true)} aria-label="Open menu">
            <span className="text-lg leading-none">☰</span>
          </button>
          <div className="lg:hidden flex items-center"><BrandLogo className="h-7" /></div>
          <div className="hidden lg:flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Live · SAP synced
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={pullSap} className="h-9">
            <RefreshCcw className="h-3.5 w-3.5 mr-2" /> <span className="hidden sm:inline">Sync SAP</span>
          </Button>
          <Link to="/notifications" className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-accent" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center tabular-nums">{unread}</span>}
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8"><div className="max-w-[1600px] w-full mx-auto"><Outlet /></div></main>
      </div>
    </div>
  );
}
