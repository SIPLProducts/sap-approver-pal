# Add KUNNR to Finace_Change_API payload

## Change
In the Financial Year Base Rate screen, the Change action builds each `modify` item without the customer. Add `KUNNR` taken from each selected row's Customer value, placed after `WERKS` to match the revised payload:

```text
MANDT, WERKS, KUNNR, NAME1, MATERIAL, FIN_RATE, UPDATED_BY, UPDATED_ON, APPROV_BY, STATUS
```

Each selected row sends its own Customer, so every modified record carries the correct value.

## Unchanged
`user_name`, all other fields, the API call, success/error handling, reload, Save/Delete and the UI stay exactly as they are.

## Technical details
File: `src/routes/_authenticated/imw.financial-year-base-rate.tsx`, Change handler `modify` mapping: add `KUNNR: str(r.KUNNR)`.
