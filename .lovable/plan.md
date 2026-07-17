## Changes

### 1. Material Reservation — hide User ID field
File: `src/routes/_authenticated/mm.material-reservation.tsx`

- Remove the User ID `<Label>` + `<Input>` from the SELECTION SCREEN grid (keep the state and effect that populate `userId` from `getMySapUserId`).
- Adjust the grid template to drop the removed column (e.g. `md:grid-cols-[200px_180px_1fr_auto]`).
- Leave `execute()` unchanged: it still sends `user_id: userId.trim()` in the payload, so the logged-in user's SAP ID is sent automatically.
- No changes to the server function or business logic.

### 2. Rename "Gate Process" → "ZNFA Rating" (UI label only)
Only user-visible strings are changed; route paths, file names, backend config name (`Gate_Pass_Fetch_API`), and middleware endpoints remain untouched to avoid breaking existing links and integrations.

- `src/routes/_authenticated.tsx` (line 158): change sidebar `label: "Gate Process"` → `"ZNFA Rating"`.
- `src/routes/_authenticated/mm.gate-process.tsx`:
  - Page `<h1>` "Gate Process" → "ZNFA Rating".
  - `CloudscapeApprovalTable` `title="Gate Process"` → `"ZNFA Rating"`.
  - Empty message "…gate-process records from SAP." → "…ZNFA Rating records from SAP."

No other files touched.
