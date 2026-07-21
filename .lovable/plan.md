## Refresh PR Release table after successful release

**Problem**: After clicking Release, the API returns success (with MSGTXT), but the released row stays visible. The follow-up `PR_Release_Multiple_Fetch_API` call either runs before SAP commits the release or returns the same row, so the table never updates.

**Fix (UI only, `src/routes/_authenticated/mm.pr-release.tsx`)**:

1. In `releaseMutation.onSuccess`, before triggering the re-fetch:
   - Build a set of `${preq_no}-${preq_item}` keys from `res.results` where `ok === true`.
   - Filter `rows` state to remove any row whose `PREQ_NO`/`PREQ_ITEM` matches — this is the optimistic update that makes released rows disappear immediately.
   - Clear `selected` and the `remarks` entries for removed rows.
2. Still call the existing `fetchPrReleaseMultiple` mutation afterwards so the list stays in sync with SAP (the mutation's own `onSuccess` will overwrite `rows` with the fresh server list; if SAP has now removed the released items they stay gone, if not our optimistic filter already hid them).
3. If every result failed (`ok === false` for all), skip the optimistic filter but still show the error toasts (current behavior).

No changes to `src/lib/mm/pr-release.functions.ts`, no schema changes, no changes to the Reject flow or the fetch server function.
