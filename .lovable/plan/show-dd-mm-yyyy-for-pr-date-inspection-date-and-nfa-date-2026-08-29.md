# Show DD-MM-YYYY for PR Date, Inspection Date and NFA Date

## What's happening now

- **ZNFA Release (Release / Approved List)** — the results table renders every cell as raw text, so `NFA_DATE` shows the SAP value unformatted. The other tables on that screen already go through the shared date formatter; this one does not.
- **MIGO Release** — `ZINSP` (Inspection Date) is not recognised as a date key by the shared helper (its name has no "DATE"), so it renders raw.
- **ZNFA Rating (Display result)** — the `PR Date` header field shows the raw SAP value in an input; it is read-only in Display mode and editable in Change mode.

## Changes (display only)

1. `src/routes/_authenticated/mm.znfa-release.tsx` — in the Release / Approved List results table, run each cell through `formatSapDateDMY` when the column key is a date key (so `NFA_DATE` shows DD-MM-YYYY). NFA No hyperlink, status icons, numeric alignment and all other columns stay exactly as they are.
2. `src/routes/_authenticated/mm.migo-release.tsx` — treat `ZINSP` as a date field in the Custom Fields card so Inspection Date displays as DD-MM-YYYY. Payload keys and posting logic unchanged.
3. `src/routes/_authenticated/mm.gate-process.tsx` — display the `PR Date` header field as DD-MM-YYYY. In Change mode where the field is editable, the value typed/shown as DD-MM-YYYY is converted back to the original SAP format before it is put in the save payload, so the request stays byte-identical to today.

## Out of scope

No API payload, selection, validation or business-logic changes; no other screens or columns touched.

## Verification

- `bun run build:dev` passes.
- Spot-check: NFA Date in Release and Approved List tables, Inspection Date in MIGO custom fields, PR Date in ZNFA Rating Display result — all show DD-MM-YYYY; Save from ZNFA Rating Change still sends the SAP-format date.
