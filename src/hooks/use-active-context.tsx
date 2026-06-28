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

function writeStoredPlant(code: string | null) {
  if (typeof window === "undefined") return;
  if (code) localStorage.setItem(PLANT_KEY, code);
  else localStorage.removeItem(PLANT_KEY);
}

function writeStoredRole(role: ActiveRole | null) {
  if (typeof window === "undefined") return;
  if (role) localStorage.setItem(ROLE_KEY, JSON.stringify(role));
  else localStorage.removeItem(ROLE_KEY);
}

function normRole(value: string) {
  return value.trim().toUpperCase();
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
      if (activePlant !== null) {
        setActivePlantState(null);
        writeStoredPlant(null);
      }
      return;
    }
    if (!activePlant || !plants.some((p) => p.code === activePlant)) {
      setActivePlantState(plants[0].code);
      writeStoredPlant(plants[0].code);
    } else {
      writeStoredPlant(activePlant);
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
      if (activeRole) {
        setActiveRoleState(null);
        writeStoredRole(null);
      }
      return;
    }
    const found = activeRole ? roles.find((r) => normRole(r.value) === normRole(activeRole.value)) : undefined;
    if (!found) {
      const r0 = roles[0];
      const next = { kind: "sap" as const, value: r0.value, label: r0.label };
      setActiveRoleState(next);
      writeStoredRole(next);
    } else if (activeRole?.kind !== "sap" || activeRole.label !== found.label) {
      const next = { kind: "sap" as const, value: found.value, label: found.label };
      setActiveRoleState(next);
      writeStoredRole(next);
    } else {
      writeStoredRole(activeRole);
    }
  }, [hydrated, roles, activeRole]);

  const activeActivities = useMemo(() => {
    if (!activeRole) return [];
    return roles.find((r) => normRole(r.value) === normRole(activeRole.value))?.activities ?? [];
  }, [roles, activeRole]);

  const setActivePlant = (code: string | null) => {
    setActivePlantState(code);
    writeStoredPlant(code);
  };

  const setActiveRole = (role: ActiveRole | null) => {
    setActiveRoleState(role);
    writeStoredRole(role);
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
