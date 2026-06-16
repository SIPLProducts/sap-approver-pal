## Goal

When you click Accept/Reject on the Contract Approvals screen, the SAP `Contract_Approve_Reject` URL, payload, and response must be observable in:
1. The browser **Network** tab and DevTools **Console**.
2. The Node.js middleware **console**.

Also, the typed **User ID** must flow into the SAP payload (same fix already applied to Price approvals).

## Current state (verified)

- `submitContractDecision` already targets `Contract_Approve_Reject` via the SAP-Config-driven middleware proxy.
- The middleware (`middleware/server.js`) already logs `[raw-invoke] METHOD URL payload=...` and `status=... body=...` on every SAP call.
- Server fn logs `[submitContractDecision] target=… payload=…` and `status=… body=…`, but those only appear in the Node.js server console — never in the browser.
- The browser Network tab only sees the opaque `/_serverFn/…` RPC request — SAP URL/payload/response are stripped from view today.
- `USER_ID` is **not** sent in the Contract decision SAP payload (only `APPROV / REJ / DATA`).

## Plan

### 1. `src/lib/sd/contract-approval.functions.ts` — `submitContractDecision`

- Extend `inputValidator` to accept `user_id?: string` (trim, max 40).
- Resolve `USER_ID` server-side with the same precedence used in Price: `data.user_id` → `profile.sap_user_id` → `sap_api_request_fields.default_value` for `USER_ID` on `Contract_Approve_Reject` → `"NEOBMWCONS"`.
- Add `USER_ID: resolvedUserId` at the top of `sapPayload` (alongside `APPROV`, `REJ`, `DATA`).
- Return debug telemetry in the server-fn response so it's visible in the browser:
  ```ts
  return {
    ok, action, count, sap_response: json,
    debug: { target, method, request_payload: sapPayload, response_status, response_body_preview }
  }
  ```
  (Truncate `response_body_preview` to ~2 KB. This is dev-mode observability for the user's stated need; safe because the same payload is already in the SAP sync log.)

### 2. `src/routes/_authenticated/sd.contract.tsx`

- Pass `user_id: userId.trim()` through `decisionMutation` vars and `decide()`.
- In `decisionMutation.onSuccess` and `onError`, `console.group('[SAP] Contract_Approve_Reject')` and log `debug.target`, `debug.request_payload`, `debug.response_status`, `debug.response_body_preview`. This puts the SAP URL/payload/response in the **browser console** on every click.

### 3. Network-tab visibility

The server function call already shows up as `POST /_serverFn/…`. Its **response body** will now include the `debug` block from step 1 — open that response in DevTools → Network → Response to see SAP URL, payload, status, and body inline. No new endpoint needed.

### 4. Node.js middleware console

Already logs URL + payload + response (`[raw-invoke]` lines in `middleware/server.js`). Confirm the middleware service has been restarted with the latest `server.js`; no code change needed.

## Technical notes

- No DB / migration changes.
- No UI redesign — only Accept/Reject button wiring plus console logging.
- `debug` payload is bounded (≤ 2 KB preview) to avoid leaking large SAP dumps over the RPC channel.
- If you prefer the `debug` block hidden from production, we can gate it on `process.env.NODE_ENV !== 'production'`. Tell me if you want that.
