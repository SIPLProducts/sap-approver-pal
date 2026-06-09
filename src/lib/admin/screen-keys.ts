export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export const PERMISSION_ACTIONS: PermissionAction[] = [
  "view", "create", "edit", "delete", "approve", "export",
];

export const SCREEN_GROUPS: { module: string; screens: { key: string; label: string }[] }[] = [
  {
    module: "Approvals",
    screens: [
      { key: "approvals.inbox.mm", label: "MM Approvals Inbox" },
      { key: "approvals.inbox.sd", label: "SD Approvals Inbox" },
      { key: "approvals.history", label: "Approval History" },
      { key: "approvals.detail", label: "Approval Detail" },
    ],
  },
  {
    module: "Admin",
    screens: [
      { key: "admin.users", label: "Users & Roles" },
      { key: "admin.custom_roles", label: "Custom Roles" },
      { key: "admin.role_permissions", label: "Role Permissions" },
      { key: "admin.approval_matrix", label: "Approval Matrix" },
      { key: "admin.strategies", label: "Release Strategies" },
    ],
  },
  {
    module: "SAP",
    screens: [
      { key: "sap.api_settings", label: "SAP API Settings" },
      { key: "sap.integrations", label: "SAP Integrations" },
      { key: "sap.sync_log", label: "SAP Sync Log" },
    ],
  },
  {
    module: "Reports",
    screens: [
      { key: "reports.audit", label: "Audit Log" },
      { key: "reports.notifications", label: "Notifications" },
    ],
  },
];
