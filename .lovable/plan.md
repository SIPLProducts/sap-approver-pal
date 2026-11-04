# Finish the screen header update

Design-only fix. No functions, data, SAP calls, permissions, tables, filters or routes change.

1. Fix the build error: add the missing `import { PageHeader } from "@/components/exec/page-header";` line to `src/components/sd/sd-approval-shell.tsx` (BMW approval screens).
2. Add the one missing description line on Service Certificate & SO Approval Reports: "Read-only view of pending service certificate and sales order approval records for reporting and export." (matches the other report screens).
3. All other screens (Email Config, SAP API Settings, Users & Roles, etc.) already have descriptions — leave them as they are.
4. Check the build log is clean and screenshot one BMW screen to confirm the header looks right.
