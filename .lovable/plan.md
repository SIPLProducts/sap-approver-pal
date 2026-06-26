## Problem

`Create_User_Display_Table` returns a flat array of Z-prefixed rows where one user has one row per plant+role combo:

```json
[
  {"ZUSER":"SURYA001","ZFIRST_NAME":"SARVI","ZLAST_NAME":"MAHAPATRA","ZEMAIL":"surya@gmail.com","ZCONTACT":"9876543210","ZSTATUS":"ACTIVE","ZWERKS":"3801","ZROLE":"ADMIN"},
  {"ZUSER":"SURYA001", ... ,"ZWERKS":"3801","ZROLE":"APPROVER"},
  {"ZUSER":"SURYA001", ... ,"ZWERKS":"3802","ZROLE":"VIEWER"},
  ...
]
```

The current `listUsersViaSap` parser looks for `USER` / `FIRST_NAME` / `EMAIL` / `PLANTS[]` / `ROLES[]`. None of the Z-prefixed keys match, so every row's `user` resolves to empty and gets skipped — audit log confirms `rows: 0`.

## Fix

Update only `listUsersViaSap` in `src/lib/admin/user-mgmt.functions.ts`:

1. **Recognize Z-prefixed aliases** in the per-row `pickField` lookups:
   - User id → `ZUSER`, `USER`, `EMPNO`, `SAP_USER_ID`, `USERNAME`
   - First name → `ZFIRST_NAME`, `FIRST_NAME`, `FNAME`
   - Last name → `ZLAST_NAME`, `LAST_NAME`, `LNAME`
   - Email → `ZEMAIL`, `EMAIL`, `SMTP_ADDR`
   - Contact → `ZCONTACT`, `CONTACT`, `MOBILE`, `TEL_NUMBER`
   - Status → `ZSTATUS`, `STATUS`
   - Plant (single) → `ZWERKS`, `WERKS`, `PLANT`
   - Role (single) → `ZROLE`, `ROLE`, `AGR_NAME`, `ROLE_NAME`
   - Continue supporting nested `PLANTS[]` / `ROLES[]` arrays for forward-compat.

2. **Aggregate per user**: replace the `users.push(...)` loop with a `Map<string, Row>` keyed by uppercase `user`. For each SAP row, merge its single `ZWERKS` / `ZROLE` (and any nested array fields) into the existing entry's `plants` and `roles` sets. First non-empty name/email/contact/status wins.

3. Normalize status to "ACTIVE"/"INACTIVE"/raw (e.g., `"A"` → `"ACTIVE"`) so the UI badge renders consistently.

4. Return `{ users: Row[] }` unchanged in shape — the existing `admin.users.tsx` table binding stays as-is.

5. Audit log payload: add a small `sample_keys` snapshot (`Object.keys(rows[0] ?? {})`) so future shape mismatches are diagnosable without DB log inspection.

No changes to the UI table, middleware, or any other server function.