## Goal

Replace the small "Invite a new user" dialog on `/admin/users` with a polished, professional Create User dialog that captures full profile details, multiple plants (SAP F4), and multiple plant+role pairs in one shot.

## Dialog Layout

A wider modal (`max-w-3xl`) organized in three clearly separated sections, with a sticky footer.

```text
+-------------------------------------------------------+
| Create User                                       [x] |
+-------------------------------------------------------+
| 1  Profile                                            |
|    User ID*        First Name*    Last Name*          |
|    Email*          Contact Number                     |
|                                                       |
|    Creation mode:  ( ) Set password now               |
|                    (•) Send invite email              |
|    Password        Confirm Password   (when "Set...") |
|                                                       |
|    Status:   [ Active  •  Inactive ]   (toggle)       |
|-------------------------------------------------------|
| 2  Plants                              [+ Add Row]    |
|    +--------------------------+ +------+              |
|    | Plant (SAP F4 picker)    | |  X   |              |
|    +--------------------------+ +------+              |
|    | Plant (SAP F4 picker)    | |  X   |              |
|    +--------------------------+ +------+              |
|    First row marked as Default (badge).               |
|-------------------------------------------------------|
| 3  Roles                               [+ Add Row]    |
|    +--------------+ +----------------+ +------+       |
|    | Plant (F4)   | | Role (dropdown)| |  X   |       |
|    +--------------+ +----------------+ +------+       |
|    Plant column is informational; Roles save globally |
|    (current `user_roles` semantics).                  |
+-------------------------------------------------------+
|                          [Cancel]  [Create User]      |
+-------------------------------------------------------+
```

Visual polish (using existing design tokens — no hard-coded colors):
- Numbered section headers with subtle muted subtitle.
- `Card`-style grouping per section inside the dialog with `border` + `bg-muted/20`.
- Plant picker reuses `PlantSelect` (single SAP F4 picker per row) for both the Plants table and the Roles table.
- "Add Row" = ghost button with `+` icon, aligned right of each section header.
- Per-row remove = `Trash2` icon button in `ghost` variant.
- Status uses a segmented control (two `Button`s with `default`/`outline` variants) for clarity over a plain switch.
- Footer is sticky inside the dialog with `Cancel` (outline) and `Create User` (primary).

## Validation (client + server, zod)

- User ID, First Name, Last Name, Email required.
- Email format valid.
- Contact Number: optional, digits/`+`/space/`-`, max 20.
- When mode = "Set password": Password ≥ 8 chars, must equal Confirm Password.
- Plants rows: drop empty rows; de-dupe by code.
- Roles rows: drop rows with empty role; de-dupe; ignore Plant column when persisting.

## Backend mapping

- `profiles.full_name` ← `${firstName} ${lastName}`.
- `profiles.sap_user_id` ← User ID.
- `profiles.email` ← email (also kept by `handle_new_user`).
- New columns added by migration: `profiles.first_name`, `profiles.last_name`, `profiles.contact_number text`, `profiles.status text not null default 'Active' check (status in ('Active','Inactive'))`.
- Plants → `user_tenants` rows (first row `is_default = true`) — same shape as today.
- Roles → `user_roles` rows (one per selected role, global).

## Server function changes (`src/lib/admin/user-mgmt.functions.ts`)

Replace `inviteUser` with a single `createUser` that handles both modes:

```ts
createUser({
  user_id: string,        // SAP user id
  first_name, last_name, email, contact_number?,
  status: "Active" | "Inactive",
  mode: "invite" | "password",
  password?: string,      // required when mode === "password"
  plants: string[],       // plant codes
  roles: AppRole[],       // global roles
})
```

Behavior:
- `mode === "invite"`: `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { full_name }})` (current behavior).
- `mode === "password"`: `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name }})`.
- After auth user exists, `update` profile with `first_name`, `last_name`, `sap_user_id`, `contact_number`, `status`.
- Insert plants into `user_tenants` (existing matching/skip logic kept).
- Insert each role into `user_roles`.
- Audit log entry with mode + counts.
- `status === "Inactive"`: also call `supabaseAdmin.auth.admin.updateUserById(newId, { ban_duration: "876000h" })` so they cannot sign in.

Keep `deleteUser` and `setBuiltInRole` unchanged. Export `inviteUser` as a thin alias to `createUser` (mode="invite") for any other caller — none found, but kept defensively.

## Frontend changes (`src/routes/_authenticated/admin.users.tsx`)

- Replace `inviteForm` state with a richer object including `plants: string[]` and `roles: AppRole[]`.
- New component `CreateUserDialog` extracted in-file (still local to keep diff focused) — receives `open`, `onOpenChange`, and uses `useServerFn(createUser)`.
- Reuse `PlantSelect` for per-row plant pickers; reuse the role list from `ROLE_LABELS`.
- On success: toast, close dialog, invalidate `admin-profiles`, `admin-user-roles`, `admin-user-tenants`.
- "Plants" column in Users table already reads `user_tenants`; "Role" column already reads `user_roles`. No table changes needed.

## Migration

Add the three new profile columns + check constraint via `supabase--migration`. No RLS changes; existing `profiles` policies already cover admin updates.

## Out of scope

- Editing existing users from this dialog (separate Edit flow stays as-is).
- Per-plant role scoping (user chose "use existing tables as-is").
- Changes to Custom Roles, Permissions, or Approval Matrix tabs.
