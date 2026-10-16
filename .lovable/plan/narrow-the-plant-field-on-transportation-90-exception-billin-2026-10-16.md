# Narrow the Plant field on Transportation (90%) Exception Billing

## What changes

On the Transportation (90%) Exception Billing screen, the Plant box in the "SELECTION SCREEN" card currently stretches across almost the entire card width. It will be given a fixed, compact width of 220 px — the same width the Plant field already uses on the Price Master screens — so the filter card looks balanced and matches the rest of IWM.

The Execute and Reset buttons stay exactly where they are, at the right-hand end of the card. Nothing else on the screen moves: no change to the results table, its columns, the row checkboxes, the Save/Change/Delete buttons, or any API call.

## Visual result

```text
Before
[ Plant ................................................ ] [ Execute ] [ Reset ]

After
[ Plant (220px) ][ ........ space ........ ][ Execute ] [ Reset ]
```

## Technical details

- Single file touched: `src/routes/_authenticated/imw.transportation-exception-billing.tsx`.
- One class change on the filter grid (currently line 266):
  - from: `grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_auto]`
  - to: `grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[220px_1fr_auto]`
- The `1fr` spacer column keeps Execute/Reset pinned to the right edge, so button placement is unchanged.
- No change to `PlantMultiSelect` itself, so the Plant search, multi-select, IWM_PLANTS_F4 lookup, and payload `{ get_data: { plant: [{ plant }] } }` are untouched.
- Verify with `bunx tsgo --noEmit -p tsconfig.json` and a preview screenshot of the filter card.
