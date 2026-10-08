# Price Master Update Approvals — add user_name to Execute payload

## Goal

When Execute is clicked on the Price Master Update Approvals screen, the `get_data` payload sent to `PMUA_FETCH_API` must include `user_name` as the first key, filled automatically with the signed-in person's SAP user ID:

```text
{ "get_data": { "user_name": "<login user id>", "plant": [ { "plant": "..." } ],
  "kunnr": [], "date_from": "", "date_to": "", "R_pen": "X", "R_appr": "", "r_rej": "" } }
```

## Change (one file)

`src/lib/imw/price-master-approvals.functions.ts` — in `fetchPriceMasterApprovals`:

1. Resolve the signed-in SAP user ID the same way the ZGP/ZMC cancel functions do: read the SAP user ID from the authenticated user's SAP profile, with the existing authenticated-user metadata fallback. If no SAP user ID can be resolved, return a clear sign-in/profile error instead of sending a blank value.
2. Build `get_data` with `user_name` as the first key, followed by the existing keys in their current order (`plant`, `kunnr`, `date_from`, `date_to`, `R_pen`, `R_appr`, `r_rej`) with values exactly as today.
3. Update the payload comment block at the top of the file to show `user_name`.

## What stays the same

- Screen UI, filters, status radio mapping, table, Approve/Reject flow, popup handling, permissions, and the proxy/direct forwarding logic are untouched.
- No changes to `approvePriceMasterApprovals` or `rejectPriceMasterApprovals` payloads.
- No screen-file changes needed — the user ID is resolved server-side from the session, not passed from the client.

## Verification

- `bunx tsgo --noEmit -p tsconfig.json` passes.
- Confirm the outgoing payload shape includes `user_name` first in both proxy and direct modes (same `inputs` object is used for both).
