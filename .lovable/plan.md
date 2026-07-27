
## Goal

When the user selects rows in the PO Release results table and clicks **Release**, call the `PO_Release_API` (already configured in SAP API Settings) with the new payload shape and display the exact SAP response in the application.

## Current state (verified)

- `src/lib/mm/po-release.functions.ts` already has `releasePoItems` calling `PO_Release_API` via middleware proxy.
- Today it sends `{ RELEASE: { EBELN, EBELP, REL_CODE, REL_GRP, REMARKS } }` per selected row and toasts a short message. Raw SAP response is not shown to the user.
- The Release button lives in `src/routes/_authenticated/mm.po-release.tsx` and consumes `results[]` from the mutation.

## Required payload / response

- Request: `{ "RELEASE": { "EBELN": "<po>", "FRGCO": "<release code>", "REMARKS": "<text>" } }` — one call per **PO number** (no `EBELP`, no `REL_GRP`, no `REL_CODE`).
- Response: `[ { "MSGTXT": "...", "STATUS": "TRUE", "RELSTATUS": "X", "INDICATOR": "B" } ]`.

## Changes

### 1. `src/lib/mm/po-release.functions.ts` — release payload + return raw response

- In `processPoAction`, when `payloadKey === "RELEASE"`, build inputs as `{ RELEASE: { EBELN, FRGCO: data.relcode, REMARKS } }` (drop `EBELP` / `REL_CODE` / `REL_GRP`). Keep the existing `REJECT` shape untouched.
- Dedupe selected rows by `EBELN` before iterating so one release call is made per PO even when multiple line items are selected. The result for that PO is reported back for every selected `EBELP` (so the UI clears all its rows on success).
- Extend `PoReleaseResult` with a `response` field carrying the parsed SAP JSON (the array or object returned) plus `MSGTXT`, `STATUS`, `RELSTATUS`, `INDICATOR` extracted for convenience. Return it from `releasePoItems`. Reject flow stays as-is (adds `response` too for symmetry but no behavior change).
- Success detection continues to accept `STATUS === "TRUE"` (already in the success set).

### 2. `src/routes/_authenticated/mm.po-release.tsx` — show exact response

- After the release mutation resolves, open a modal dialog listing each PO with its exact SAP response:
  - Columns: PO Number, MSGTXT, STATUS, RELSTATUS, INDICATOR.
  - Below the table, a collapsible “Raw response” block per PO showing the JSON returned by SAP (pretty-printed, monospace, scrollable).
- Keep the existing toast + row-removal behavior for successful releases so the results table stays in sync.
- Reject flow: unchanged UI (still toast-only).

## Out of scope

- No changes to `PO_Get`/`PO_Reject` payloads.
- No middleware changes; existing `/sap/invoke` proxy path is reused.
- No schema/RLS changes.
