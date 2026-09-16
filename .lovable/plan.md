# ZMC Report — send USER_NAME in the Cancel payload

## Goal
When the user clicks Cancel on the ZMC Report results, include the signed-in SAP User ID automatically as `USER_NAME` inside `input_data`. Everything else — API logic, response popups, refresh behaviour — stays unchanged.

Target payload shape:

```json
{
  "input_data": {
    "USER_NAME": "22011196",
    "PLANT_FROM": "", "PLANT_TO": "",
    "DATE_FROM": "", "DATE_TO": "",
    "DOC_FROM": "3000000602", "DOC_TO": "",
    "TYPE_FROM": "", "TYPE_TO": ""
  },
  "cancel": { ...row fields exactly as today... }
}
```

## Changes

### 1. `src/lib/mm/zmc-report.functions.ts`
- In `cancelZmcRecords`, add an optional `user_name` string to the input schema.
- In the handler, build `inputData` with `USER_NAME` as the first key:
  ```ts
  const inputData = {
    USER_NAME: (data.user_name ?? "").trim(),
    PLANT_FROM: ..., // rest unchanged
  };
  ```
- No other logic changes: same per-row loop, same `cancel` pass-through, same message extraction and logging.

### 2. `src/routes/_authenticated/mm.zmc-report.tsx`
- Resolve the signed-in SAP User ID the same way as the PR/PO Release screens:
  ```ts
  const sapProfile = useSapProfile();
  const { user: authUser } = useAuth();
  const sapUserId = (
    sapProfile?.user ||
    (authUser?.user_metadata as { sap_user_id?: string } | undefined)?.sap_user_id ||
    ""
  ).trim();
  ```
- In `cancelSelected`, add the same guard used by the undo actions: if `sapUserId` is empty, show a toast asking the user to sign in again and do not call the mutation.
- Pass `user_name: sapUserId` in the `cancelMut.mutateAsync` payload.

## Not changed
Filters, Execute/Reset, column building, selection, confirmation popup, `SapResponseDialog`, the fetch service, other MM/SD/IWM screens, and all other APIs stay exactly as they are.

## Verification
- `bunx tsgo --noEmit -p tsconfig.json` for type safety.
- Confirm the ZMC Report still fetches, and Cancel sends `USER_NAME` in `input_data` while behaving as before.
