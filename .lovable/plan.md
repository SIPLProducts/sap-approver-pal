# Uniform light table headers + PO Release "No POs Found" popup

## 1. One table header style everywhere

Today the header colors come from CSS variables in `src/styles.css`. The light theme already uses the requested values, but the dark-theme block overrides them with navy (`#1C2438`), and a few tables render their own markup instead of the shared components, so some screens still show a dark header block.

Changes:
- Lock the header tokens to the requested values in both themes: background `#F0F2F7`, text `#111827`, border `#E1E5EC` (remove the dark-mode navy overrides for header tokens only — the rest of dark mode stays as is).
- Keep the existing `--table-header-*` variable approach so `src/components/ui/table.tsx` and `src/components/aws/cloudscape-approval-table.tsx` inherit it automatically with no logic change.
- Point the remaining hand-rolled table headers (the raw `<thead>` in `src/routes/_authenticated/approval.$id.tsx`, and any Cloudscape default header styling) at the same tokens so no screen keeps a dark block.

No component logic, column definitions, or data handling change — only color classes/variables.

## 2. PO Release: STATUS "FALSE" shows only MSGTXT

Currently `fetchPoGet` in `src/lib/mm/po-release.functions.ts` collects rows from the SAP response and only reports transport-level errors. A response carrying `STATUS: "FALSE"` with `MSGTXT: "No POs Found"` falls through and can land in the table.

Changes:
- In `fetchPoGet`, after parsing each plant's response, detect `STATUS` equal to `FALSE` (case-insensitive, also when nested in the returned object) and capture its exact `MSGTXT` value. Skip adding any rows from that response.
- Return that `MSGTXT` verbatim as the error message when no rows were collected, so nothing is added to the results table.
- In `src/routes/_authenticated/mm.po-release.tsx`, show that message in the existing response popup dialog (the same dialog used for Release/Reject responses) instead of only a toast, displaying the exact text with no extra wording. Table rows and selection are cleared as they already are on an error response.

Execute, Release, Reject, plant/release-key filters and every other behaviour on the screen stay untouched.

## Technical notes
- Files touched: `src/styles.css`, `src/routes/_authenticated/approval.$id.tsx`, `src/lib/mm/po-release.functions.ts`, `src/routes/_authenticated/mm.po-release.tsx`.
- The shared table primitives are not restructured; they already read the header tokens.
