# Redesign Add Role Dialog

Replace the Activities (Screen Permissions) editor in the Add Role popup with a clean chip-grid screen picker that matches the attached mockup, and rewire the SAP payload + local persistence accordingly.

## 1. `src/routes/_authenticated/admin.users.tsx` — dialog UI

- Replace `activities` in `roleForm` state with `screen_keys: string[]` (default `[]`).
- Flatten `SCREEN_GROUPS` from `src/lib/admin/screen-keys.ts` into one list of `{ key, label, module }`.
- New dialog body order:
  1. **Role Name** (required, existing input, red asterisk).
  2. **Role Description** (textarea, 3 rows, placeholder "Enter role description").
  3. **Screen Permissions** section header with right-aligned counter `"{selected} of {total} assigned"`, helper text "Select which screens this role can access", and **Select All** / **Deselect All** outline buttons.
  4. Two-column responsive grid (`grid-cols-1 sm:grid-cols-2 gap-2`) of selectable chips. Each chip = bordered row with screen label + `X` icon button on the right. Selected = solid border + foreground text; unselected = muted/dashed border, click to toggle on. Clicking `X` removes selection.
- Footer: existing Cancel + Create buttons relabel Create as **Save** with a save icon to match the mockup.
- Validation: name required; at least one screen selected → toast.
- Pass `screen_keys` through to the server fn; reset to `[]` on success.
- Keep tenant Select where it currently is (above Screen Permissions) — unchanged.

## 2. `src/lib/admin/user-mgmt.functions.ts` — `createCustomRoleViaSap`

- Replace `activities` validator with `screen_keys: z.array(z.string().min(1).max(80)).min(1).max(50)`.
- Build SAP payload as one ACTIVITY entry per screen:
  ```
  ACTIVITY: screen_keys.map(k => ({ ACTIVITY: k.toUpperCase(), RELEASE_CODE: k }))
  ```
- Success check unchanged (accepts SUCCESS / TRUE / empty).
- On success:
  1. Insert into `custom_roles { name, description, tenant_id }` and capture `id`.
  2. If insert succeeds, insert into `role_permissions` one row per screen:
     `{ role_id, screen_key, action: "view", allowed: true }` (using existing columns). Collect db_error if either step fails.
- Audit log payload extended with `screen_keys`.

## 3. Out of scope

- No schema changes (`role_permissions` already has role_id/screen_key/action/allowed).
- No edits to `screen-keys.ts`, no module-grouping headers in the chip grid (flat list per user's request to use existing SCREEN_GROUPS as the source).
- Role Permissions tab continues to work as today; new rows just pre-seed the `view` action.

## Technical notes

- Chip component built inline with Tailwind + lucide `X` icon — no new shadcn primitive needed.
- "Select All" sets `screen_keys` to all keys; "Deselect All" sets `[]`.
- Counter total = flattened screen count from SCREEN_GROUPS.
