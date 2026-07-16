# Material Reservation Screen (MM Approvals)

Add a new screen visually identical to **Price Approvals**, placed in the sidebar right after **MM Dashboard**, under the MM Approvals group.

## Selection screen fields

- **Document Number** — free-text input
- **HOD Approve** — checkbox
- **User ID** — auto-filled from the logged-in user's SAP user id (read-only, same behavior as Gate Process / Price Approvals)
- No Plant field

Buttons: Execute, Reset (same styling as Price Approvals — no Reports button for now).

## Results

Renders a `CloudscapeApprovalTable` with dynamic columns built from the SAP `DATA[]` rows via `buildDynamicColumns` (same helper Price/Gate Process use). Row selection enabled; Accept / Reject wiring can be added later once SAP provides a decision endpoint — initial screen is fetch-only, matching Gate Process.

## Files

**New — `src/routes/_authenticated/mm.material-reservation.tsx`**
- Route id `/_authenticated/mm/material-reservation`.
- Component cloned from `src/routes/_authenticated/mm.gate-process.tsx` (closest existing pattern with auto-filled User ID and no plant), with:
  - Title: `Material Reservation`.
  - State: `docNumber` (string), `hodApprove` (boolean), `userId` (auto-filled, read-only).
  - Execute passes `{ user_id, doc_number, hod_approve }` to the server fn.
  - Reset clears doc number, unchecks HOD, restores user id.

**New — `src/lib/mm/material-reservation.functions.ts`**
- `createServerFn` + `requireSupabaseAuth`, modeled on `src/lib/mm/gate-process.functions.ts`.
- Zod input: `user_id: string`, `doc_number: string` (optional/required — required), `hod_approve: boolean`.
- Looks up `sap_api_configs` row named **`Material_Reservation_Fetch_API`** (user configures this in Admin → SAP API; endpoint + method + auth managed there — same as Gate Process).
- Sends `USER_ID`, `DOC_NUMBER`, `HOD_APPROVE` (as `"X"`/`""` — SAP boolean convention) as inputs; proxy path posts to `${middlewareUrl}/material_reservation/Fetch` with `inputs: { USER_ID, DOC_NUMBER, HOD_APPROVE }`; direct path appends them as query params. Same fallback to `/sap/invoke` on middleware 404.
- Returns `{ rows, count, fetched_at, error }` where rows are raw untyped objects (so `buildDynamicColumns` renders every returned field, matching Gate Process behavior).

**Edit — `src/routes/_authenticated.tsx`** (line 155-158)
- Insert `{ to: "/mm/material-reservation", label: "Material Reservation", icon: <a lucide icon, e.g. Package>, screen: "approvals.inbox.mm" }` between the MM Dashboard and Gate Process entries.

## Permissions

Reuses the existing `approvals.inbox.mm` screen key — no new activity or admin change needed. Anyone who already sees MM Dashboard sees Material Reservation.

## Follow-up you'll need to do once

In **Admin → SAP API Settings**, create a config named `Material_Reservation_Fetch_API` (endpoint URL, method, auth) — the screen will show a clear "config not found" error until then, matching how Gate Process behaves.
