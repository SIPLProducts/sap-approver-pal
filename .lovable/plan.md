# ZNFA Release — matrix first, RFQ checkbox removed, Get Details disabled

Three focused UI changes on the ZNFA Release screen. No API, payload, or data-mapping changes.

## 1. Approval / Release Matrix first

Move the **APPROVAL / RELEASE MATRIX** card so it renders as the very first card of the loaded NFA document, above the header/RFQ/Buyer cards, PR Details, RFQ Details, Final Recommendation, and Award & Attachments. Same columns, same data (`REL_MATX`), same styling and empty state — only its position changes.

## 2. RFQ Details — remove the checkbox

In the RFQ Details tree table, drop the read-only `CHECK_RFQ` checkbox column from the vendor parent rows (and its blank spacer header/cell). The expand/collapse arrow, vendor label, and all child columns stay exactly as they are.

## 3. RFQ Number — Get Details disabled

The **Get Details** button next to the RFQ Number input becomes permanently disabled (greyed out). The input and the search (F4) button next to it are untouched.

## Technical notes

Single file: `src/routes/_authenticated/mm.znfa-release.tsx`.

- Relocate the `DetailsTableCard title="APPROVAL / RELEASE MATRIX"` block to the top of the `showCreate` fragment, before the 3-column card grid.
- In `RfqDetailsTreeCard`: remove the second `TableHead` spacer and the checkbox `TableCell`; drop the `checked` field from the grouping `useMemo` and adjust child-row `colSpan` accordingly.
- Add `disabled` to the Get Details `Button`; leave `onGetDetails` in place unused-safe (kept for the F4 handler pattern) or keep the handler wired but unreachable.
