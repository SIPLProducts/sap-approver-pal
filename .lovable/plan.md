## Root cause

In Admin → SAP API, all 7 request fields of `Contract_Approval_Fetch` are saved as `source = 'static'` with `R_PEND=X` hard-coded. The middleware therefore sends `R_PEND=X` to SAP on every call and ignores the radio (Pending / Accepted / Rejected) and the Plant / User ID / Customer From–To the screen sends. SAP correctly returns the same pending list each time.

## Fix — one tiny data change

Flip `source` from `static` to `column` for those 7 fields. With `column`, the middleware uses the value the app sends (so the status flag, plant, user, customer range from the screen actually reach SAP) and only falls back to the saved default when the app sends nothing.

```sql
UPDATE public.sap_api_request_fields
SET source = 'column'
WHERE config_id = (SELECT id FROM public.sap_api_configs WHERE name = 'Contract_Approval_Fetch')
  AND field_name IN ('PLANT','USER_ID','CUSTOMER_FROM','CUSTOMER_TO','R_PEND','R_ACCP','R_REJ');
```

Defaults stay (`PLANT=3801`, `USER_ID=NEOBMWCONS1`, `R_PEND=X`) so behaviour is unchanged when the screen sends nothing.

No code edits. No middleware changes. After the update:
- Pending → SAP gets `R_PEND=X, R_ACCP="", R_REJ=""`
- Accepted → SAP gets `R_PEND="", R_ACCP=X, R_REJ=""`
- Rejected → SAP gets `R_PEND="", R_ACCP="", R_REJ=X`

The UI already auto-refetches when the radio changes, so each tab will show the rows SAP returns for that status.

## Files

- One data update on `public.sap_api_request_fields` (no schema change, no code change).
