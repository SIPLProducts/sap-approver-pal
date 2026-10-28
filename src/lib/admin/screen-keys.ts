export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export const PERMISSION_ACTIONS: PermissionAction[] = [
  "view", "create", "edit", "delete", "approve", "export",
];

export type ScreenDef = { key: string; label: string; activity: string };

/**
 * Single source of truth: app screen key ↔ SAP activity code.
 * Activity codes are exactly what the SAP Login_API ACTIVITIES[] payload
 * uses (UPPER_SNAKE with dot module separator).
 */
export const SCREEN_GROUPS: { module: string; screens: ScreenDef[] }[] = [
  {
    module: "Approvals",
    screens: [
      { key: "approvals.inbox.mm", label: "MM Approvals Inbox", activity: "APPROVALS.INBOX_MM" },
      
      { key: "approvals.inbox.sd", label: "BMW Approvals Inbox", activity: "APPROVALS.INBOX_SD" },
      { key: "approvals.history",  label: "Approval History",   activity: "APPROVALS.HISTORY" },
      { key: "approvals.detail",   label: "Approval Detail",    activity: "APPROVALS.DETAIL" },
    ],
  },
  {
    module: "MM Approvals",
    screens: [
      { key: "mm.dashboard",            label: "MM Dashboard",         activity: "MM.DASHBOARD" },
      { key: "mm.pr_release",           label: "PR Release",           activity: "MM.PR_RELEASE" },
      { key: "mm.po_release",           label: "PO Release",           activity: "MM.PO_RELEASE" },
      { key: "mm.material_reservation", label: "Material Reservation", activity: "MM.MATERIAL_RESERVATION" },
      { key: "mm.zmc_report",           label: "ZMC Report",           activity: "MM.ZMC_REPORT" },
      { key: "mm.gate_process",         label: "ZTER Rating",          activity: "MM.GATE_PROCESS" },
      { key: "mm.gate_pass",            label: "Gate Pass",            activity: "MM.GATE_PASS" },
      { key: "mm.zgp_report",           label: "ZGP Report",           activity: "MM.ZGP_REPORT" },
      { key: "mm.migo_release",         label: "MIGO Release",         activity: "MM.MIGO_RELEASE" },
      { key: "mm.znfa_release",         label: "ZNFA Release",         activity: "MM.ZNFA_RELEASE" },
      { key: "mm.service_entry_sheet",  label: "Service Entry Sheet",  activity: "MM.SERVICE_ENTRY_SHEET" },
    ],
  },
  {
    module: "BMW Approvals",
    screens: [
      { key: "sd.dashboard",   label: "BMW Dashboard",          activity: "SD.DASHBOARD" },
      { key: "sd.price",       label: "Price Approvals",       activity: "SD.PRICE" },
      { key: "sd.contract",    label: "Contract Approvals",    activity: "SD.CONTRACT" },
      { key: "sd.sc_so",       label: "Service Cert & SO",     activity: "SD.SC_SO" },
      { key: "sd.sales_order", label: "Sales Order Approvals", activity: "SD.SALES_ORDER" },
      { key: "sd.bmw_status",  label: "BMW Status Report",     activity: "SD.BMW_STATUS" },
    ],
  },
  {
    module: "IWM Approvals",
    screens: [
      { key: "approvals.inbox.imw", label: "IWM Approvals Inbox", activity: "APPROVALS.INBOX_IMW" },
      { key: "imw.price_master",    label: "Price Master Update", activity: "IMW.PRICE_MASTER" },
      { key: "imw.price_master_approvals", label: "Price Master Update Approvals", activity: "IMW.PRICE_MASTER_APPROVALS" },
      { key: "imw.transport_exception_billing", label: "Transportation (90%) Exception Billing", activity: "IMW.TRANSPORT_EXCEPTION_BILLING" },

    ],
  },
  {
    module: "Admin",

    screens: [
      { key: "admin.users",            label: "Users & Roles",       activity: "ADMIN.USERS" },
      { key: "admin.custom_roles",     label: "Custom Roles",        activity: "ADMIN.CUSTOM_ROLES" },
      { key: "admin.role_permissions", label: "Role Permissions",    activity: "ADMIN.ROLE_PERMISSIONS" },
      { key: "admin.approval_matrix",  label: "Approval Matrix",     activity: "ADMIN.APPROVAL_MATRIX" },
      { key: "admin.strategies",       label: "Release Strategies",  activity: "ADMIN.STRATEGIES" },
    ],
  },
  {
    module: "SAP",
    screens: [
      { key: "sap.api_settings", label: "SAP API Settings", activity: "SAP.API_SETTINGS" },
      { key: "sap.integrations", label: "SAP Integrations", activity: "SAP.INTEGRATIONS" },
      { key: "sap.sync_log",     label: "SAP Sync Log",     activity: "SAP.SYNC_LOG" },
    ],
  },
  {
    module: "Reports",
    screens: [
      { key: "reports.audit",         label: "Audit Log",     activity: "REPORTS.AUDIT" },
      { key: "reports.notifications", label: "Notifications", activity: "REPORTS.NOTIFICATIONS" },
    ],
  },
  {
    module: "Settings",
    screens: [
      { key: "settings.email_config", label: "Email Configuration", activity: "SETTINGS.EMAIL_CONFIG" },
    ],
  },

];

export const ALL_SCREENS: ScreenDef[] = SCREEN_GROUPS.flatMap((g) => g.screens);

const ACTIVITY_TO_KEY = new Map<string, string>(
  ALL_SCREENS.map((s) => [s.activity.toUpperCase(), s.key]),
);
const KEY_TO_ACTIVITY = new Map<string, string>(
  ALL_SCREENS.map((s) => [s.key, s.activity.toUpperCase()]),
);

/** Map a SAP ACTIVITY code (e.g. "ADMIN.USERS") to an app screen key. */
export function activityToScreenKey(activity: string): string | null {
  if (!activity) return null;
  return ACTIVITY_TO_KEY.get(activity.trim().toUpperCase()) ?? null;
}

/** Map an app screen key to its SAP ACTIVITY code for outbound payloads. */
export function screenKeyToActivity(screenKey: string): string {
  return KEY_TO_ACTIVITY.get(screenKey) ?? screenKey.trim().toUpperCase();
}

// ===== Flexible SAP permission resolution =====

/** Normalise an activity code: upper-case, spaces/hyphens → "_", collapse repeats. */
export function normalizeActivity(a: string): string {
  return (a ?? "").trim().toUpperCase().replace(/[\s\-]+/g, "_").replace(/_+/g, "_").replace(/_?\._?/g, ".");
}

const ACTIVITY_ALIASES: Record<string, string> = {
  "BMW.DASHBOARD": "sd.dashboard",
  "BMW.PRICE": "sd.price",
  "BMW.PRICE_APPROVAL": "sd.price",
  "BMW.PRICE_APPROVALS": "sd.price",
  "BMW.CONTRACT": "sd.contract",
  "BMW.CONTRACT_APPROVAL": "sd.contract",
  "BMW.CONTRACT_APPROVALS": "sd.contract",
  "BMW.SC_SO": "sd.sc_so",
  "BMW.SERVICE_CERTIFICATE": "sd.sc_so",
  "BMW.SALES_ORDER": "sd.sales_order",
  "BMW.SALES_ORDER_APPROVAL": "sd.sales_order",
  "BMW.SO_APPROVAL": "sd.sales_order",
  "BMW.STATUS_REPORT": "sd.bmw_status",
  "BMW.BMW_STATUS": "sd.bmw_status",
  "SD.STATUS_REPORT": "sd.bmw_status",
  "SD.PRICE_APPROVAL": "sd.price",
  "SD.CONTRACT_APPROVAL": "sd.contract",
  "SD.SALES_ORDER_APPROVAL": "sd.sales_order",
};

const NORM_TO_KEY = new Map<string, string>(
  ALL_SCREENS.map((s) => [normalizeActivity(s.activity), s.key]),
);

/** Tolerant activity → screen key (case, spaces, -/_ and known aliases). */
export function resolveActivityKey(activity: string): string | null {
  const n = normalizeActivity(activity);
  if (!n) return null;
  return NORM_TO_KEY.get(n) ?? ACTIVITY_ALIASES[n] ?? null;
}

export const SD_SCREEN_KEYS = ["sd.dashboard", "sd.price", "sd.contract", "sd.sc_so", "sd.sales_order", "sd.bmw_status"];
export const MM_SCREEN_KEYS = SCREEN_GROUPS.find((g) => g.module === "MM Approvals")!.screens.map((s) => s.key);
export const IMW_SCREEN_KEYS = ["imw.price_master", "imw.price_master_approvals", "imw.transport_exception_billing"];
const ADMIN_SCREEN_KEYS = [
  ...SCREEN_GROUPS.filter((g) => ["Admin", "SAP", "Settings"].includes(g.module)).flatMap((g) => g.screens.map((s) => s.key)),
  "approvals.history",
];

/** Module inbox key that implicitly grants every screen of that module. */
export function moduleInboxFor(screenKey: string): string | null {
  if (screenKey.startsWith("sd.")) return "approvals.inbox.sd";
  if (screenKey.startsWith("mm.")) return "approvals.inbox.mm";
  if (screenKey.startsWith("imw.")) return "approvals.inbox.imw";
  return null;
}

/** Fallback: infer screens from a SAP role name (used only when activities map to nothing). */
export function roleNameToScreenKeys(roleName: string): string[] {
  const r = ` ${(roleName ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim()} `;
  if (!r.trim()) return [];
  const out = new Set<string>();
  if (/\bADMIN\b/.test(r)) ADMIN_SCREEN_KEYS.forEach((k) => out.add(k));
  if (/\bBMW ALL\b|\bSD ALL\b/.test(r)) SD_SCREEN_KEYS.forEach((k) => out.add(k));
  if (/\bMM ALL\b/.test(r)) MM_SCREEN_KEYS.forEach((k) => out.add(k));
  if (/\b(IWM|IMW) ALL\b/.test(r)) IMW_SCREEN_KEYS.forEach((k) => out.add(k));
  if (/\b(BMW|SD)\b/.test(r)) {
    if (/\bPRICE\b/.test(r)) out.add("sd.price");
    if (/\bCONTRACT\b/.test(r)) out.add("sd.contract");
    if (/\bSERVICE\b|\bSC\b|\bCERT/.test(r)) out.add("sd.sc_so");
    if (/\bSO\b|\bSALES\b/.test(r)) out.add("sd.sales_order");
    if (/\bSTATUS\b/.test(r)) out.add("sd.bmw_status");
    if (/\bDASHBOARD\b/.test(r)) out.add("sd.dashboard");
  }
  return [...out];
}
