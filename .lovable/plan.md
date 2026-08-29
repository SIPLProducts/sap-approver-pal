# MM Date Formatting + Gate Pass Plant Head Save Error Popup

## Goals

1. Show every SAP date field across all MM Approvals screens in **DD-MM-YYYY** format (display only — no logic changes).
2. Gate Pass: when Plant Head is selected → Execute → Save, a `TYPE: "E"` API response must show the exact `MESSAGE` value (e.g. "Please maintain remarks") in a Swal popup.

## Changes

### 1. Shared date helper (`src/lib/format.ts`)
Add `formatSapDateDMY(value, fallback?)` that:
- Accepts SAP forms: `YYYYMMDD`, `YYYY-MM-DD`, ISO strings, `Date`.
- Returns `DD-MM-YYYY`; returns the raw string unchanged when it is not a recognizable date; uses fallback (`—`) for empty/`00000000`/`0000-00-00`.
- Existing helpers stay untouched (no behavior change elsewhere).

### 2. Apply at render time in MM screens (no payload/logic changes)
Date columns are detected by their SAP key (DATE/DAT fields) and rendered through the helper:

| Screen | File | Fields |
|---|---|---|
| Gate Pass | `mm.gate-pass.tsx` | Header `GATEPASS_DATE`; item `EXPECTED_DATE_OF_RETURN` |
| Material Reservation | `mm.material-reservation.tsx` | Header `DOCUMENT_DATE` |
| PR Release | `mm.pr-release.tsx` | `PREQ_DATE`, `DELIV_DATE`, `REL_DATE` |
| PO Release | `mm.po-release.tsx` | `BEDAT` (PO Date) and any other date-keyed dynamic columns |
| MIGO Release | `mm.migo-release.tsx` | `GAT_DATE`, `GIR_DATE` |
| ZNFA Release | `mm.znfa-release.tsx` | `PR_APP_DATE`, `NFA_DATE`, `APPROVER_DATE`, attachment `CRDAT` |
| Service Entry Sheet | `mm.service-entry-sheet.tsx` | columns declared `type: "date"` (`BEDAT`, `ERDAT`) |
| ZNFA Rating / Gate Process | `gate-process.functions.ts` | `CRDAT` already formats to DD-MM-YYYY — verified, no change |

### 3. Gate Pass Plant Head Save error popup
- `saveGatePass` in `src/lib/mm/gate-pass.functions.ts` already extracts exact `MESSAGE` for `MESSAGES` arrays with `TYPE: "E"` and `STATUS: "FALSE"` (previous fix). Verify the Plant Head path sends `PH_APPROVAL` rows through the same handler and that `mm.gate-pass.tsx` surfaces `res.error` as a single-message Swal (label-less result) — only patch if the Plant Head mode skips that path.
- Add a regression test in `src/lib/mm/sap-message.test.ts` with the exact payload `{"MESSAGES":[{"TYPE":"E","MESSAGE":"Please maintain remarks"}]}` for the Plant Head save scenario.

## Out of scope
- No changes to API payloads, selection/locking rules, or any other screen behavior.
- SD screens and non-MM screens are not touched.

## Verification
- `bun run build:dev` passes.
- Vitest for `sap-message.test.ts` passes.
- Spot-check rendering: an 8-digit SAP date renders as DD-MM-YYYY in Gate Pass and ZNFA Release tables.
