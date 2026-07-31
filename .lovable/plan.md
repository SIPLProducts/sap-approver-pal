## Goal

In User & Role Management → Custom Roles tab, add a new column after **Status** named **Screen Permissions**, showing a button like `Screens (15)`. Clicking it opens a popup listing all screens assigned to that role, styled like the reference.

## What changes

Single file: `src/routes/_authenticated/admin.users.tsx` (the `CustomRolesTab` component). No schema or server changes.

### 1. Data

Add one query in `CustomRolesTab` that reads `role_permissions` (`custom_role_id, screen_key`) for all roles in one call, and builds a map `roleId → Set<screen_key>` (deduped, since a role can have several actions per screen). Counts and popup contents both come from this map. Existing `custom_roles` query and `handleEdit` stay untouched.

### 2. Table column

- New `<TableHead>Screen Permissions</TableHead>` between Status and Actions; empty-state `colSpan` bumped from 4 to 5.
- Cell renders an outline button with a shield icon reading `Screens (n)`, rounded, small, hover highlight — matching the reference chip. Disabled and muted when `n = 0`.

### 3. Popup

Dialog opened by a local `permRole` state (the clicked role):
- Header: shield icon + `Screen Permissions – {role name}`, subtitle "Assign or unassign screen access for this role." (read-only view here — no toggling, per "keep existing functionality unchanged"; editing still happens through the existing Edit dialog).
- Body: scrollable, responsive grid (1 column on mobile, 2 on `sm`+) of bordered rounded rows. Each row shows the screen's friendly label from `SCREEN_GROUPS` (falls back to the raw key if unmapped) with a filled check-circle icon on the right.
- Empty state: "No screens assigned to this role".
- Close button in the footer plus the standard X.

### 4. Unchanged

Add Role / Edit Role dialogs, active toggle, delete, Users tab, Role Permissions tab, and all queries/mutations stay exactly as they are.

## Technical notes

Uses existing shadcn `Dialog`, `Button`, `Badge` primitives and lucide `Shield` / `CheckCircle2` icons — no new dependencies. Label lookup reuses the existing `SCREEN_GROUPS` import already present in the file.
