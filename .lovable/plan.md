# ZNFA Release — Release Code F4 from NFA_KEYS

The Release Code dropdown on the ZNFA Release screen already reads the login response, but it lists bare release codes only and ignores REL_GROUP, so two identical codes under different groups collapse into one entry.

## What changes

- The Release Code dropdown lists one entry per NFA_KEYS pair from the Login_API response, filtered to the plants selected in the top bar for the logged-in user.
- Each option shows the release group and code together (e.g. `NF / 01`), with a blank group shown as `(blank)`.
- Selecting an option keeps both the group and the code, so the group travels with the selection for the later Next step.
- Options are sorted by group, then code, and duplicates across plants are removed.
- If the user has no NFA keys for the selected plants, the dropdown stays disabled with "No keys assigned".
- Changing the top-bar plant selection clears a selection that is no longer offered.
- Release Id stays read-only and auto-filled with the logged-in SAP user id; the Next button behaviour and every other card are untouched.

## Technical notes

- Edit only `src/routes/_authenticated/mm.znfa-release.tsx`.
- Keep `releaseKeysFor(assignedPlants, "nfa", activePlants)` as the source; replace the `releaseCodes: string[]` memo with a keyed list of `{ relGroup, releaseCode }` and store the selection as a composite value (`group\u0000code`) mapped back to two state values (`releaseGroup`, `releaseCode`).
- Reuse existing `Select` primitives; no new component, no backend or business-logic change. Reset logic clears both group and code.
