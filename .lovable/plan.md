# RFQ Details as a vendor tree table

Turn the RFQ Details card on the ZNFA Release screen into a tree table, matching the PR Details tree already on the same screen.

## Behaviour

- Parent row: **Vendor Name / Vendor Code** (`NAME1 / LIFNR`) with an expand/collapse arrow, plus a small "N items" hint and the RFQ checkbox flag (`CHECK_RFQ`) shown as a read-only checkbox.
- Child rows (shown when expanded): one row per RFQ item, using the requested SAP keys.
- Rows are grouped by vendor code (falling back to vendor name) in the order SAP returns them.
- Existing card styling, CSS, and all other cards/functionality stay unchanged.

## Child columns and SAP keys

| Column | RFQ_DET field |
| --- | --- |
| RFQ No | ANFNR |
| RFQ Item | ANFPS |
| Plant | WERKS |
| Material/Services | MATNR |
| Item Text | TXZ01 |
| Qty | ANMNG |
| UOM | MEINS |
| Unit Rate | FINAL_RATE |
| Currency | WAERS |
| Basic Rate | BASIC_COST |
| Tax | TAX |
| Tax Code | MWSKZ |
| Discount | DISCOUNT |
| Freight/Transportation | FREIGHT |
| Packing & Forwarding | PACK_FWD |
| Final Rate | TOTAL |
| Final Revision | FINAL_REV |
| TE Rating | TER_RATE |
| Evaluator | TER_NAME |

Numeric columns (Qty, Unit Rate, Basic Rate, Tax, Discount, Freight, Packing, Final Rate) are right-aligned with tabular figures; Item Text keeps the wide wrapping treatment used elsewhere.

## Technical notes

Single file: `src/routes/_authenticated/mm.znfa-release.tsx`.

- Add `RFQ_ITEM_COLUMNS` (the table above) and a `RfqDetailsTreeCard` component modelled on the existing `PrDetailsTreeCard` — same `Table`, `Fragment`, `ChevronRight`/`ChevronDown`, `expanded: Set<string>` toggle, and `cellText` helper.
- Parent grouping key: `LIFNR` (fallback `NAME1`), label rendered as `NAME1 / LIFNR`; `CHECK_RFQ === "X"` renders a disabled checked checkbox in the arrow-adjacent cell.
- Replace the `DetailsTableCard title="RFQ DETAILS"` usage with `<RfqDetailsTreeCard rows={rfqRows} emptyText="No RFQ details returned by SAP." />`.
- Leave `RFQ_DETAIL_COLUMNS` in place if still referenced elsewhere; otherwise remove it to avoid an unused constant.
