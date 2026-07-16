
## Add "Gate Process" under MM Approvals

New sub-screen mirroring Price Approvals design, with a User ID field (auto-filled from the logged-in user) instead of Plant, and no Reports button.

### 1. Screen key
`src/lib/admin/screen-keys.ts` — add to the **Approvals** module:
```
{ key: "approvals.gate_process", label: "Gate Process", activity: "APPROVALS.GATE_PROCESS" }
```

### 2. Server functions — `src/lib/sd/gate-process.functions.ts` (new)
Two `createServerFn` handlers guarded by `requireSupabaseAuth`, patterned on `price-approval.functions.ts`:

- `fetchGateProcess` (POST, input: `{ user_id: string }`)
  - Reads `sap_api_configs` row where `name = 'Gate_Pass_Fetch_API'` (+ credentials, global proxy settings — identical logic to `fetchPriceApprovals`).
  - Payload sent: `{ "USER_ID": "<user_id>" }` (proxy: `{ inputs: { USER_ID: <id> } }`).
  - Response parsing: reads `DATA[]` (case-insensitive), returns rows with fields `check, pr_number, rfq_number, rfq_title, vendor_name, ter_sub_id` plus original raw fields so `buildDynamicColumns` can render them.
  - Same sync-log inserts and friendly error envelope `{ rows, count, fetched_at, user_id, error }` as price fetch.
- `getMySapUserId` — reuse the existing export from `price-approval.functions.ts` (import it directly; no duplication).

Decision endpoint (Accept/Reject) is deferred until the user provides the Gate Process decision SAP config — the Accept/Reject buttons in the table stay disabled with a tooltip note. (Ask if this is wrong; otherwise omit decision wiring.)

### 3. Route — `src/routes/_authenticated/mm.gate-process.tsx` (new)
Clone of `sd.price.tsx` with these changes:
- Route path `/_authenticated/mm/gate-process`, screen key `approvals.gate_process`.
- **Remove** the Plant `PlantMultiSelect` field, `activePlants` usage, and plants state.
- **Add** a User ID text `Input` (readonly, prefilled from `getMySapUserId`). Layout: single-column selection card `grid md:grid-cols-[240px_1fr_auto]`.
- **Remove** the Reports button and its `navigate` import usage.
- Execute button enabled when `userId.trim() !== ""`.
- Table via `CloudscapeApprovalTable` + `buildDynamicColumns(rows)` (no exclusions needed).
- Title: "Gate Process".
- Keep the same Card wrapper, spacing, loading spinner, empty state, and result dialog scaffolding (dialog only shown if/when a decision endpoint is added later; safe to omit for now).

### 4. Sidebar — `src/routes/_authenticated.tsx`
Add a second entry to `mmChildren`, immediately after MM Dashboard:
```
{ to: "/mm/gate-process", label: "Gate Process", icon: ClipboardCheck, screen: "approvals.gate_process" }
```
(Use an already-imported lucide icon; add `ClipboardCheck` to the import if needed.) No other logic changes — the existing collapsible MM group renders it automatically, permission-gated by `can("approvals.gate_process")`.

### Out of scope
- No changes to MM Dashboard, MM inbox, price approvals, or any existing route.
- No new migration; the `Gate_Pass_Fetch_API` config is expected to exist in `sap_api_configs` (managed in Admin → SAP API Settings, as the user described).
- No Accept/Reject SAP submission until the decision API name/payload is provided.
