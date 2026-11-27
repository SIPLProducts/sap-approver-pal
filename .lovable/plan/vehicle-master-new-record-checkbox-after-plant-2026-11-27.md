# Vehicle Master: New Record checkbox after Plant

Add a "New Record" checkbox to the Vehicle Master selection card, right after the Plant field, copied from Distance Master.

## What changes
- A "New Record" checkbox appears between Plant and the Execute/Reset buttons, same look and spacing as Distance Master.
- Ticking/unticking it is remembered on the screen; Reset unticks it.
- Execute keeps its current behaviour (SAP not connected yet), so nothing else changes.

## Technical details
File: `src/routes/_authenticated/imw.vehicle-master.tsx` only.
- Import `Checkbox` from `@/components/ui/checkbox`.
- Add `const [newRecord, setNewRecord] = useState(false);`.
- `reset()` also calls `setNewRecord(false)`.
- Grid class `lg:grid-cols-[220px_1fr]` → `lg:grid-cols-[220px_auto_1fr]`.
- Insert the checkbox block (`id="vm-new-record"`, `flex items-center gap-2 pb-1.5`, label `text-xs` "New Record") after the Plant block.
- The value will be sent as `check: "X"` / `" "` once the Vehicle Master Get API is integrated.
