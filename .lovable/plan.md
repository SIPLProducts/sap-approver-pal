# ZGP Report — send USER_NAME in the Cancel payload

## Goal
When the user clicks Cancel on the ZGP Report results, include the signed-in SAP User ID automatically as `user_name` (first key) inside the `cancel` object. Everything else — API logic, response popups, refresh behaviour — stays unchanged.

Target payload shape:

```json
{
  "cancel": {
    "user_name": "22011196",
    "type_from": "", "type_to": "",
    "number_from": "", "number_to": "",
    "material_from": "", "material_to": "",
    "date_from": "", "date_to": "",
    "plant_from": "", "plant_to": "",
    "vendor_from": "", "vendor_to": "",
    "type": "NRGP",
    "unique": "2000000121",
    "material": "300000890",
    "DESCRIPTION": "Oil Gear SAE 85W-140"
  }
}
```

## Changes

### 1. `src/lib/mm/zgp-report.functions.ts`
- In `cancelZgpRecords`, add an optional `user_name` string to the input schema.
- In the per-row loop, build the `cancel` object with `user_name` as the first key:
  ```ts
  const inputs = {
    cancel: {
      user_name: (data.user_name ?? "").trim(),
      ...filterData,
      type: row.TYPE ?? "",
      unique: row.UNIQUE_NO ?? "",
      material: row.MATERIAL ?? "",
      DESCRIPTION: row.DESCRIPTION ?? "",
    },
  };
  ```
- No other logic changes: same per-row loop, same filter pass-through, same message extraction, logging, and proxy routing.

### 2. `src/routes/_authenticated/mm.zgp-report.tsx`
- Resolve the signed-in SAP User ID the same way as the ZMC Report screen:
  ```ts
  const sapProfile = useSapProfile();
  const { user: authUser } = useAuth();
  const sapUserId = (
    sapProfile?.user ||
    (authUser?.user_metadata as { sap_user_id?: string } | undefined)?.sap_user_id ||
    ""
  ).trim();
  ```
- In `cancelSelected`, add the same guard used by the ZMC cancel: if `sapUserId` is empty, show a toast asking the user to sign in again and do not call the mutation.
- Add `user_name: sapUserId` to the `cancelMut.mutateAsync` payload (and widen the mutation's `vars` type).

## Not changed
Filters, Execute/Reset, column building, selection, confirmation popup, `SapResponseDialog`, the ZGP fetch service, other MM/SD/IWM screens, and all other APIs stay exactly as they are.

## Verification
- `bunx tsgo --noEmit -p tsconfig.json` for type safety.
- Confirm the ZGP Report still fetches, and Cancel sends `user_name` as the first key of `cancel` while behaving as before.
