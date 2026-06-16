## Problem

The SAP sample payload you pasted is not valid JSON — it contains empty values:

```
"ADV_DOC_NUM": { "ZEILE": , "EBELP": }
```

A standard `JSON.parse` rejects this with `Unexpected token ','`, which is exactly the error toast on the Response tab. SAP often emits this shape (empty = null), so the import dialog should clean it up before parsing instead of failing.

## Fix

Edit `src/lib/admin/payload-detect.ts` → `parsePayloadText`:

1. Try `JSON.parse(text)` first (fast path for valid payloads).
2. On failure, run a small sanitizer and retry:
   - Replace empty values after a colon with `null`: `"key": ,` → `"key": null,` and `"key": }` → `"key": null}` (also handles `]`).
   - Strip trailing commas before `}` or `]` (`, }` → `}`).
   - Optionally strip `// ...` and `/* ... */` comments.
3. If the retry also fails, return the original parser error so users still see a real diagnostic.
4. Keep the 1 MB size cap and existing return shape unchanged — no UI changes needed; `PayloadImportDialog` already shows the resulting detected fields.

After this, pasting your SAP payload detects ~33 fields including `DATA[].ADV_DOC_NUM.ZEILE` and `DATA[].ADV_DOC_NUM.EBELP` as `null`, and Import payload populates the Response mapping table.

## Out of scope

- No changes to the Service Certificate or Sales Order Approvals screens themselves — this is purely the SAP API Settings → Import payload detector.
- No backend or schema changes.
