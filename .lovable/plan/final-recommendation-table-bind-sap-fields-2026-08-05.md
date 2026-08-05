# Final Recommendation table — bind SAP fields

Rebind the FINAL RECOMMENDATION table on the ZNFA Release screen to the exact SAP `RECOMM` response fields, including a read-only "Recommended Vendor" checkbox driven by `APP_VENDOR`.

## Columns (in order)

| Column | SAP field |
| --- | --- |
| Recommended Vendor (checkbox) | `APP_VENDOR` — ticked when value is `X` |
| RFQ Number | `EBELN` |
| Vendor Code | `LIFNR` |
| Purchasing Group | `EKGRP` |
| Vendor Name | `NAME1` |
| Plant | `WERKS` |
| Commercial Rating | `VENDOR_RATE` |
| TER Rating | `TER_RATE` |
| Basic Cost | `BASIC_COST` |
| Currency | `WAERS` |
| Tax | `TAX` |
| Discount | `DISCOUNT` |
| Freight/Transportation | `FREIGHT` |
| Packing & Forward Charges | `PACK_FWD` |
| Total | `TOTAL` |
| Remarks | `REMARKS` |

Numeric columns (Basic Cost, Tax, Discount, Freight, Packing & Forward, Total) stay right-aligned with tabular figures; blank/missing values keep showing the existing dash placeholder. The `APP_VENDOR` match is case-insensitive and trimmed, so `"X"`, `"x"`, `" X "` all count as checked.

## Behaviour

- The checkbox is display-only (disabled), mirroring SAP — clicking does nothing.
- Placeholder columns that are not in the SAP response (`__rfq_no`, `__conversion_rate`) are removed.
- Everything else on the screen is unchanged: same data source (`recommendRows` from the Display / NFA-click response), same card styling, same empty state.

## Technical notes

- Single file: `src/routes/_authenticated/mm.znfa-release.tsx`.
- Replace `FINAL_RECOMMENDATION_COLUMNS` with the mapping above.
- Extend `DetailColumn` with an optional `checkbox?: true`, and have `DetailsTableCard` render a disabled `Checkbox` (checked via the existing `isSapFlag` helper) for such columns instead of text — the table's current leading blank column carries it, so no layout change.
- No server-function, payload, or schema changes.
