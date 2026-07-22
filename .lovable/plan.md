## Changes to `src/routes/_authenticated/mm.gate-process.tsx`

1. **Editable Remarks in Items table**
   - Track item remarks in local state keyed by item index (e.g. `itemRemarks: Record<number, string>`), initialized whenever a new `output` is set from the ZNFA response.
   - Replace the read-only `Remarks` `<TableCell>` with an `<Input>` bound to that state (same styling as Material Reservation's editable cells: `h-8 text-xs`).
   - Reset the remarks state on Reset and on every new fetch/action.

2. **Indicate which button triggers `ZNFA_Create_API`**
   - The Rating button is the one that calls `ZNFA_Create_API` (action `"RATE"`). Add a small helper caption under/next to the action-button row (e.g. muted text "Rating triggers ZNFA_Create_API") and a tooltip/`title` attribute on the Rating button so it's clearly identified in the UI.

3. **Auto-scroll to output on success**
   - Add a `outputRef = useRef<HTMLDivElement>(null)` and attach it to the OUTPUT `<Card>` wrapper.
   - In `createMutation.onSuccess`, after `setOutput(res.output)`, if `res.output` is non-null, call `outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })` inside a `requestAnimationFrame` (so the node exists after render).

## Out of scope
- No server function, payload, or middleware changes. Remarks stay UI-only for now (no send-back API was specified).
- No other buttons or screens touched.
