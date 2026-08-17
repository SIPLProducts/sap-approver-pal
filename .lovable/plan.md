# Service Entry Sheet: exact column headers for Results table

## What changes

Only `src/routes/_authenticated/mm.service-entry-sheet.tsx` changes.

1. Add a constant `SES_HEADER_LABELS` mapping each API response key to the exact display name provided.
2. Pass `headerLabels: SES_HEADER_LABELS` to the existing `buildDynamicColumns` call that already drives the Results table.
3. Leave all other logic untouched: the Execute payload, loading state, message dialog, selection, scroll-to-results, and Release/Reject/Delete buttons stay exactly as they are today.

## Mapping to apply

```text
relCode       → Release Code
relGrp        → Release Group
purOrder      → Purchase Order Number
porg          → Purchasing Organization
pgrp          → Purchasing Group
supplier      → Supplier / Vendor Code
name          → Supplier / Vendor Name
currency      → Currency
poDate        → PO Date
poItem        → PO Item
plant         → Plant
finEntPo      → Final Entry Indicator (PO)
matGrp        → Material Group
shTextPo      → PO Short Text
netValuePo    → PO Net Value
delDate       → Delivery Date
entrySh       → Entry Sheet Number
accIn         → Acceptance Indicator
finEnt        → Final Entry Indicator
blkgInd       → Blocking Indicator
shText        → Entry Sheet Short Text
netValue      → Entry Sheet Net Value
crDate        → Created On
relStr        → Release Strategy
relIn         → Release / Acceptance Status
releaseOption → Release Option
```

## Technical notes

- `buildDynamicColumns` already creates one column per key present in the API `data` array and formats dates/amounts automatically. With `headerLabels`, it will use the exact labels above instead of prettifying the keys.
- Keys not present in a given API response will simply not appear, which is the existing behavior.
- No server-function, route, or payload changes are needed.

## Verification

- Run `tsgo` / typecheck to confirm the mapping object type matches `buildDynamicColumns` options.
- Inspect the Results table in the preview to confirm the new headers render.
