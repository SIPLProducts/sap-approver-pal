## Goal

Fix the runtime error and ensure clicking **Execute** on the Service Certificate & SO Approvals screen always calls the single SAP API config **`Sevice_Certificate_Fetch`** (regardless of whether Approval Type is Service Certificate or Sales Order). Add console logging of the URL, request payload, and response.

## Changes

### `src/lib/sd/sc-so-approval.functions.ts`

1. Remove the per-approval-type config switch. Always use:
   ```ts
   const CONFIG_NAME = "Sevice_Certificate_Fetch";
   ```
   The `service` / `Sales` flags in the payload tell SAP which approval type to return — the same endpoint handles both.

2. Use a single proxy slug (`service_certificate/Fetch`) for both types.

3. Add server-side `console.log` entries (visible in server-function logs):
   - `[scso-fetch] target=… method=… proxied=…`
   - `[scso-fetch] payload=…` (the `inputs` object)
   - `[scso-fetch] status=… latency_ms=… body=…` (first 1000 chars)

4. Return a `debug` object on the response (target, method, proxied, request_payload, response_status, response_body_preview, latency_ms) so the client can log it too.

### `src/routes/_authenticated/sd.sc-so.tsx`

In the mutation's `onSuccess` / `onError`, add a grouped `console.log` mirroring the sales-order screen:
```
[SAP] Sevice_Certificate_Fetch · <status> (<latency>ms)
  URL, Method, proxied
  Request payload
  Response status
  Response body preview
```

## Out of scope

- No UI changes (selection screen, radios, table columns stay as-is).
- No new Accept/Reject submission flow.
- Admin SAP API config screen is unchanged — the user still needs one row named `Sevice_Certificate_Fetch` (note spelling) in Admin → SAP API.
