# PR Release — add USER_ID to Release payload

## Goal
Pass the signed-in SAP User ID dynamically in the PR Release (normal release) payload, matching the existing Reject / Undo Release / Undo Reject behavior.

## What will change
1. `src/lib/mm/pr-release.functions.ts`
   - Extend `prActionInput` with an optional `user_id` field.
   - In `processPrAction`, when `payloadKey === "RELEASE"`, include `USER_ID: (data.user_id ?? "").trim()` in the `RELEASE` object.
2. `src/routes/_authenticated/mm.pr-release.tsx`
   - In `onRelease`, add the same `sapUserId` guard used by Reject/Undo actions.
   - Pass `user_id: sapUserId` to `releaseMutation.mutate`.

## What will NOT change
- Fetch payload / Execute behavior.
- Reject, Undo Release, Undo Reject payloads (already include USER_ID).
- UI copy, confirmation dialogs, table columns, or row handling.
- SAP message extraction / popup behavior.

## Verification
- Run `bunx tsgo --noEmit -p tsconfig.json`.
- User will test PR Release end-to-end on the live screen.
