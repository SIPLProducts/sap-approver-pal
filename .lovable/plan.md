# PO Release — add USER_ID to the Undo Release payload

## Goal
The PO Undo Release call (Cancel Record ticked) currently sends `{ YCANCEL: { EBELN, FRGCO } }`. The SAP config `PO_CANCEL_RELEASE` expects `YCANCEL.USER_ID` as well (per the SAP API Settings screenshot). Add `USER_ID`, filled with the signed-in user's SAP User ID dynamically — no hardcoded value, without disturbing any other functionality.

## Verified current state
- `src/lib/mm/po-release.functions.ts`: `processPoAction` already accepts optional `user_id` and the `poActionInput` schema already includes it (added for Undo Reject). The `CANCEL_REJ` branch already sends `USER_ID`. The `YCANCEL` branch builds `{ EBELN, FRGCO }` only (lines 257-263) and omits `USER_ID`.
- `src/routes/_authenticated/mm.po-release.tsx`: `sapUserId` is already resolved dynamically (sapProfile → auth metadata fallback) and passed in `onUndoReject`; `onUndoRelease` does not pass it and has no guard.

## Changes
1. `src/lib/mm/po-release.functions.ts`
   - In the `YCANCEL` branch, add `USER_ID: (data.user_id ?? "").trim()` alongside `EBELN` and `FRGCO`.
   - No changes to RELEASE / REJECT / CANCEL_REJ payloads, de-duplication, response parsing, or logging.

2. `src/routes/_authenticated/mm.po-release.tsx`
   - Widen the `undoMutation` input type with `user_id: string`.
   - In `onUndoRelease`, guard: if `sapUserId` is empty, show a toast ("Could not determine the signed-in SAP user. Please sign in again.") and stop.
   - Pass `user_id: sapUserId` in the `undoMutation.mutate(...)` call.
   - Nothing else changes: button labels, confirmation wording, row removal, refresh, and all other actions behave as today.

## Verification
- `bunx tsgo --noEmit -p tsconfig.json`.
- Manual pass: PO Release with Cancel Record ticked → select a row → Undo Release; payload carries `YCANCEL.EBELN`, `YCANCEL.FRGCO`, and `YCANCEL.USER_ID` with the logged-in user's ID.
