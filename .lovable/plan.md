# Bind MIGO item-level UNLOAD_PT field

## Goal
Surface the `UNLOAD_PT` field that SAP now returns at the item level in the MIGO fetch response, and pass the same value back in the MIGO POST/SAVE payload. No other behavior changes.

## Changes
1. `src/lib/mm/migo-payload.ts`
   - Append `"UNLOAD_PT"` to `MIGO_ITEM_KEYS`.
   - Keep it as a string field (do not add to `MIGO_NUMERIC_ITEM_KEYS`).

2. `src/routes/_authenticated/mm.migo-release.tsx`
   - Add `UNLOAD_PT: "Unloading Point"` to `FIELD_LABELS` so the column header is business-friendly.

## Why this is enough
- `buildMigoItem` iterates `MIGO_ITEM_KEYS`, reads the value from the fetched row with case-insensitive `pick`, and writes it to the payload.
- The table columns are generated dynamically from row keys, so adding the key to the payload builder and labels is sufficient for both display and POST.
- Existing editable columns (Entry Quantity, Storage Location, Stock Type, checkboxes) remain untouched.

## Verification
- Run `bunx tsgo --noEmit -p tsconfig.json`.
- No runtime test is possible without live SAP data, but the code path is covered by the existing MIGO fetch/post flow.
