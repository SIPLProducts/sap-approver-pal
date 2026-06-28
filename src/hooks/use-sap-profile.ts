import { useEffect, useState } from "react";

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

function read(): SapProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAP_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SapProfile;
    if (!parsed || !Array.isArray(parsed.plants)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useSapProfile(): SapProfile | null {
  const [profile, setProfile] = useState<SapProfile | null>(null);

  useEffect(() => {
    setProfile(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SAP_PROFILE_KEY || e.key === null) setProfile(read());
    };
    const onCustom = () => setProfile(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("sap-profile-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sap-profile-changed", onCustom);
    };
  }, []);

  return profile;
}

export function setSapProfile(profile: SapProfile | null) {
  if (typeof window === "undefined") return;
  if (profile) localStorage.setItem(SAP_PROFILE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(SAP_PROFILE_KEY);
  window.dispatchEvent(new Event("sap-profile-changed"));
}
