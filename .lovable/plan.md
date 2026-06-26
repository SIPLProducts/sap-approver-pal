# Redesign Create User Dialog

Match the attached mockup: clean, compact, single-column form. Replace the Plants/Roles tables with multi-select dropdowns. Drop the invite/password mode toggle. Keep First Name + Last Name (two fields) instead of single Full Name.

## Field order (top to bottom)

1. **Plant** * — multi-select dropdown (`PlantMultiSelect`), placeholder "— Select Plants —", helper text "Please select at least one plant"
2. **User ID** * — text, placeholder "Enter User ID (e.g., USR001)" → `profiles.sap_user_id`
3. **First Name** * — text
4. **Last Name** * — text
5. **Email ID** * — email
6. **Contact Number** * — tel, placeholder "Enter 10-digit number"
7. **Role** * — multi-select dropdown of `AppRole` values, placeholder "— Select Roles —"
8. **Password** * — password with eye toggle, placeholder "Enter password"
9. **Confirm Password** * — password, placeholder "Re-enter password"
10. **Status** * — Select with "Active" / "Inactive" (default Active)

Footer: right-aligned `Cancel` (outline) + `Save` (primary, with save icon).

## Visual style

- Dialog width `max-w-md`, single column, generous vertical rhythm (`space-y-4`).
- Labels: small medium-weight, red asterisk for required (`<span className="text-destructive">*</span>`).
- Inputs: existing shadcn `Input`/`Select` with default border; full width.
- Header: "Add New User" title, close `X` (already provided by `DialogContent`).
- Use existing design tokens only — no hardcoded colors.

## Behavior

- Validation (zod):
  - plants: at least 1
  - roles: at least 1
  - sap_user_id, first_name, last_name: required, trimmed, ≤100
  - email: valid email
  - contact_number: required, 10 digits
  - password: ≥8 chars
  - confirm_password: must equal password
  - status: "Active" | "Inactive"
- On submit → call existing `createUser` server fn in `mode: "password"` with `plants` + `roles` arrays. Toast on success, invalidate users query, close dialog.

## Files to change

- `src/routes/_authenticated/admin.users.tsx`
  - Rewrite `CreateUserDialog`:
    - Remove plants table state and rows UI
    - Remove roles table state and rows UI
    - Remove mode toggle (always password)
    - Replace with multi-select fields using existing `PlantMultiSelect` for plants and a new lightweight multi-select for roles (checkbox list inside `Popover` with `Command`, reusing shadcn primitives already in repo)
    - Reorder fields to match mockup
    - Update footer buttons (Cancel + Save w/ icon)

## Out of scope

- No backend or migration changes (existing `createUser` already accepts `plants: string[]`, `roles: AppRole[]`, and `mode`).
- No edit-user flow changes.

## Technical notes

- Roles multi-select: render `Popover` + `Command` + checkbox items using `ROLE_LABELS`; trigger shows comma-separated selected labels or placeholder.
- First-listed plant remains `is_default = true` (already handled by backend); selection order from `PlantMultiSelect` is preserved.
- Always pass `mode: "password"` to `createUser`; ignore old invite path in this dialog (server fn still supports it for future use).
