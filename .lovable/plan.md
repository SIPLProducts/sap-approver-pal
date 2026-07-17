## Fix Gate Pass screen to call Gate_Pass_Fetch_API and match Contract Approvals UX

### Backend — `src/lib/mm/gate-pass.functions.ts`

- Change `CONFIG_NAME` from `"Gate_Pass_Approval_API"` to `"Gate_Pass_Fetch_API"`.
- Payload keys must match SAP exactly (spec uses `GATEPASS_NUMBER`, not `GATE_PASS_NUMBER`):
  ```
  {
    GATEPASS_NUMBER, HOD_APPROVAL ("X"/""), STORE_APPROVAL ("X"/""),
    SCM_HEAD, PLANT_HEAD, RETURN_RECEIPT, USER_ID
  }
  ```
- In the proxy branch, stop hitting `/gate_pass_approval/Fetch`. Call `${middlewareUrl}/sap/invoke` directly with `body: { configId: cfg.id, inputs }` (same fix pattern we applied to ZNFA — routes by DB config row so it works regardless of middleware path naming). Drop the 404-`Cannot POST` fallback.
- Keep everything else identical: input schema (rename `gate_pass_number` payload key only), non-proxy basic-auth branch, HEADER/DATA parsing, sync-log writes, return shape.

### Frontend — `src/routes/_authenticated/mm.gate-pass.tsx`

Match Contract Approvals table pattern while keeping current selection-screen layout:

- Header card: unchanged (read-only inputs from `HEADER[0]`).
- Item table: switch from generic auto-columns to explicit columns rendering:
  - Row select checkbox (already wired via `showSelect`) — kept.
  - `MATERIAL`, `DESCRIPTION`, `MEINS`, `QUANTITY`, `VALUE`, `EXPECTED_DATE_OF_RETURN`, `USER_REMARKS`, `ISSUED_QUANTITY`, `JUSTIFICATION`, `SCM_HEAD`, `PH_APPROVAL`, `PH_REJECTION`, `RETURN_STATUS`, `RETURNED_QUANTITY` as read-only text.
  - `HOD_APPROVAL` → editable `Checkbox` (checked when value is `"X"`).
  - `HOD_REJECTION` → editable `Checkbox` (checked when value is `"X"`).
  - `REMARKS` → editable `Input` bound to that row.
  - `STORE_APPROVAL` → editable `Checkbox` (present in response, mirrors selection-screen field).
- Local row state: keep edits in `rows` state via `setRows`, key by `rowKey(row, i)`; edits do not trigger any API call.
- Save button (top-right, already present) stays as a UI-only action (toast with count) — no backend save endpoint is being added per "do not change business logic".

### What is NOT changing

- Selection screen fields and layout, User ID auto-fill, response parsing shape, sync-log semantics, basic-auth branch, routing, and any other screen.

### Prereq

Admin must have a `Gate_Pass_Fetch_API` row configured in SAP API Settings (same requirement pattern as ZNFA).