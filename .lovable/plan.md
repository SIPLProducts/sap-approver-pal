Move the Rating, Change, Display, and Attachments action buttons from below the ZNFA Rating table into the table's header toolbar, to the right of the search bar in a single row. Assign each button a distinct theme-appropriate color for better visibility and a clean UI.

## Files to change

- `src/routes/_authenticated/mm.gate-process.tsx`

## Implementation

- Pass the action buttons into the `CloudscapeApprovalTable` component via its existing `headerExtras` prop, which already renders content to the right of the search bar in the table header row.
- Keep the existing action definitions and loading/disabled states.
- Remove the now-redundant action button row rendered below the table.
- Style each button with a distinct, theme-appropriate solid color (e.g., Rating: primary/brand red; Change: blue; Display: amber; Attachments: green) while keeping size `sm` and white text.

## No other changes

- No server functions, API payloads, or middleware changes.
- No changes to the table component itself unless its `headerExtras` layout proves insufficient.