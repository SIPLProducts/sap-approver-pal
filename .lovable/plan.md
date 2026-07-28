Goal: Update the MIGO Release selection screen so the current "Execute" button is renamed to "Get Details", placed immediately after the "Material Document Year" field, and a new "Check" button is added right after it.

Scope: Frontend-only change in the MIGO Release route; no server-function or API changes.

Changes to make:

1. Open `src/routes/_authenticated/mm.migo-release.tsx`.
2. In the selection-screen grid:
   - Change the existing "Execute" button label to "Get Details".
   - Keep the existing click behavior (`execute()`) intact on "Get Details".
   - Add a new "Check" button immediately after "Get Details".
   - Re-arrange the grid so the two buttons sit directly after the "Material Document Year" input, and the "Reset" button remains in the same row.
3. Since no backend action is specified for "Check", wire it to a placeholder handler that shows an informational toast (e.g., "Check action is not yet configured") so the button is clickable but does not break the flow.
4. Preserve responsive styling: keep the same Tailwind input/button classes and ensure the row still wraps cleanly on smaller screens.

Verification:
- Load the MIGO Release page in the preview.
- Confirm the button after "Material Document Year" reads "Get Details" and still fetches data.
- Confirm a "Check" button appears directly after "Get Details".
- Confirm the "Reset" button remains present and functional.

No changes to data fetching, save logic, table rendering, or other screens.