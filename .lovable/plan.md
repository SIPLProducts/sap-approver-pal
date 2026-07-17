## Plan: Point ZNFA Rating screen at ZNFA_Fetch_API

Single change in `src/lib/mm/gate-process.functions.ts`:

- Change the `CONFIG_NAME` constant from `"Gate_Pass_Fetch_API"` to `"ZNFA_Fetch_API"` so `fetchGateProcess` looks up and calls the `ZNFA_Fetch_API` row from `sap_api_configs`.

Everything else stays as-is:
- Same Zod input (`user_id`), same payload shape (`{ inputs: { USER_ID } }` in proxy mode, `?USER_ID=...` in direct mode).
- Same response parsing (`DATA[]` → `GateRow[]` with CHECK / PR_NUMBER / RFQ_NUMBER / RFQ_TITLE / VENDOR_NAME / TER_SUB_ID).
- Same proxy fallback (`/gate_pass/Fetch` → `/sap/invoke` on 404), sync-log writes, and error handling.
- No changes to the route file, UI, sidebar, or any other server function.

Admin must have a `ZNFA_Fetch_API` row configured in Admin → SAP API for the call to succeed.
