# Vehicle Master – editable table cells by New Record mode

## What changes
Only the cells of the Vehicle Master result table. Execute, the input card, the buttons and the SAP calls stay as they are.

**New Record ticked (last Execute ran with New Record):**
- Plant: same Plant picker as the top card (same IWM plant list, search and selection). The picked plant fills that row's Plant cell. Only one plant per row.
- Vehicle Number, Material Qty - RTO-CAPACITY (in Tons), Material Net Weight * 90%, Vehicle Tonnage, Vehicle Type, Transport Name: editable text boxes.

**New Record unticked:**
- Plant and Vehicle Number: plain read-only text, as today.
- The other five columns: editable text boxes.

Edits stay in the table rows, ready for the Save / Change / Delete integrations later.

## Technical details
File: `src/routes/_authenticated/imw.vehicle-master.tsx` only.
- Add `updateRow(row, field, value)` in the `columns` memo, matching Distance Master, keyed on the existing row key.
- Mode is decided by `executedCheck === "X"`, as on Distance Master.
- Plant cell in New Record mode: `<PlantMultiSelect source="iwm-plant" value={[row.WERKS]} onChange={(v) => updateRow(row, "WERKS", v[v.length - 1] ?? "")} />`, reusing the top card's component so the API, search and selection are the same.
- Editable cells use `<Input className="h-8 min-w-[120px] text-xs" />`, the Distance Master style. Numeric columns get `inputMode="decimal"`.
- Column ids, headers and min widths stay unchanged. The memo dependency becomes `[executedCheck]`. Import `Input` from `@/components/ui/input`.
