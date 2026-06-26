## Redesign Custom Roles tab to match the reference layout

Scope: `src/routes/_authenticated/admin.users.tsx` only. Colors and fonts unchanged.

### 1. Page header (when `tab === "custom_roles"`)
Mirror the Users-tab pattern so the action buttons sit at the top-right next to the "User & Role Management" title:
- **Refresh** (outline, `RefreshCw` icon) — invalidates `admin-custom-roles`.
- **Add Role** (primary, `Plus` icon) — opens the create-role dialog (lifted from `CustomRolesTab` to `UserManagementPage`).

### 2. CustomRolesTab body — switch from card grid to a single panel + table
Layout matching the screenshot:

```text
┌─ Card ─────────────────────────────────────────┐
│ All Roles                                      │
│ N role(s) configured                           │
│ ──────────────────────────────────────────────│
│ Role Name | Description | Status      | Actions│
│ Engineering | Eng & Design | [●] Active | ✎  🗑 │
│ ...                                           │
└────────────────────────────────────────────────┘
```

Column details:
- **Role Name** — bold text.
- **Description** — muted text, falls back to "—".
- **Status** — `Switch` bound to `is_active` (updates `custom_roles.is_active` via supabase) followed by an "Active" / "Inactive" badge.
- **Actions** — edit (pencil) opens an edit dialog (name + description + active); delete (trash, destructive) reuses existing `deleteRole` guard.

Remove the **Workflow Routing** column entirely (not rendered, no data fetched for it).

### 3. Dialogs
- **Create role dialog** — moved to `UserManagementPage`, same fields as today (name, description, tenant scope).
- **Edit role dialog** — new, local to `CustomRolesTab`: name, description, active toggle; saves via `supabase.from("custom_roles").update(...)`.

### 4. Out of scope
- No changes to colors, fonts, or design tokens.
- No schema changes, no server-function changes.
- Permissions tab and Users tab untouched.

### Acceptance
- Custom Roles tab shows a single "All Roles" card with a table of roles, no Workflow Routing column.
- Refresh and Add Role buttons render in the page header only on the Custom Roles tab.
- Status toggle flips `is_active` and the badge updates.
- Edit and delete actions work per row; existing "unassign users first" guard preserved.
