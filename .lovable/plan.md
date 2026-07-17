
## Goal

On Execute, call the SAP API config named `Material_Fetch_API` with payload `{ DOCUMENT_NUMBER, HOD_APPROVE, USER_ID }`, then render the response HEADER as read-only fields and DATA as an editable table (checkboxes + remarks) similar to the Contract Approvals screen. No submit/business-logic changes.

## Changes

### 1. `src/lib/mm/material-reservation.functions.ts`

- Change `CONFIG_NAME` from `Material_Reservation_Fetch_API` to `Material_Fetch_API`.
- Rename input key `doc_number` → `document_number` internally and send payload keys exactly as: `DOCUMENT_NUMBER`, `HOD_APPROVE` (`"X"` or `""`), `USER_ID`.
- Update proxy path segment to `/material_fetch/Fetch` (align with new config name; matches existing proxy pattern used by other modules).
- Return shape: instead of flat `rows`, return `{ header: Record<string, any> | null, data: Record<string, any>[], fetched_at, error }`. Parse from SAP JSON's `HEADER` (first element) and `DATA` (array).
- Keep existing `sap_api_sync_log` logging, proxy/direct handling, and 404 → `/sap/invoke` fallback logic unchanged.

### 2. `src/routes/_authenticated/mm.material-reservation.tsx`

Selection screen (unchanged fields): Document Number input, HOD Approve checkbox, auto-filled User ID, Execute/Reset.

After a successful fetch, replace the current single dynamic-columns table with two stacked sections:

**HEADER card** (read-only inputs, grid layout):
- Document Number (`DOCUMENT_NUMBER`)
- Document Date (`DOCUMENT_DATE`)
- Movement Type (`MOVEMENT_TYPE`)
- Plant (`PLANT`)
- Material Type (`MATERIAL_TYPE`)

All rendered as `<Input readOnly>` with muted background, same style as existing read-only User ID field.

**DATA table** using `CloudscapeApprovalTable` with explicit `columns` (not `buildDynamicColumns`) in this order:
- SNO, GOODS_RECEPIENT, MATERIAL, MATERIAL_DESCRIPTION, UOM, ORDER_NUMBER, COST_CENTER, REQUESTED_QUANTITY, APPROVED_QUANTITY, ISSUED_QUANTITY, STORAGE_LOCATION, TOTAL_STOCK, COST_CENT_DESC — plain text cells.
- HOD_APPROVAL — `<Checkbox>` bound to local per-row state (checked when value is `"X"`).
- HOD_REJECTION — `<Checkbox>` bound to local per-row state.
- REMARKS — `<Input>` bound to local per-row state.

State kept in the component (`Map<rowKey, { hodApproval: boolean; hodRejection: boolean; remarks: string }>`), seeded from the API response. Editing updates local state only — no submit action, no server call. `showSelect` off (no bulk accept/reject buttons; the user asked only to display).

Keep the "Back to Search" header-extras button and the `hasResults` conditional so the selection card hides after fetch.

`rowKey`: `[DOCUMENT_NUMBER, SNO, MATERIAL, index].join("|")`.

### Technical notes

- Config name comparison is case-sensitive against `sap_api_configs.name`; admin must have a row named exactly `Material_Fetch_API`. If missing, the existing "config not found" error message will show and instruct the user to configure it.
- No changes to `_authenticated.tsx` nav, `routeTree.gen.ts`, middleware, or DB schema.
- No new dependencies.
