## Goal

Add a "Final Recommendation" card below the RFQ Details card on the ZNFA Release create form, showing all columns from both reference images in one horizontally scrollable table.

## Changes (src/routes/_authenticated/mm.znfa-release.tsx)

1. Generalize the existing `DetailsTableCard` to accept a `columns` prop (it currently hardcodes `PR_DETAIL_COLUMNS`), so PR Details, RFQ Details, and Final Recommendation all share the same styling: sticky-scroll wrapper, `whitespace-nowrap` headers, right-aligned numeric columns, optional column divider, and an empty-state row.

2. Add `FINAL_RECOMMENDATION_COLUMNS` in a single list (no splitting):
   - Recommended Vendor (checkbox column, divider after it)
   - Vendor, Name, RFQ No
   - Commercial Rating, TER Rating
   - Basic Cost (numeric)
   - Currency, Conversion Rate (numeric), Tax (numeric), Discount (numeric), Freight/Transportation (numeric), Packing & FWD Charges (numeric)

3. Render `<DetailsTableCard title="FINAL RECOMMENDATION" columns={FINAL_RECOMMENDATION_COLUMNS} emptyText="No recommendation data yet — enter an RFQ Number and click Get Details." />` directly below the RFQ Details card.

## Technical notes

- Horizontal scrolling comes from the existing `overflow-x-auto` wrapper plus per-column `min-w` / `whitespace-nowrap`, matching the other MM tables — no new components or CSS.
- UI only; no API wiring, so the table shows the empty state until the RFQ lookup is implemented.
