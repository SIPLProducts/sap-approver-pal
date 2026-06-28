import { useSyncExternalStore } from "react";

export type SapProfileRole = {
  role: string;
  label?: string;
  activities: string[]; // UPPERCASE activity codes, e.g. "ADMIN.USERS"
};

export type SapProfilePlant = {
  code: string;
  name?: string;
  roles: SapProfileRole[];
};

export type SapProfile = {
  user: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: string;
  contact?: string;
  plants: SapProfilePlant[];
};

export const SAP_PROFILE_KEY = "sap.profile";

let cachedRaw: string | null = null;
let cachedSnapshot: SapProfile | null = null;

function readSnapshot(): SapProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SAP_PROFILE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SapProfile;
    cachedSnapshot = parsed && Array.isArray(parsed.plants) ? parsed : null;
  } catch {
    cachedSnapshot = null;
  }
  return cachedSnapshot;
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAP_PROFILE_KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("sap-profile-changed", cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("sap-profile-changed", cb);
  };
}

export function useSapProfile(): SapProfile | null {
  return useSyncExternalStore(subscribe, readSnapshot, () => null);
}

export function setSapProfile(profile: SapProfile | null) {
  if (typeof window === "undefined") return;
  if (profile) localStorage.setItem(SAP_PROFILE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(SAP_PROFILE_KEY);
  // Invalidate cache so the next snapshot read returns the new value.
  cachedRaw = null;
  cachedSnapshot = null;
  window.dispatchEvent(new Event("sap-profile-changed"));
}
