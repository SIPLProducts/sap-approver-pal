import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSapProfile, type SapProfilePlant } from "@/hooks/use-sap-profile";

export type ActiveRole = { kind: "sap"; value: string; label: string };

export type AssignedPlant = { code: string; name?: string };
export type AssignedRole = { kind: "sap"; value: string; label: string; activities: string[] };

type ActiveCtx = {
  loading: boolean;
  plants: AssignedPlant[];
  roles: AssignedRole[]; // roles available under the currently active plant
  activePlant: string | null;
  activeRole: ActiveRole | null;
  activeActivities: string[]; // UPPERCASE activities for active plant+role
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
    if (parsed?.kind === "sap" && typeof parsed.value === "string") {
      return { kind: "sap", value: parsed.value, label: parsed.label ?? parsed.value };
    }
    return null;
  } catch {
    return null;
  }
}

function plantFromProfile(p: SapProfilePlant): AssignedPlant {
  return { code: p.code, name: p.name };
}

export function ActiveContextProvider({ children }: { children: ReactNode }) {
  const profile = useSapProfile();

  const plants: AssignedPlant[] = useMemo(
    () => (profile?.plants ?? []).map(plantFromProfile).sort((a, b) => a.code.localeCompare(b.code)),
    [profile],
  );

  const [activePlant, setActivePlantState] = useState<string | null>(null);
  const [activeRole, setActiveRoleState] = useState<ActiveRole | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActivePlantState(localStorage.getItem(PLANT_KEY));
    setActiveRoleState(readStoredRole());
    setHydrated(true);
  }, []);

  // Default / repair active plant
  useEffect(() => {
    if (!hydrated) return;
    if (plants.length === 0) {
      if (activePlant !== null) setActivePlantState(null);
      return;
    }
    if (!activePlant || !plants.some((p) => p.code === activePlant)) {
      setActivePlantState(plants[0].code);
    }
  }, [hydrated, plants, activePlant]);

  // Roles available under the active plant
  const roles: AssignedRole[] = useMemo(() => {
    if (!profile || !activePlant) return [];
    const plant = profile.plants.find((p) => p.code === activePlant);
    return (plant?.roles ?? []).map((r) => ({
      kind: "sap" as const,
      value: r.role,
      label: r.label ?? r.role,
      activities: r.activities,
    }));
  }, [profile, activePlant]);

  // Default / repair active role
  useEffect(() => {
    if (!hydrated) return;
    if (roles.length === 0) {
      if (activeRole) setActiveRoleState(null);
      return;
    }
    const exists = activeRole ? roles.some((r) => r.value === activeRole.value) : false;
    if (!exists) {
      const r0 = roles[0];
      setActiveRoleState({ kind: "sap", value: r0.value, label: r0.label });
    }
  }, [hydrated, roles, activeRole]);

  const activeActivities = useMemo(() => {
    if (!activeRole) return [];
    return roles.find((r) => r.value === activeRole.value)?.activities ?? [];
  }, [roles, activeRole]);

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
    loading: !hydrated,
    plants,
    roles,
    activePlant,
    activeRole,
    activeActivities,
    setActivePlant,
    setActiveRole,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveContext(): ActiveCtx {
  const v = useContext(Ctx);
  if (!v) {
    return {
      loading: false,
      plants: [],
      roles: [],
      activePlant: null,
      activeRole: null,
      activeActivities: [],
      setActivePlant: () => {},
      setActiveRole: () => {},
    };
  }
  return v;
}
