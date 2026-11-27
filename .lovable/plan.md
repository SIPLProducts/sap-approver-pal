# Vehicle Master – single Plant pick in the table

## What changes
In New Record mode, the Plant picker in each table row allows one plant only. Picking a plant replaces the previous one and closes the list. The "Select all" option is hidden there. Picking the selected plant again clears it.

The Plant field in the top card, and every other screen that uses the Plant picker, keep working as they do now.

## Technical details
- `src/components/sap/plant-multi-select.tsx`: add an optional `single?: boolean` prop, `false` by default. When it is true, `toggle(code)` calls `onChange(selected.has(code) ? [] : [code])` and `setOpen(false)`, and the "Select all" item is not rendered. Nothing changes when the prop is not set.
- `src/routes/_authenticated/imw.vehicle-master.tsx`: pass `single` to the table's Plant picker only.
