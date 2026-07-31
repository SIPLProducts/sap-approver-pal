## Goal

In User & Role Management → Users tab, replace the inline Plants badges and the Role pill with two compact buttons per row: `Plants (n)` and `Roles (n)`. Clicking either opens a popup with the details, styled like the reference screenshots.

## What changes

Single file: `src/routes/_authenticated/admin.users.tsx` (Users tab table + two new dialogs). No data-layer changes — `listUsersViaSap` already returns `plants: string[]`, `roles: string[]` and `role_assignments: { werks, role }[]` per user.

### 1. Table cells

- **Plants column** → outline button with an eye icon and label `Plants (n)`, where n = `u.plants.length`. When n = 0 the button is disabled and reads `Plants (0)`.
- **Role column** → renamed header to `Roles`; outline button `Roles (n)`, where n = `u.role_assignments.length` (falling back to `u.roles.length` when SAP returns no plant-role pairs).
- Matching the reference: the button for the currently-open/most-populated state uses the filled emerald style, others stay outline with hover highlight; rounded-md, small size, eye icon on the left.

### 2. Plants popup

Dialog titled **Assigned Plants**, subtitle `{full name} ({employee id})`. Body lists each assigned plant code as a full-width bordered row with a check icon on the right, in the order returned (sorted). Footer has a single Close button. Empty state: "No plants assigned".

### 3. Roles popup

Dialog titled **Assigned Roles**, same subtitle. Body is a scrollable list of cards, one per plant (from `role_assignments`, grouped by `werks`, sorted): card header `Plant {code}`, then one row per role in that plant — role name on the left, badge `{plant}–{role}` on the right. Plants with no roles are skipped. If `role_assignments` is empty but `roles` exist, fall back to a single flat list of role badges. Footer Close button.

### 4. Unchanged

Search, plant filter, KPI tiles, Edit/Delete actions, Create/Edit dialogs, and all server functions stay exactly as they are.

## Technical notes

Both dialogs are local components in the same file driven by one piece of state (`detail: { user, kind: "plants" | "roles" } | null`) so only one dialog instance exists. Uses existing shadcn `Dialog`, `Badge`, `Button`, and `ScrollArea` primitives plus lucide `Eye`/`Check` icons — no new dependencies.
