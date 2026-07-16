Mirror the SD pattern so a single "MM Approvals" (`approvals.inbox.mm`) permission unlocks every MM sub-screen, and remove the separate Gate Process entry from Screen Permissions.

### Changes

1. `src/routes/_authenticated.tsx` — in `mmChildren`, change the Gate Process entry's `screen` from `"approvals.gate_process"` to `"approvals.inbox.mm"`, so both MM Dashboard and Gate Process are gated by the same MM Approvals permission (same pattern as `sdChildren`, which all use `approvals.inbox.sd`).

2. `src/lib/admin/screen-keys.ts` — remove the `{ key: "approvals.gate_process", label: "Gate Process", activity: "APPROVALS.GATE_PROCESS" }` line from the Approvals module so it no longer shows up in the Screen Permissions / Custom Roles UI.

### Out of scope
- No route, layout, or business-logic changes.
- No server function changes (Gate Process server fn already has no per-screen assert).
- MM Dashboard gating remains unchanged.