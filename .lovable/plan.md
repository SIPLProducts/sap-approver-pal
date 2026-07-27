## Goal
Switch the PO Release screen's Execute action to call `PO_GET_API` with the new payload shape, and render the new response columns with row-select + editable Remarks.

## Changes

### 1. New server function — `src/lib/mm/po-release.functions.ts`
Add `fetchPoGet` (alongside existing `fetchPoReleaseMultiple`):
- Config name: `PO_GET_API`
- Input: `{ plants: string[], relgroup: string, relcode: string }`
- For each plant, POST payload `{ GET: { WERKS, FRGGR: relgroup, FRGCO: relcode } }` through the same proxy/direct path used by the other MM functions (mirror `processPoAction` transport, but no per-item loop over items — one call per plant).
- Merge all plants' response arrays into a single `rows: Record<string, any>[]`.
- Return `{ data, fetched_at, error }` (same shape as `fetchPoReleaseMultiple`).
- Log to `sap_api_sync_log` per plant.

Keep `releasePoItems` / `rejectPoItems` unchanged. Since the new response has no `EBELP`, they will send `EBELP: ""` (already handled by the current zod default).

### 2. UI — `src/routes/_authenticated/mm.po-release.tsx`
- Replace `fetchPoReleaseMultiple` import/use with `fetchPoGet`.
- Extend `COLUMN_LABELS`:
  - `EBELN` → `Purchase Order Number`
  - `BATXT` → `Document Type`
  - `PLANT_NAME` → `Plant`
  - `VENDOR_NAME` → `Vendor Name`
  - `RLWRT` → `Net Value`
  - `WAERS` → `Currency`
  - (keep existing `REMARKS`)
- Row key: since there is no `EBELP`, use `${EBELN}-${idx}`.
- Right-align `RLWRT` cell (numeric); other columns unchanged.
- Everything else (selection checkboxes, editable Remarks input, search, Release/Reject buttons, header, reset) stays as-is.

## Out of scope
- No changes to Release/Reject server functions or their API configs.
- No navigation, permission, or styling changes beyond the numeric right-align on Net Value.