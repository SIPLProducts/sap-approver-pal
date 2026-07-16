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
      
      { key: "approvals.inbox.sd", label: "SD Approvals Inbox", activity: "APPROVALS.INBOX_SD" },
      { key: "approvals.history",  label: "Approval History",   activity: "APPROVALS.HISTORY" },
      { key: "approvals.detail",   label: "Approval Detail",    activity: "APPROVALS.DETAIL" },
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
