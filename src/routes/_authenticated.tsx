import { createFileRoute, Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Truck, History, Settings, Users, LogOut, Bell, RefreshCcw, ShieldCheck, Plug, Server, ChevronDown, Tag, FileText, FileCheck2, ShoppingCart, BarChart3, PanelLeft, ChevronsUpDown, Mail } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncFromSAP } from "@/lib/sap/sap.functions";
import { fetchBmwStatusReport } from "@/lib/sd/bmw-status-report.functions";
import { usePermissions } from "@/hooks/use-permissions";
import { ActiveContextProvider, useActiveContext, type AssignedPlant } from "@/hooks/use-active-context";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedRoot });

function AuthenticatedRoot() {
  return (
    <ActiveContextProvider>
      <AuthenticatedLayout />
    </ActiveContextProvider>
  );
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("app.sidebarCollapsed") === "1";
  });
  useEffect(() => {
    try { window.localStorage.setItem("app.sidebarCollapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);
  const perms = usePermissions();
  const ctx = useActiveContext();
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

  const sync = useServerFn(syncFromSAP);
  const bmwFetch = useServerFn(fetchBmwStatusReport);
  const sortedPlants = useMemo(() => [...ctx.activePlants].sort(), [ctx.activePlants]);
  const bmwFrom = sortedPlants[0] ?? "";
  const bmwTo = sortedPlants[sortedPlants.length - 1] ?? "";
  function prefetchSdDashboard() {
    if (!bmwFrom || !bmwTo) return;
    qc.prefetchQuery({
      queryKey: ["sd-dashboard-bmw", bmwFrom, bmwTo],
      staleTime: 5 * 60_000,
      queryFn: async () => {
        const res: any = await bmwFetch({
          data: {
            sales_org_from: bmwFrom,
            sales_org_to: bmwTo,
            customer_from: "",
            customer_to: "",
            contract_from: "",
            contract_to: "",
            mode: "sales" as const,
          },
        });
        return res?.rows ?? [];
      },
    }).catch(() => {});
  }

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
    const { setSapProfile } = await import("@/hooks/use-sap-profile");
    setSapProfile(null);
    try { localStorage.removeItem("app.activePlants"); localStorage.removeItem("app.activePlant"); localStorage.removeItem("app.activeRole"); } catch {}
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  if (loading || !user || perms.loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const can = perms.can;
  const sdChildren = [
    { to: "/sd/dashboard", label: "SD Dashboard", icon: BarChart3, screen: "approvals.inbox.sd" },
    { to: "/sd/price", label: "Price Approvals", icon: Tag, screen: "approvals.inbox.sd" },
    { to: "/sd/contract", label: "Contract Approvals", icon: FileText, screen: "approvals.inbox.sd" },
    { to: "/sd/sc-so", label: "Service Cert & SO", icon: FileCheck2, screen: "approvals.inbox.sd" },
    { to: "/sd/sales-order", label: "Sales Order Approvals", icon: ShoppingCart, screen: "approvals.inbox.sd" },
    { to: "/sd/bmw-status", label: "BMW Status Report", icon: BarChart3, screen: "approvals.inbox.sd" },
  ].filter((it) => can(it.screen));

  const showMm = can("approvals.inbox.mm");
  const showSd = sdChildren.length > 0;

  const manage_items = [
    { to: "/history", label: "History", icon: History, screen: "approvals.history" },
    { to: "/admin/users", label: "Users & Roles", icon: Users, screen: "admin.users" },
    { to: "/admin/strategies", label: "Release Strategies", icon: ShieldCheck, screen: "admin.strategies" },
    { to: "/admin/sap-api", label: "SAP API Settings", icon: Server, screen: "sap.api_settings" },
    { to: "/admin/integrations", label: "Integrations", icon: Plug, screen: "sap.integrations" },
    { to: "/email-config", label: "Email Configuration", icon: Mail, screen: null as string | null },
    { to: "/settings", label: "Settings", icon: Settings, screen: null as string | null },
  ].filter((it) => it.screen === null || can(it.screen));

  // ===== Top-bar role/plant select handlers =====
  const roleSelectValue = ctx.activeRole ? `${ctx.activeRole.kind}:${ctx.activeRole.value}` : "";
  function onRoleChange(v: string) {
    const idx = v.indexOf(":");
    if (idx < 0) return;
    const value = v.slice(idx + 1);
    const found = ctx.roles.find((r) => r.value === value);
    if (!found) return;
    ctx.setActiveRole({ kind: "sap", value: found.value, label: found.label });
    qc.invalidateQueries();
    // Re-run any route loaders that gated on the previous role's permissions
    router.invalidate();
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky lg:top-0 lg:h-screen z-40 inset-y-0 left-0 ${collapsed ? "w-16" : "w-64"} bg-sidebar text-sidebar-foreground flex flex-col transition-all ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`px-4 py-4 flex items-center gap-3 border-b border-sidebar-border ${collapsed ? "justify-center px-2" : ""}`}>
          <div className="rounded-lg bg-white px-2 py-1.5 shadow-card flex items-center">
            <BrandLogo className="h-7" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-semibold leading-tight text-[13px] tracking-tight">Re Sustainability</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Executive Approvals</div>
            </div>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {!collapsed && <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">Workspaces</div>}
          {showMm && (
            <Link to="/inbox/mm" onClick={() => setOpen(false)} title="MM Approvals"
              className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${pathname.startsWith("/inbox/mm") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"} ${collapsed ? "justify-center" : ""}`}>
              {pathname.startsWith("/inbox/mm") && !collapsed && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />}
              <Package className="h-4 w-4 shrink-0" /> {!collapsed && <span className="truncate">MM Approvals</span>}
            </Link>
          )}

          {showSd && (
            <>
              <button
                type="button"
                onMouseEnter={prefetchSdDashboard}
                onFocus={prefetchSdDashboard}
                onClick={() => {
                  if (collapsed) setCollapsed(false);
                  setSdExpanded(true);
                  setOpen(false);
                  nav({ to: "/sd/dashboard" });
                }}
                title="SD Approvals"
                className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${sdOpen ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"} ${collapsed ? "justify-center" : ""}`}
              >
                {sdOpen && !collapsed && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />}
                <Truck className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 text-left truncate">SD Approvals</span>}
                {!collapsed && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setSdExpanded((v) => !v); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSdExpanded((v) => !v); } }}
                    className="p-0.5 -mr-1 rounded hover:bg-sidebar-accent/60"
                    aria-label={sdExpanded ? "Collapse" : "Expand"}
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sdExpanded ? "rotate-0" : "-rotate-90"}`} />
                  </span>
                )}
              </button>
              {sdExpanded && !collapsed && (
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
            </>
          )}

          {manage_items.length > 0 && !collapsed && (
            <div className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">Manage</div>
          )}
          {manage_items.map((it) => {
            const active = pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link key={it.to} to={it.to} onClick={() => setOpen(false)} title={it.label}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"} ${collapsed ? "justify-center" : ""}`}>
                {active && !collapsed && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />}
                <Icon className="h-4 w-4 shrink-0" /> {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className={`flex items-center gap-3 px-2 py-1.5 rounded-md bg-sidebar-accent/40 ${collapsed ? "justify-center" : ""}`}>
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-xs font-semibold">
              {(profile?.full_name || user.email || "?").charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium truncate text-sidebar-foreground">{profile?.full_name || user.email}</div>
                <div className="text-[10px] text-sidebar-foreground/55 truncate">{perms.activeRoleLabel ?? "No active role"}</div>
              </div>
            )}
          </div>
          <Button onClick={logout} variant="ghost" size="sm" title="Sign out" className={`w-full text-sidebar-foreground/75 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent ${collapsed ? "justify-center px-0" : "justify-start"}`}>
            <LogOut className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} /> {!collapsed && "Sign out"}
          </Button>
        </div>
      </aside>

      {open && <div className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="h-[60px] border-b bg-card/80 backdrop-blur-md flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-20">
          <button className="lg:hidden text-muted-foreground p-2 -ml-2 rounded-md hover:bg-accent" onClick={() => setOpen(true)} aria-label="Open menu">
            <span className="text-lg leading-none">☰</span>
          </button>
          <button
            className="hidden lg:inline-flex text-muted-foreground p-2 -ml-2 rounded-md hover:bg-accent"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="lg:hidden flex items-center"><BrandLogo className="h-7" /></div>


          {/* Plant + Role selectors */}
          {ctx.plants.length > 0 && (
            <TopBarPlantSelect
              plants={ctx.plants}
              value={ctx.activePlants}
              onChange={(next) => { ctx.setActivePlants(next); qc.invalidateQueries(); router.invalidate(); }}
            />
          )}
          {ctx.roles.length > 0 && (
            <Select value={roleSelectValue} onValueChange={onRoleChange}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ctx.roles.map((r) => (
                  <SelectItem key={`${r.kind}:${r.value}`} value={`${r.kind}:${r.value}`}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="hidden xl:flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground ml-2">
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

function TopBarPlantSelect({
  plants,
  value,
  onChange,
}: {
  plants: AssignedPlant[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);
  const allCodes = useMemo(() => plants.map((p) => p.code), [plants]);
  const label = useMemo(() => {
    if (value.length === 0) return "Select plants";
    if (value.length === plants.length) return `All plants (${plants.length})`;
    if (value.length === 1) {
      const p = plants.find((x) => x.code === value[0]);
      return p ? `Plant ${p.code}${p.name ? ` — ${p.name}` : ""}` : `Plant ${value[0]}`;
    }
    return `${value.length} plants`;
  }, [value, plants]);

  function toggle(code: string) {
    if (selected.has(code)) onChange(value.filter((v) => v !== code));
    else onChange([...value, code]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-[180px] justify-between gap-2 px-3 text-sm font-normal"
        >
          <span className="truncate text-left">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[1000] w-[260px] p-0" align="start" sideOffset={6}>
        <Command>
          <CommandInput placeholder="Search plant…" className="h-9" />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>No plant found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__select_all__"
                onSelect={() => {
                  if (value.length === allCodes.length) return; // keep at least all; disallow empty via all-selected click
                  onChange(allCodes);
                }}
                className="font-medium border-b rounded-none"
              >
                <Checkbox
                  checked={value.length === allCodes.length}
                  tabIndex={-1}
                  className="pointer-events-none mr-2"
                />
                Select all ({allCodes.length})
              </CommandItem>
              {plants.map((p) => {
                const isSel = selected.has(p.code);
                return (
                  <CommandItem
                    key={p.code}
                    value={`${p.code} ${p.name ?? ""}`}
                    onSelect={() => {
                      // Prevent deselecting the last remaining plant
                      if (isSel && value.length === 1) return;
                      toggle(p.code);
                    }}
                  >
                    <Checkbox
                      checked={isSel}
                      tabIndex={-1}
                      className="pointer-events-none mr-2"
                    />
                    <span className="font-mono">{p.code}</span>
                    {p.name && (
                      <span className="ml-2 text-muted-foreground truncate">— {p.name}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
