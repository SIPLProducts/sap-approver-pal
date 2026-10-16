# Plan: Put Plant first, New Record next on Transportation (90%) Exception Billing

## What changes

In the filter card ("SELECTION SCREEN") of the Transportation (90%) Exception Billing screen, swap the order of the two fields so the row reads:

```text
Before:  [New Record]  [Plant        ]            [Execute] [Reset]
After:   [Plant        ]  [New Record]            [Execute] [Reset]
```

- Plant keeps its current width (220 px) and its F4 multi-select behaviour.
- New Record keeps its checkbox + label design and its tick/un-tick behaviour.
- Execute and Reset stay at the right-hand end of the card.

## What does not change

- No change to the Execute payload — `"check"` is still `"X"` when New Record is ticked and `""` when it is not.
- No change to the API call, the results table, its columns, row checkboxes, or the Save / Change / Delete buttons.
- No change to Reset, which still clears both Plant and New Record.

## Technical details

Single file: `src/routes/_authenticated/imw.transportation-exception-billing.tsx` (filter card, lines ~359-382).

1. Move the New Record `<div>` block (currently lines 360-369) to after the Plant `<div>` block (currently lines 370-373).
2. Update the grid template on the wrapper from `lg:grid-cols-[auto_220px_auto]` to `lg:grid-cols-[220px_auto_1fr]`, so column 1 is the fixed-width Plant field, column 2 the New Record checkbox sitting right beside it, and column 3 the remaining space holding the buttons. The buttons div keeps `justify-self-end`, so Execute/Reset stay flush right.

Verification: `bunx tsgo --noEmit -p tsconfig.json`, then confirm in the preview that Plant appears leftmost at 220 px, New Record sits next to it, and Execute/Reset remain at the right edge.
