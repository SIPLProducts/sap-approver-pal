## Problem

In the Custom Roles tab, clicking **Edit Role** populates `roleForm` with that role's data and opens the dialog. Afterward, clicking **Add Role** reopens the same dialog without clearing `roleForm`, so it still shows "Edit Role" with the previous role's fields prefilled.

## Fix (UI only — `src/routes/_authenticated/admin.users.tsx`, ~line 154-159)

1. Replace the `<DialogTrigger asChild>` Add Role button with a plain `<Button>` whose `onClick` first resets `roleForm` to empty defaults (`{ id: "", name: "", description: "", tenant_id: "", screen_keys: [], is_active: true }`) and then calls `setRoleCreateOpen(true)`. This guarantees Add Role always opens in create mode.
2. Update the `<Dialog onOpenChange>` so that when the dialog closes (`v === false`), `roleForm` is also reset to the same empty defaults. This prevents leftover edit state from leaking into the next open (e.g. closing via X / overlay then clicking Add Role).

No backend, validator, or schema changes. Edit Role flow continues to work since `onEditRole` sets `roleForm` before opening.