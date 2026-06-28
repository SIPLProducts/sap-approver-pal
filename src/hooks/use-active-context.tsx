import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { AppRole } from "@/lib/approvals/constants";

export type ActiveRole = { kind: "built_in"; value: AppRole } | { kind: "custom"; value: string; label: string };

export type AssignedPlant = { code: string; name: string };
export type AssignedRole =
  | { kind: "built_in"; value: AppRole; label: string }
  | { kind: "custom"; value: string; label: string };

type ActiveCtx = {
  loading: boolean;
  plants: AssignedPlant[];
  roles: AssignedRole[];
  activePlant: string | null; // tenant code
  activeRole: ActiveRole | null;
  setActivePlant: (code: string | null) => void;
  setActiveRole: (role: ActiveRole | null) => void;
};

const Ctx = createContext<ActiveCtx | null>(null);

const PLANT_KEY = "app.activePlant";
const ROLE_KEY = "app.activeRole";

function readStoredRole(): ActiveRole | null {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.kind === "built_in" && typeof parsed.value === "string") return parsed;
    if (parsed?.kind === "custom" && typeof parsed.value === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function ActiveContextProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ["my-plants", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<AssignedPlant[]> => {
      const { data } = await supabase
        .from("user_tenants")
        .select("tenant:tenants(code, name)")
        .eq("user_id", user!.id);
      const rows = (data ?? []) as Array<{ tenant: { code: string; name: string } | null }>;
      return rows
        .map((r) => r.tenant)
        .filter((t): t is { code: string; name: string } => !!t)
        .sort((a, b) => a.code.localeCompare(b.code));
    },
  });

  const { data: builtInRoles = [], isLoading: brLoading } = useQuery({
    queryKey: ["my-built-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.role as AppRole);
    },
  });

  const { data: customRoles = [], isLoading: crLoading } = useQuery({
    queryKey: ["my-custom-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_custom_roles")
        .select("custom_role:custom_roles(id, name)")
        .eq("user_id", user!.id);
      const rows = (data ?? []) as Array<{ custom_role: { id: string; name: string } | null }>;
      return rows.map((r) => r.custom_role).filter((c): c is { id: string; name: string } => !!c);
    },
  });

  const roles: AssignedRole[] = useMemo(() => {
    const list: AssignedRole[] = [];
    for (const r of builtInRoles) list.push({ kind: "built_in", value: r, label: r });
    for (const c of customRoles) list.push({ kind: "custom", value: c.id, label: c.name });
    return list;
  }, [builtInRoles, customRoles]);

  const [activePlant, setActivePlantState] = useState<string | null>(null);
  const [activeRole, setActiveRoleState] = useState<ActiveRole | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from storage once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    setActivePlantState(localStorage.getItem(PLANT_KEY));
    setActiveRoleState(readStoredRole());
    setHydrated(true);
  }, []);

  // Backfill defaults from assignments once loaded
  useEffect(() => {
    if (!hydrated) return;
    if (!activePlant && plants.length > 0) {
      setActivePlantState(plants[0].code);
    } else if (activePlant && plants.length > 0 && !plants.some((p) => p.code === activePlant)) {
      setActivePlantState(plants[0].code);
    }
  }, [hydrated, plants, activePlant]);

  useEffect(() => {
    if (!hydrated) return;
    const exists = activeRole
      ? roles.some((r) => r.kind === activeRole.kind && r.value === activeRole.value)
      : false;
    if (!exists && roles.length > 0) {
      const r0 = roles[0];
      setActiveRoleState(
        r0.kind === "built_in"
          ? { kind: "built_in", value: r0.value }
          : { kind: "custom", value: r0.value, label: r0.label },
      );
    } else if (roles.length === 0 && activeRole) {
      setActiveRoleState(null);
    }
  }, [hydrated, roles, activeRole]);

  const setActivePlant = (code: string | null) => {
    setActivePlantState(code);
    if (typeof window !== "undefined") {
      if (code) localStorage.setItem(PLANT_KEY, code);
      else localStorage.removeItem(PLANT_KEY);
    }
  };

  const setActiveRole = (role: ActiveRole | null) => {
    setActiveRoleState(role);
    if (typeof window !== "undefined") {
      if (role) localStorage.setItem(ROLE_KEY, JSON.stringify(role));
      else localStorage.removeItem(ROLE_KEY);
    }
  };

  const value: ActiveCtx = {
    loading: plantsLoading || brLoading || crLoading || !hydrated,
    plants,
    roles,
    activePlant,
    activeRole,
    setActivePlant,
    setActiveRole,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveContext(): ActiveCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Safe defaults so hooks outside the provider don't crash.
    return {
      loading: false,
      plants: [],
      roles: [],
      activePlant: null,
      activeRole: null,
      setActivePlant: () => {},
      setActiveRole: () => {},
    };
  }
  return v;
}
