## Current state vs spec

After the previous edit, the Reject flow already matches this spec:

- `src/routes/_authenticated/mm.pr-release.tsx` `onReject` maps only rows where `selected.has(k)` and filters by `PREQ_NO` — unselected rows are never included.
- `src/lib/mm/pr-release.functions.ts` `rejectPrItems` → `processPrAction(..., "REJECT", ...)` sends, for each selected row:
  ```json
  { "REJECT": { "BANFN": "<PREQ_NO>", "BNFPO": "<PREQ_ITEM>", "REL_CODE": "<relcode>", "REL_GRP": "<relgroup>", "REMARKS": "<row remarks or ''>" } }
  ```
- `PR_Reject_API` is `POST /mm_approve_mng/pr_rel/release?sap-client=300`, `is_active=true` in `sap_api_configs`.

The only literal difference from the pasted spec is `REMARKS`: the spec shows `""`, while the UI currently forwards whatever is typed in the row's Remarks input (empty string when untouched).

## Proposed change

Keep the current behavior — forward the row's `REMARKS` value (defaulting to `""`) — since the Remarks column was added earlier specifically to be sent to SAP, and the spec's `""` reads as an example, not a hard override. No code changes.

## Confirm before I proceed

Should `REMARKS` in the Reject payload be:
- (A) Left as-is: use the row's Remarks input, `""` when empty (current behavior), or
- (B) Hard-coded to `""` for Reject regardless of what the user types?

If (A), there is nothing to change and I'll close this out. If (B), I'll update `rejectPrItems` to override `REMARKS` to `""` in `src/lib/mm/pr-release.functions.ts` only.
