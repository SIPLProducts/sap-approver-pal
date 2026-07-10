## Problem

When editing a user without changing the password, the Edit_User request currently forwards `"PASSWORD": "********"` and `"ZCONFPSWD": "********"` to SAP. Those asterisks are a UI placeholder — sending them to SAP would overwrite the real password with literal asterisks.

Source: `src/lib/admin/user-mgmt.functions.ts` lines 781–785:

```ts
inner.PASSWORD = data.password || "********";
inner.ZCONFPSWD = data.confirm_password || data.password || "********";
```

## Fix

In the `editSapUser` server function, only include `PASSWORD` / `ZCONFPSWD` when the operator actually opted in to change the password (i.e. `data.password` is a non-empty string). Otherwise, omit both keys from the `EDIT` payload entirely so SAP keeps the existing password untouched.

### Edit

`src/lib/admin/user-mgmt.functions.ts` (~lines 781–786):

```ts
if (data.password) {
  inner.PASSWORD = data.password;
  inner.ZCONFPSWD = data.confirm_password || data.password;
}
const payload = { EDIT: inner };
```

### Audit log

Update the audit log spread (~line 804) so the masked `PASSWORD`/`ZCONFPSWD` entries only appear when they were actually sent:

```ts
request: {
  EDIT: {
    ...inner,
    ...(inner.PASSWORD ? { PASSWORD: "***", ZCONFPSWD: "***" } : {}),
  },
},
```

No other files change. The create-user flow (which legitimately needs a real password) is unaffected — it lives in a separate block above and always supplies `data.password`.

## Verification

Edit an existing SAP user in the admin screen without ticking "Change password" and confirm the outbound middleware request no longer contains `PASSWORD` or `ZCONFPSWD` keys, and SAP returns success without resetting the password. Then edit again with "Change password" ticked and confirm both keys are sent with the real values.
