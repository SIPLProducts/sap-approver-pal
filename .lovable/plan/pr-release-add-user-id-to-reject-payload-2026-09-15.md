# PR Release — add USER_ID to Reject payload

## Goal
Pass the signed-in SAP User ID dynamically in the PR Reject payload (`REJECT.USER_ID`) without changing any other behavior.

## Changes

### 1. `src/lib/mm/pr-release.functions.ts`
- Add `user_id` to `prRejectInput` (optional string, default `""`).
- In `processPrAction`, when `payloadKey === "REJECT"`, include `USER_ID: (data.user_id ?? "").trim()` in the `REJECT` object alongside `BANFN`, `BNFPO`, `REL_CODE`, `REL_GRP`, and `REMARKS`.

### 2. `src/routes/_authenticated/mm.pr-release.tsx`
- Update the `rejectMutation` mutation function type to accept `user_id: string`.
- In `onReject`, add the same SAP User ID guard used by the undo actions:
  - If `sapUserId` is empty, show a toast asking the user to sign in again and do not proceed.
- Pass `user_id: sapUserId` in the `rejectMutation.mutate(...)` call.

## Verification
- Run `bunx tsgo --noEmit -p tsconfig.json` to confirm type safety.
- Confirm the PR Release screen still fetches, releases, rejects, and undos as before.
