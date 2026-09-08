# Dynamic User ID for GET PO API

## Goal
Send the signed-in user's SAP User ID dynamically in every GET PO API request (`PO_GET_API`), with no hardcoded value and no change to existing API logic.

## Current state
- `src/routes/_authenticated/mm.po-release.tsx` passes `user_id: sapProfile?.user ?? ""` to `fetchPoGet`.
- `src/lib/mm/po-release.functions.ts` already accepts `user_id` and forwards it as `GET.USER_ID` to SAP.
- PR Release already uses a session fallback via `useAuth()`; PO Release does not.

## Changes
1. In `src/routes/_authenticated/mm.po-release.tsx`:
   - Import `useAuth` from `@/hooks/use-auth`.
   - Resolve the SAP user ID with the same fallback chain used in PR Release:
     - `sapProfile?.user`
     - `authUser?.user_metadata?.sap_user_id`
     - empty string fallback
   - Add a guard in `execute()`: if `sapUserId` is empty, show a toast error and stop.
   - Replace all five `user_id: sapProfile?.user ?? ""` occurrences with `user_id: sapUserId`.

2. No changes to `src/lib/mm/po-release.functions.ts` or any other API logic.

## Verification
- Run `bunx tsgo --noEmit -p tsconfig.json`.
- Open PO Release, click Execute, and confirm the request payload includes the logged-in user's `USER_ID`.

## Non-goals
- No UI changes.
- No changes to Release/Reject/Undo APIs.
- No changes to validation, filters, pagination, or SAP configuration.
