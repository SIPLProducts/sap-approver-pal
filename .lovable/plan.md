## Issue
Editing a role fails Zod validation: `screen_keys` array > 50.

## Root cause
`CustomRolesTab.handleEdit` (`src/routes/_authenticated/admin.users.tsx` line 548) loads from `role_permissions`, which stores one row per (screen × action). With 15 screens × up to 6 actions, the mapped `screen_keys` can reach ~90 entries with many duplicates, exceeding the validator's `.max(50)` and never matching the screen picker (which expects unique screen keys).

## Fix
`src/routes/_authenticated/admin.users.tsx` — in `handleEdit` (~line 548), dedupe before passing up:

```ts
const screen_keys = Array.from(
  new Set((data ?? []).map((p: any) => p.screen_key).filter(Boolean))
);
onEditRole?.({ ...r, screen_keys });
```

No backend / validator / schema changes. The existing `.max(50)` cap is fine — there are only 15 defined screens, so the deduped list will always fit.

## Out of scope
- Validator limits, role_permissions schema, create-role flow.
