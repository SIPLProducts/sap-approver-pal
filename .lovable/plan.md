## Issues

1. After a successful Approve, `decisionMutation.onSuccess` calls `setStatus(vars.action)` which flips the tab to **Accepted**. That tab is empty (rows just moved to local `decided` state) — the page looks blank / "another page". That's what reads as "going to another page / 404".
2. The SAP response (e.g. `{ MESSAGE: [{ CUSTOMER, TYPE, MESSAGE }] }`) is currently only shown as a generic `toast.success("1 record accepted in SAP")` — the actual per-customer messages from SAP are dropped.

## Fix (frontend only, `src/routes/_authenticated/sd.price.tsx`)

### 1. Install SweetAlert2
`bun add sweetalert2`

### 2. Show SAP messages in a SweetAlert popup
In `decisionMutation.onSuccess`, read `res.sap_response.MESSAGE` (always treat as array, may be empty/missing). Build an HTML table of `CUSTOMER · TYPE · MESSAGE`. Pick icon by message types:
- all `TYPE === "S"` → `success`
- any `TYPE === "E"` / `"A"` → `error`
- any `TYPE === "W"` → `warning`
- otherwise → `info`

Title: `"Approved"` or `"Rejected"`. Fallback when SAP returns no MESSAGE array: show the generic success line.

### 3. Stop the unwanted tab switch
Remove `setStatus(vars.action)` from `onSuccess`. User stays on the Pending tab; processed rows are already removed from `selected` and shown with the green/red badge via the existing `decided` map. They can manually click Accepted/Rejected tab if they want.

### 4. Re-fetch fresh data (optional but matches user flow)
After the alert closes, optionally re-run `mutation.mutate(plant)` so the Pending list reflects what SAP now sees. Default: do not auto-refetch; just close the popup. (Can add a "Refresh" button on the alert if you want.)

## Out of scope
No backend, server-function, or middleware changes. The server function already returns `sap_response` verbatim — we just surface it in the UI.
