# Use SAP Plant F4 in the Users table filter

## Goal

Replace the current "All Plants" `Select` filter at the top of the Users table (`UsersTab` in `src/routes/_authenticated/admin.users.tsx`, lines ~337–345) with the SAP `Get_Plant` F4 picker — same source already used in the Price Approval screen and the Create User dialog.

## Changes

### `src/routes/_authenticated/admin.users.tsx` — `UsersTab`

- Remove the existing `<Select>` populated from the `tenants` prop.
- Replace with a single-plant SAP F4 picker (reusing `PlantSelect` from `@/components/sap/plant-select`) plus a small "Clear" affordance so users can return to "All Plants".
- Filter logic stays the same: when a plant code is selected, only show profiles whose `user_tenants.tenants.code` includes that code; when empty, show all.
- The `tenants` prop is no longer needed by `UsersTab`. Drop it from the call site (`<UsersTab />`) and remove the prop from the component signature.

No other tabs change. No schema/server-fn changes. The Plants column in the table continues to render from `user_tenants` as today.

## Out of scope

- The "Tenant scope" dropdown on the Custom Roles tab keeps using the `tenants` table (it's tenant-id-based, not a plant code filter).
- No multi-plant filter — single-plant filter matches the prior UX.
