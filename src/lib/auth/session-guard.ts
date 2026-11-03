import { supabase } from "@/integrations/supabase/client";

export const SESSION_MARKER_KEY = "app.sessionActive";
export const LAST_ACTIVITY_KEY = "app.lastActivity";
export const IDLE_MS = 30 * 60 * 1000;

export function isIdleExpired(lastActivity: number | null, now: number): boolean {
  if (!lastActivity || !Number.isFinite(lastActivity)) return true;
  return now - lastActivity >= IDLE_MS;
}

export function readLastActivity(): number | null {
  try {
    const v = localStorage.getItem(LAST_ACTIVITY_KEY);
    return v ? Number(v) : null;
  } catch { return null; }
}

export function touchActivity() {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch {}
}

export function markSessionActive() {
  try { sessionStorage.setItem(SESSION_MARKER_KEY, "1"); } catch {}
  touchActivity();
}

/** True when this tab has the marker, or a new tab opened while another tab was recently active (copies the marker). */
export function hasSessionMarker(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_MARKER_KEY) === "1") return true;
    if (!isIdleExpired(readLastActivity(), Date.now())) {
      sessionStorage.setItem(SESSION_MARKER_KEY, "1");
      return true;
    }
  } catch {}
  return false;
}

export function clearSessionMarker() {
  try { sessionStorage.removeItem(SESSION_MARKER_KEY); } catch {}
}

/** Same steps as the existing Sign out. */
export async function forceSignOut() {
  try {
    const { setSapProfile } = await import("@/hooks/use-sap-profile");
    setSapProfile(null);
  } catch {}
  try { localStorage.removeItem("app.activePlants"); localStorage.removeItem("app.activePlant"); localStorage.removeItem("app.activeRole"); } catch {}
  try { await supabase.auth.signOut(); } catch {}
  clearSessionMarker();
}
