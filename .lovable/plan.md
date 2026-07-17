## Add Gate Pass screen (MM Approvals)

Mirrors the Material Reservation screen exactly (layout, HEADER card, items table with checkbox column + Save button, hidden User ID auto-sent from the logged-in user).

### 1. New server function
`src/lib/mm/gate-pass.functions.ts`

- Modeled on `src/lib/mm/material-reservation.functions.ts`.
- SAP config name: `Gate_Pass_Approval_API` (new admin-managed row; the existing `Gate_Pass_Fetch_API` used by ZNFA Rating is left untouched).
- Proxy path: `/gate_pass_approval/Fetch` (fallback to `/sap/invoke` on 404, matching the existing pattern).
- Input schema (Zod):
  ```
  user_id: string (required, from logged-in user)
  gate_pass_number: string (optional)
  hod_approval: boolean (optional, sent as "X"/"")
  store_approval: boolean (optional, sent as "X"/"")
  scm_head: string (optional)
  plant_head: string (optional)
  return_receipt: string (optional)
  ```
- Payload sent to SAP (uppercase keys, same convention as Material Reservation):
  `{ USER_ID, GATE_PASS_NUMBER, HOD_APPROVAL, STORE_APPROVAL, SCM_HEAD, PLANT_HEAD, RETURN_RECEIPT }`.
- Response parsing: reads `HEADER[]` + `DATA[]` and returns `{ header, data, fetched_at, user_id, error }` — same shape as Material Reservation. Column keys are passed through generically so any SAP field names render.

### 2. New route
`src/routes/_authenticated/mm.gate-pass.tsx` at path `/mm/gate-pass`.

- Copy of `mm.material-reservation.tsx` with these differences:
  - Page title: "Gate Pass".
  - Selection screen fields (User ID hidden, auto-populated via `getMySapUserId` like Material Reservation):
    - Gate Pass Number — text input
    - HOD Approval — checkbox
    - Store Approval — checkbox
    - SCM Head — text input
    - Plant Head — text input
    - Return Receipt — text input
  - Grid template widened to fit the extra fields (responsive `md:grid-cols-2 lg:grid-cols-3` for inputs, with an Execute/Reset button row below).
  - Calls `fetchGatePass` from the new functions file.
  - HEADER card and items table (with first-column checkbox selection + right-aligned Save button between HEADER and table) reused verbatim. Column list is derived from the first data row's keys so it adapts to whatever SAP returns; no hard-coded item columns until the response shape is confirmed.
  - Row action columns (HOD Approval / HOD Rejection / Remarks) from Material Reservation are dropped for this screen — plan doesn't call for them. Save button remains but currently only toasts (same placeholder as Material Reservation) since no save endpoint was requested.

### 3. Sidebar entry
`src/routes/_authenticated.tsx` (line ~158 in the `mmChildren` array): add a new entry directly after `ZNFA Rating`:

```
{ to: "/mm/gate-pass", label: "Gate Pass", icon: <existing MM icon>, screen: "approvals.inbox.mm" },
```

Uses the existing `approvals.inbox.mm` screen permission so it shows for the same users as ZNFA Rating.

### Not changed
- No DB migrations, no changes to existing routes, no changes to `Gate_Pass_Fetch_API` / ZNFA Rating logic.
- Admin will need to create the `Gate_Pass_Approval_API` sap_api_configs row (endpoint URL, auth) before the screen returns live data — matches how every other SAP fetch screen is provisioned.

### Open assumption (flag)
Response shape is assumed to be `{ HEADER: [...], DATA: [...] }` like Material Reservation. If your Gate Pass SAP endpoint returns a different shape (e.g. flat `DATA[]` only, or different envelope), tell me and I'll adjust the parser and column rendering.
