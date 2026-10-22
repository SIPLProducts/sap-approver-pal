# Service Entry Sheet — scroll to results after Execute

## Finding
The screen already tries to scroll after Execute, but it does so in the next animation frame. On the first Execute the results table hasn't appeared yet at that moment, so the scroll target is missing and nothing happens.

## Change (only `src/routes/_authenticated/mm.service-entry-sheet.tsx`)
- Add a small `scrollToken` counter state. On a successful, non-silent Execute, increment it instead of calling `requestAnimationFrame`.
- Add a `useEffect` on `scrollToken` that calls `resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })` once the table is rendered.
- The scroll still skips silent refreshes after Release/Unrelease/Delete. Nothing else changes: no changes to the API, the table, or the layout.

## Verification
- Typecheck.
