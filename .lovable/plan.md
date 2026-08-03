## Goal

On the ZNFA Release Create screen: add a vertical divider line after the **Vendor Name/Vendor Code** column in the PR Details table, and add a new **RFQ Details** card below PR Details with the same table structure and styling.

## Layout

```text
+-------------------------------------------------------------+
| PR DETAILS                                                  |
| Vendor Name/Vendor Code | Check | RFQ No | RFQ Item | ...    |
|                         |                                   |
+-------------------------------------------------------------+
+-------------------------------------------------------------+
| RFQ DETAILS                                                 |
| Vendor Name/Vendor Code | Check | RFQ No | RFQ Item | ...    |
|                         |                                   |
+-------------------------------------------------------------+
```

## Changes

1. **Divider after Vendor column** — mark the vendor column as a section boundary and apply a right border (`border-r`) to its header cell and body cells, matching the reference where the vendor block is visually separated from the rest of the grid. The vendor column also gets a wider minimum width so it reads as its own panel.

2. **New RFQ Details card** — full-width card rendered directly below PR Details, only when Create is selected:
   - Header row: `ListChecks` icon + `RFQ DETAILS` label, same uppercase muted style as PR Details.
   - Same column set as PR Details (Vendor Name/Vendor Code, Check, RFQ No, RFQ Item, Plant, Material, Item Text, Qty, UOM, Unit Rate, Currency, Basic Value, Tax, Tax Value, Total Value), same numeric right-alignment, same leading select column and vendor divider.
   - Empty-state row until the RFQ lookup is wired: "No RFQ details yet — enter an RFQ Number and click Get Details."

## Technical

- Single file change: `src/routes/_authenticated/mm.znfa-release.tsx`.
- Reuse the existing `PR_DETAIL_COLUMNS` definition for both tables; add a `divider?: boolean` flag on the vendor entry and use it in the shared cell class logic.
- Extract the table markup into a small local component so PR Details and RFQ Details share one implementation (no duplicated JSX).
- No new colors or CSS — semantic tokens and existing `Card`/`Table` components only.
- No SAP calls, server functions, or business-logic changes in this step.
