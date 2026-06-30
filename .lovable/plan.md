# Plan: Map BMW Status Report Response Columns

Currently the BMW Status Report table renders raw SAP keys (`COMPANY_CODE`, `BP_SRV_VALID_FROM`, etc.) as column headers in arbitrary key order, with everything rendered as plain text. The attached spec defines the full schema with descriptions, data types, and logical groups (Business Partner vs Contract). The table should reflect that mapping.

## Changes

### 1. `src/routes/_authenticated/sd.bmw-status.tsx`

Add a static column schema derived from the PDF:

```text
COLUMN_SCHEMA = [
  { key, label, type: "text" | "date" | "decimal" | "currency" | "int", group: "core" | "bp" | "contract" }
]
```

Groups and labels (exact order from the spec):

- **Core**: Company Code, Sales Org, Customer, Customer Name, Distribution Channel, Division
- **Business Partner**: BP Customer Group, BP Price Group, BP Service Valid From/To, BP Service Start Date, BP Registration Date, BP Upper Slab Qty, BP No. of Beds to Invoice, BP Agreement Valid From/To, BP Active/Inactive, BP Fixed Rate, BP Per Bed Rate, BP Excess Qty Rate
- **Contract**: Contract No, Contract Item, Contract Create Date, Created By, Material Code, Net Value, Tax, Total, Con Customer Group, Con Price Group, Con Service Valid From/To, Con Service Start Date, Con Registration Date, Con Upper Slab Qty, Con No. of Beds to Invoice, Con Agreement Valid From/To, Con Active/Inactive, Con Fixed Rate, Con Per Bed Rate, Con Excess Qty Rate

Rendering rules per type:
- `date` — show `—` when value is empty/`0000-00-00`; otherwise format `YYYY-MM-DD` as locale date.
- `decimal` / `currency` — `parseFloat(trim)`, render `toFixed(decimals)` (3 for rates/slab, 2 for Net/Tax/Total) right-aligned with `tabular-nums`. Show `—` when NaN.
- `int` — parse integer, right-aligned. Show `—` when empty.
- `text` — trimmed string, `—` when empty.

Header row groups:
- Two-row `<thead>`: first row spans group titles (Core / Business Partner / Contract) with subtle background; second row holds the column labels.
- Sticky header preserved. Active/Inactive rendered as a small `Badge` (`01` → "Active" success, else "Inactive" muted).

Replace the dynamic `columns` state with the schema. Stop deriving columns from `res.columns`; keep `rows` typed as `BmwStatusRow` and look up by `schema.key`. Add a small `formatCell(value, type)` helper.

Keep existing layout, filters, Execute/Reset, empty state, and toast logic unchanged.

### Out of scope

- No server function changes — payload mapping already matches the spec.
- No styling system changes; only Tailwind classes and existing shadcn `Badge`.
- Other SD screens untouched.

## Technical notes

- Numeric SAP strings often have leading/trailing spaces (e.g. `"      0.000"`) — trim before `parseFloat`.
- `CONTRACT_ITEM` and `NET_VALUE`/`TAX`/`TOTAL` arrive as numbers, not strings; handle both via `String(v).trim()` before parsing.
- Unknown keys returned by SAP (future fields) are ignored by design since we map a fixed schema.
