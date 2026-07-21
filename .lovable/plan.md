## PR Release — wire up Reject button

Mirror the existing Release flow for Reject, using the `PR_Reject_API` config from SAP API Settings.

### Server function
In `src/lib/mm/pr-release.functions.ts`, add `rejectPrItems` alongside `releasePrItems`:
- Same input shape: `{ relgroup, relcode, items: [{ PREQ_NO, PREQ_ITEM, REMARKS? }] }`.
- For each item, POST via `/sap/invoke` to the `PR_Reject_API` config with payload:
  ```json
  { "REJECT": { "BANFN": PREQ_NO, "BNFPO": PREQ_ITEM, "REL_CODE": relcode, "REL_GRP": relgroup, "REMARKS": remarks ?? "" } }
  ```
- Parse response array `[{ MSGTXT, STATUS }]`; treat `STATUS === "TRUE"` (case-insensitive) as success. Return `{ results: [{ preq_no, preq_item, ok, msgtxt, error }] }` — identical shape to release results so the UI reuses the same toast/refresh code.

### UI (`src/routes/_authenticated/mm.pr-release.tsx`)
- Add `rejectFn = useServerFn(rejectPrItems)` and a `rejectMutation` that mirrors `releaseMutation`:
  - On success: toast per row using `MSGTXT`, remove rejected rows (matched by `PREQ_NO`+`PREQ_ITEM`) from `rows`, clear `selected`/`remarks`, and re-run the fetch mutation to refresh the pending list.
  - On error: toast the error message.
- Replace the placeholder `onReject` with the mutation call. Guard on `releaseGroup`/`releaseCode` presence, same as Release.
- Disable the Reject button while `rejectMutation.isPending`; show a spinner just like Release.

### Out of scope
No changes to middleware, other screens, column labels, or Release logic.
