# Service Entry Sheet — add USER_ID to Release / Unrelease payloads

## Goal
Release (`SES_RELEASE_API`) and Unrelease (`SES_REJECT_API`) send the signed-in user's SAP User ID as `USER_ID`:

```text
{ "ACTION": "RELEASE" | "UNRELEASE", "ENTRY_SHEET": "...", "RELEASE_CODE": "...", "USER_ID": "<login user id>" }
```

## Changes
1. `src/lib/mm/ses.functions.ts`
   - Add optional `user_id` (trimmed string, default "") to the Release and Reject input schemas.
   - Add `USER_ID: data.user_id` after `RELEASE_CODE` in both payload builders. Everything else (Delete, fetch, response parsing, logging, proxy/direct) unchanged.
2. `src/routes/_authenticated/mm.service-entry-sheet.tsx`
   - Resolve `sapUserId` the same way PO/PR Release do: `useSapProfile().user`, fallback to signed-in account's `sap_user_id` metadata.
   - Pass `user_id: sapUserId` in the `runRelease` and `runReject` calls. If empty, show the standard "Could not determine the signed-in SAP user. Please sign in again." message and stop.

## Verification
- Typecheck `bunx tsgo --noEmit -p tsconfig.json`.
