# Service Entry Sheet: clear defaults + Plant F4 on the "To" field

## Behaviour changes

1. **No pre-selected defaults**
   - Release card: "Set Release" is no longer ticked on load; both Set Release and Cancel Release start unchecked (they stay mutually exclusive when the user picks one).
   - Blocking Indicator: no radio selected on load (previously "Not Blocked").
   - Acceptance Indicator: no radio selected on load (previously "Not Accepted").
   - Reset returns to these same empty states instead of the old defaults.

2. **Plant "To" field gets the same dropdown as "From"**
   - The Plant row's "To" field becomes the searchable plant picker limited to the plants assigned to the logged-in user (same `GET_USER_PLANT` source already used by the "From" field, PR Release, and PO Release).
   - Falls back to a plain input automatically if the plant API config is missing.

Everything else — cards, fields, Scope of List `ENTRY_REL`, Execute validation and messages — stays as-is.

## Technical notes

- Edit only `src/routes/_authenticated/mm.service-entry-sheet.tsx`.
- Initial state: `setRelease`/`cancelRelease` -> `false`, `blocking`/`acceptance` -> `""`; mirror the same values in `reset()`.
- In `RangeRows`, render `PlantSelect` (with `source="user-plant"`) for the "to" cell as well when `f.component === "plant"`, otherwise keep the current `Input`.
- No changes to server functions, styles, other screens, or the database.
