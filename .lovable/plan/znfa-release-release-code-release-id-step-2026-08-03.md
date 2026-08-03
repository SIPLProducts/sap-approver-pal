# ZNFA Release — Release Code / Release Id step

When the user picks **Release** or **Approved List** in the ZNFA Release screen, show an intermediate card (styled like the existing selection cards) before any further content.

## Card contents

- **Release Code** — dropdown fed by the NFA release keys from the login response for the plants selected in the top bar (same source pattern already used for PR/PO Release). If no keys are assigned, the dropdown shows "No keys assigned".
- **Release Id** — read-only input, auto-filled with the logged-in user's SAP user id from the stored profile.
- **Next** button — enabled only when a Release Code is chosen. On click it confirms the selection and reveals the following step; since the ZNFA SAP APIs are not configured yet, it shows the existing "not connected yet" style info message rather than fetching data.

## Behaviour

- Card appears for Release mode as well as the Creation-mode Release / Approved List actions.
- Switching mode or picking a different action resets the card (code cleared, Next state cleared), consistent with the current reset logic.
- Create / Change behaviour and the existing cards stay exactly as they are.

## Technical notes

- Edit only `src/routes/_authenticated/mm.znfa-release.tsx`.
- Use `useActiveContext()` + `releaseKeysFor(plants, "nfa", plantCodes)` for the code list, and `useSapProfile()?.user` for the Release Id.
- Reuse `Card`, `Label`, `Select`, `Input`, `Button` primitives; no new components or backend changes.
