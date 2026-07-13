## Root cause

The SAP API config row in `sap_api_configs` is named `Get_Search _Term` (extra space before `_Term`). The lookup in `src/lib/sap/search-term.functions.ts` uses `ilike("name", "Get_Search_Term")`, which is case-insensitive but not whitespace-insensitive — so `configId` comes back `null`, the F4 button is hidden by `hasConfig = !!configId`, and `/sap/invoke` is never called. Postman works because you're hitting SAP directly, bypassing this lookup.

## Fix

Rename the config in the database so the app finds it. One-line update in a migration:

```sql
UPDATE public.sap_api_configs
SET name = 'Get_Search_Term'
WHERE id = '5fc48733-7be5-428d-84a6-7cd5389af4d7';
```

That's the whole fix. No code changes required — the existing `search-term.functions.ts`, `SearchTermMultiSelect`, and middleware wiring are already correct.

## Verification

After migration, reload the SD Contract / Sales Order / Service Certificate screens:

1. F4 magnifier button appears next to the Search Term input.
2. Clicking it opens the popup; middleware terminal logs `[/sap/invoke] config name=Get_Search_Term …`.
3. Options list populates from the SAP response.

If any config-name drift happens again later, the fastest diagnostic is `SELECT id, name FROM sap_api_configs WHERE name ILIKE '%search%term%'` — any name other than exactly `Get_Search_Term` will silently hide the F4 button.