# PO Release — add USER_ID to the Undo Reject payload

## Goal
The PO Undo Reject call (Cancel Record ticked) currently sends `{ CANCEL_REJ: { EBELN } }`. The SAP config `PO_CANCEL_REJECT` expects `CANCEL_REJ.USER_ID` as well (per the SAP API Settings screenshot). Add `USER_ID`, filled with the signed-in user's SAP User ID dynamically — no hardcoded value.

## Verified current state
- `src/lib/mm/po-release.functions.ts`: CANCEL_REJ branch builds `{ CANCEL_REJ: { EBELN } }` only (lines 249-254); `processPoAction`'s `data` type has no `user_id`; `poActionInput` (line 426, shared by all four PO actions) has no `user_id` field.
- `src/routes/_authenticated/mm.po-release.tsx`: `sapUserId` is already resolved dynamically (sapProfile → auth metadata fallback, lines 90-94) and already passed to the fetch mutation; `onUndoReject` (line 502) does not pass it.

## Changes
1. `src/lib/mm/po-release.functions.ts`
   - Add `user_id: z.string().trim().optional().default("")` to `poActionInput` (harmless for Release/Reject/Undo Release since it's only read in the CANCEL_REJ branch).
   - Widen `processPoAction`'s `data` type with optional `user_id?: string`.
   - In the CANCEL_REJ branch, build `{ CANCEL_REJ: { EBELN: ebeln, USER_ID: (data.user_id ?? "").trim() } }`.
   - No changes to RELEASE / REJECT / YCANCEL payloads, de-duplication, response parsing, or logging.

2. `src/routes/_authenticated/mm.po-release.tsx`
   - Widen the `undoRejectMutation` input type with `user_id: string`.
   - In `onUndoReject`, guard: if `sapUserId` is empty, show a toast ("Could not determine the signed-in SAP user. Please sign in again.") and stop.
   - Pass `user_id: sapUserId` in the `undoRejectMutation.mutate(...)` call.
   - Nothing else changes: button labels, confirmation wording, row removal, refresh, and all other actions behave as today.

## Verification
- `bunx tsgo --noEmit -p tsconfig.json`.
- Manual pass: PO Release with Cancel Record ticked → select a row → Undo Reject; payload carries `CANCEL_REJ.EBELN` and `CANCEL_REJ.USER_ID` with the logged-in user's ID.
