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
      { key: "mm.gate_process",         label: "ZTER Rating",          activity: "MM.GATE_PROCESS" },
      { key: "mm.gate_pass",            label: "Gate Pass",            activity: "MM.GATE_PASS" },
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
