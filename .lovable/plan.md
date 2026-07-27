## MIGO Release screen

The previous turn only proposed the plan — no code was written yet, so no MIGO entry exists in the sidebar or routes. This plan builds it.

### Sidebar & route
- Add sidebar entry in `src/routes/_authenticated.tsx` under `mmChildren`, immediately after Gate Pass:
  `{ to: "/mm/migo-release", label: "MIGO Release", icon: <existing lucide icon>, screen: "approvals.inbox.mm" }`.
- New route file `src/routes/_authenticated/mm.migo-release.tsx` — cloned from `mm.material-reservation.tsx` layout (SELECTION SCREEN card, HEADER card, results table with row selection + HOD Approval / HOD Rejection / Remarks columns + Save button).

### Selection screen fields
Replace Material Reservation's inputs with:
- **Material Document Number** (text)
- **Material Document Year** (text, 4 digits)
- **User ID** (auto-filled from active SAP user, read-only, same pattern as ZNFA Rating / Gate Pass)

Buttons: Execute + Reset, same as Material Reservation.

### Data layer
New file `src/lib/mm/migo-release.functions.ts` with two server functions mirroring `material-reservation.functions.ts`:
- `fetchMigo({ matDocNo, matDocYear, userId })` → calls SAP config **`MIGO_FETCH_API`**.
- `saveMigo({ rows })` → calls SAP config **`MIGO_SAVE_API`**.

Payload/response shape: reuse Material Reservation's shape (SAP driver returns rows; unknown columns render dynamically via the existing dynamic-column helper). If SAP returns fewer/different columns, the table renders whatever comes back — same behaviour as Material Reservation today.

### Permissions
Gate the route under existing `approvals.inbox.mm` screen key (same as other MM screens). No new screen key, no migration.

### Out of scope
- No changes to Material Reservation, Gate Pass, or other MM screens.
- No new SAP API config rows — the admin must add `MIGO_FETCH_API` and `MIGO_SAVE_API` in Admin → SAP API Settings; the screen will show the standard "config not found" toast until they exist.

### Open question (please confirm before I build)
Are the SAP API config names **`MIGO_FETCH_API`** and **`MIGO_SAVE_API`**, or do you use different names? I'll use these defaults unless you say otherwise.