## Goal
Send all selected plants in a single SAP call as an array of `{ plant }` objects, instead of fanning out one HTTP call per plant.

## Diagnosis
The middleware currently receives `{ PLANT: "3806", USER_ID: "..." }` (a scalar) per fan-out call. SAP actually expects:

```json
{ "PLANT": [{ "plant": "3801" }, { "plant": "3806" }], "USER_ID": "..." }
```

The middleware's request-field mapper already supports array-of-objects via the `PLANT[].plant` field convention (see `buildRequestPayload` / `splitArrayField` in `middleware/server.js`) — it pulls `inputs.PLANT` and maps each element's `plant` leaf into the SAP payload. So all that's needed app-side is to stop fanning out and send the array shape SAP wants.

## Changes

### 1. Server functions — accept `plants: string[]` and send array
For each of the four SD fetch server functions:
- `src/lib/sd/contract-approval.functions.ts` — `fetchContractApprovals`
- `src/lib/sd/sales-order-approval.functions.ts` — `fetchSalesOrderApprovals`
- `src/lib/sd/sc-so-approval.functions.ts` — `fetchScSoApprovals`
- `src/lib/sd/price-approval.functions.ts` — `fetchPriceApprovals`

Changes per function:
- Replace input validator field `plant: z.string()…` with `plants: z.array(z.string().trim().min(1)).min(1, "At least one plant required")`.
- Build `PLANT: data.plants.map((p) => ({ plant: p }))` in the proxy `inputs` payload.
- Non-proxy (direct SAP) branch: same array shape in the JSON body; for GET querystring fallback, encode the first plant only and log a console warning that the direct-SAP path doesn't support multi-plant (proxy is the supported path).
- Add `PLANT` to the rows where missing so the UI can display which plant each row came from.

### 2. Client — single call with array
For each of the four SD screens:
- `src/routes/_authenticated/sd.contract.tsx`
- `src/routes/_authenticated/sd.price.tsx`
- `src/routes/_authenticated/sd.sales-order.tsx`
- `src/routes/_authenticated/sd.sc-so.tsx`

Replace the per-plant `for` loop in each `mutationFn` with one call:

```ts
const v: any = await fetchFn({
  data: {
    plants: vars.plants,           // <- array
    user_id: vars.user_id,
    customer_from: vars.customer_from,
    customer_to: vars.customer_to,
    status: vars.status,
    // approval_type for sc-so
  },
});
return {
  rows: v?.rows ?? [],
  count: (v?.rows ?? []).length,
  error: v?.error ?? null,
  fetched_at: v?.fetched_at ?? new Date().toISOString(),
};
```

Keep "at least one plant" validation, the toast, and the rest of the UI unchanged.

## Non-goals
- No changes to the middleware (`middleware/server.js`) — its existing `PLANT[].plant` array mapping covers this.
- No DB migration. The `sap_api_request_fields` rows for each fetch config must already use the `PLANT[].plant` array convention; if any config still has a scalar `PLANT` field, the user updates it in Admin → SAP API (out of scope for this code change).
- No change to the approve/reject server functions.
- No change to `sd-approval-shell.tsx` filter or admin screens.

## Risk
If a particular fetch config's `sap_api_request_fields` still has a scalar `PLANT` row (instead of `PLANT[].plant`), middleware will throw "Missing required field(s): PLANT" again because it won't find a scalar `PLANT` in inputs. Fix is a one-row config edit per affected config — not a code change.
