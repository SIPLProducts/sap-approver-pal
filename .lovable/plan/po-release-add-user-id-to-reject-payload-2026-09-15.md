# PO Release — add USER_ID to Reject payload

## Goal
Pass the signed-in SAP User ID dynamically in the PO Reject payload (`REJECT.USER_ID`) without changing any other behavior.

## Changes

### 1. `src/lib/mm/po-release.functions.ts`
- In `processPoAction`, update the `REJECT` branch so it sends:
  ```json
  {
    "REJECT": {
      "EBELN": ebeln,
      "REMARKS": grp.remarks,
      "USER_ID": data.user_id
    }
  }
  ```
- `poActionInput` already accepts an optional `user_id`, so no schema change is needed.

### 2. `src/routes/_authenticated/mm.po-release.tsx`
- In the `rejectMutation` call (`onReject`), include `user_id: sapUserId` in the payload.
- Add the same SAP User ID guard used by the undo actions:
  - If `sapUserId` is empty, show a toast asking the user to sign in again and do not call the mutation.
- Update the mutation function type to accept `user_id: string`.

## Verification
- Run `bunx tsgo --noEmit -p tsconfig.json` to confirm type safety.
- Confirm the PO Release screen still fetches, releases, rejects, and undos as before.
