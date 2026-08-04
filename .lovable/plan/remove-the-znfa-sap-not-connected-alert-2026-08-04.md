# Remove the ZNFA SAP "not connected" alert

## What to do
Remove the persistent informational `Alert` block rendered at the top of the ZNFA Release screen (`src/routes/_authenticated/mm.znfa-release.tsx`). The alert text is "SAP service not connected yet" and is currently shown unconditionally on the screen, which the user wants gone.

## Why
This alert is no longer needed now that the ZNFA APIs are configured and the screen is in active use. Removing it keeps the UI clean.

## How
1. Locate the `<Alert>` block in `src/routes/_authenticated/mm.znfa-release.tsx` containing the "SAP service not connected yet" title and description.
2. Delete the entire block.
3. Remove any now-unused imports (e.g., `Alert`, `AlertTitle`, `AlertDescription`, `Info` icon) if they are no longer used elsewhere in the file.
4. Run a quick typecheck and lint check to ensure the change is clean.

## Acceptance criteria
- The ZNFA Release screen no longer displays the "SAP service not connected yet" alert.
- No build or type errors are introduced.
