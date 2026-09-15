# PR Release — add USER_ID to the Undo Release payload

## Goal
The PR Undo Release call (Cancel Record ticked) currently sends `{ YCANCEL: { BANFN, BNFPO, REL_CODE, REL_GRP } }`. The SAP config `PR_CANCEL_RELEASE` expects `YCANCEL.USER_ID` as well (per SAP API Settings screenshot). Add `USER_ID`, filled with the signed-in user's SAP User ID dynamically — no hardcoded value.

## Verified current state
- `src/lib/mm/pr-release.functions.ts`: YCANCEL branch builds `{ BANFN, BNFPO, REL_CODE, REL_GRP }` only (lines 259–265); `prUndoInput` (line 438) has no `user_id`; `processPrAction` already accepts optional `user_id` (added for Undo Reject).
- `src/routes/_authenticated/mm.pr-release.tsx`: `sapUserId` is already resolved dynamically and already passed in `onUndoReject`; `onUndoRelease` does not pass it.

## Changes
1. `src/lib/mm/pr-release.functions.ts`
   - Add `user_id: z.string().trim().optional().default("")` to `prUndoInput`.
   - In the YCANCEL branch, add `USER_ID: (data.user_id ?? "").trim()` to the payload.
   - No changes to RELEASE / REJECT / CANCEL_REJ payloads, de-duplication, response parsing, or logging.

2. `src/routes/_authenticated/mm.pr-release.tsx`
   - In `onUndoRelease`, guard: if `sapUserId` is empty, show the standard response popup ("Could not determine the signed-in SAP user. Please sign in again.") and stop.
   - Pass `user_id: sapUserId` in the `undoMutation.mutate(...)` call.
   - Nothing else changes: button labels, confirmation, row removal, refresh, and all other actions behave as today.

## Verification
- `bunx tsgo --noEmit -p tsconfig.json`.
- Manual pass: PR Release with Cancel Record ticked → select a row → Undo Release; payload carries `YCANCEL.BANFN/BNFPO/REL_CODE/REL_GRP` plus `YCANCEL.USER_ID` with the logged-in user's ID.
