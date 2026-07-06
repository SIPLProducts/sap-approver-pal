import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSapProfile, type SapProfile, type SapProfilePlant } from "@/hooks/use-sap-profile";
import { useIsBuiltInAdmin } from "@/hooks/use-is-builtin-admin";
import { ALL_SCREENS } from "@/lib/admin/screen-keys";

export type ActiveRole = { kind: "sap"; value: string; label: string };

export type AssignedPlant = { code: string; name?: string };
export type AssignedRole = { kind: "sap"; value: string; label: string; activities: string[] };

type ActiveCtx = {
  loading: boolean;
  plants: AssignedPlant[];
  roles: AssignedRole[];
  activePlants: string[];
  activePlant: string | null; // derived: first of activePlants (for role resolution / legacy callers)
  activeRole: ActiveRole | null;
  activeActivities: string[];
  setActivePlants: (codes: string[]) => void;
  setActivePlant: (code: string | null) => void; // legacy: sets a single-element list
  setActiveRole: (role: ActiveRole | null) => void;
};

const Ctx = createContext<ActiveCtx | null>(null);

const PLANTS_KEY = "app.activePlants";
const LEGACY_PLANT_KEY = "app.activePlant";
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

function readStoredPlants(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLANTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
    }
    // migrate legacy single-plant key
    const legacy = localStorage.getItem(LEGACY_PLANT_KEY);
    if (legacy) return [legacy];
  } catch {}
  return [];
}

function writeStoredPlants(codes: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PLANTS_KEY, JSON.stringify(codes));
    localStorage.removeItem(LEGACY_PLANT_KEY);
  } catch {}
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

function buildBuiltInAdminProfile(): SapProfile {
  return {
    user: "builtin-admin",
    plants: [
      {
        code: "ALL",
        name: "All Plants",
        roles: [
          {
            role: "ADMIN",
            label: "Administrator",
            activities: ALL_SCREENS.map((s) => s.activity),
          },
        ],
      },
    ],
  };
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) if (!s.has(x)) return false;
  return true;
}

export function ActiveContextProvider({ children }: { children: ReactNode }) {
  const sapProfile = useSapProfile();
  const { isAdmin: builtInAdmin } = useIsBuiltInAdmin();

  const profile: SapProfile | null = useMemo(() => {
    if (sapProfile) return sapProfile;
    if (builtInAdmin) return buildBuiltInAdminProfile();
    return null;
  }, [sapProfile, builtInAdmin]);

  const plants: AssignedPlant[] = useMemo(
    () => (profile?.plants ?? []).map(plantFromProfile).sort((a, b) => a.code.localeCompare(b.code)),
    [profile],
  );

  const [activePlants, setActivePlantsState] = useState<string[]>([]);
  const [activeRole, setActiveRoleState] = useState<ActiveRole | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActivePlantsState(readStoredPlants());
    setActiveRoleState(readStoredRole());
    setHydrated(true);
  }, []);

  // Default / repair active plants against the assigned set
  useEffect(() => {
    if (!hydrated) return;
    const assignedCodes = plants.map((p) => p.code);
    if (assignedCodes.length === 0) {
      if (activePlants.length > 0) {
        setActivePlantsState([]);
        writeStoredPlants([]);
      }
      return;
    }
    const allowed = new Set(assignedCodes);
    const pruned = activePlants.filter((c) => allowed.has(c));
    // If nothing (or nothing valid) is stored, default to ALL assigned plants
    const next = pruned.length === 0 ? assignedCodes : pruned;
    if (!sameSet(next, activePlants)) {
      setActivePlantsState(next);
    }
    writeStoredPlants(next);
  }, [hydrated, plants, activePlants]);

  const activePlant = activePlants[0] ?? null;

  // Roles available under the (primary) active plant
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

  const setActivePlants = (codes: string[]) => {
    setActivePlantsState(codes);
    writeStoredPlants(codes);
  };

  const setActivePlant = (code: string | null) => {
    const next = code ? [code] : [];
    setActivePlantsState(next);
    writeStoredPlants(next);
  };

  const setActiveRole = (role: ActiveRole | null) => {
    setActiveRoleState(role);
    writeStoredRole(role);
  };

  const value: ActiveCtx = {
    loading: !hydrated,
    plants,
    roles,
    activePlants,
    activePlant,
    activeRole,
    activeActivities,
    setActivePlants,
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
      activePlants: [],
      activePlant: null,
      activeRole: null,
      activeActivities: [],
      setActivePlants: () => {},
      setActivePlant: () => {},
      setActiveRole: () => {},
    };
  }
  return v;
}
