# PR Release — add USER_ID to the Undo Reject payload

## Goal
The PR Undo Reject call (Cancel Record ticked) currently sends `{ CANCEL_REJ: { BANFN } }`. The SAP config `PR_CANCEL_REJECT` expects `CANCEL_REJ.USER_ID` as well. Add `USER_ID` to the payload, filled with the signed-in user's SAP User ID dynamically — no hardcoded value.

## Verified current state
- `src/lib/mm/pr-release.functions.ts`: `processPrAction` builds the CANCEL_REJ payload with only `BANFN` (line 256); `prUndoRejectInput` (line 457) has no `user_id` field.
- `src/routes/_authenticated/mm.pr-release.tsx`: `sapUserId` is already resolved dynamically (sapProfile → auth metadata fallback, lines 153-160) and `onUndoReject` (line 486) does not pass it.
- The fetch path already sends `USER_ID` the same way (validator `user_id`, payload line 73).

## Changes
1. `src/lib/mm/pr-release.functions.ts`
   - Add `user_id: z.string().trim().optional().default("")` to `prUndoRejectInput`.
   - Widen `processPrAction`'s `data` type with optional `user_id?: string`.
   - In the CANCEL_REJ branch, build `{ CANCEL_REJ: { BANFN: item.PREQ_NO, USER_ID: (data.user_id ?? "").trim() } }`.
   - No changes to RELEASE / REJECT / YCANCEL payloads, de-duplication, response parsing, or logging.

2. `src/routes/_authenticated/mm.pr-release.tsx`
   - In `onUndoReject`, guard: if `sapUserId` is empty, show the standard response popup ("Could not determine the signed-in SAP user. Please sign in again.") and stop.
   - Pass `user_id: sapUserId` in the `undoRejectMutation.mutate(...)` call.
   - Nothing else changes: button labels, confirmation, row removal, refresh, and all other actions behave as today.

## Verification
- `bunx tsgo --noEmit -p tsconfig.json`.
- Manual pass: PR Release with Cancel Record ticked → select a row → Undo Reject; payload carries `CANCEL_REJ.BANFN` and `CANCEL_REJ.USER_ID` with the logged-in user's ID.
