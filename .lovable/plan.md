## Add Email Configuration to Screen Permissions

Register the new page as a permission-controlled screen so it shows up in the Roles tab's Screen Permissions chip list (alongside MM Approvals Inbox, Users & Roles, etc.).

### Changes

1. **`src/lib/admin/screen-keys.ts`** — add a new module group to `SCREEN_GROUPS`:
   - Module **"Settings"** with one screen:
     - `{ key: "settings.email_config", label: "Email Configuration", activity: "SETTINGS.EMAIL_CONFIG" }`

2. **`src/routes/_authenticated.tsx`** — gate the sidebar entry by the new screen key:
   - Change the Email Configuration item from `screen: null` → `screen: "settings.email_config"`.

### Result

- Roles dialog auto-lists "Email Configuration" as a selectable chip (it reads from `SCREEN_GROUPS`), and the "N of N assigned" counter grows by one.
- Built-in Admin continues to see the item unconditionally; other roles see it only when granted.
- No DB migration and no visual/style changes.
