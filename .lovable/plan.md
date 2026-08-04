# ZNFA Release — auto-tick Scope Category from the API response

When an NFA document loads (NFA No click via `ZNFA_Click_API`, and the Display step, which returns the same shape), the Scope Category checkboxes reflect the SAP flags: ticked when the field is `"X"`, unticked otherwise, and the whole group becomes read-only while a document is loaded.

## Field mapping

| Checkbox label | SAP field in `ZNFA` |
| --- | --- |
| Supply | `SUPPLY` |
| Installation | `INSTALLATION` |
| Construction works including all supplies | `CONSTRUCTION_S` |
| Construction with FIM (Free issue Material) | `CONSTRUCTION_R` |
| Supervision | `SUPERVISION` |
| Commissioning | `COMMISION` |
| Service | `SERVICES` |
| ARC | `ARC` |

Matching is case-insensitive and trimmed, so `"X"`, `"x"`, or `" X "` all count as checked; anything else (blank, `null`, missing) is unchecked.

## Behaviour

- On a successful document load, every checkbox is set from its mapped field — no stale ticks carry over from a previously viewed NFA.
- While a document is loaded, all Scope Category checkboxes are disabled (visually greyed, not clickable) since the values come from SAP.
- Clearing the screen (changing action / plant / Release Code, or the existing reset) clears the ticks and re-enables the group.

## Technical notes

- Single file: `src/routes/_authenticated/mm.znfa-release.tsx`.
- Add a `sapField` to each entry in `SCOPE_CATEGORIES`.
- In the shared `applyZnfaDocument(res)` helper, build the checked list from the `ZNFA` object and call `setScopeCategories(...)`, so both the click and Display paths behave identically.
- Pass `disabled={docLoaded}` to the `Checkbox` elements and mute the labels in that state.
- No server-function, schema, or payload changes.
