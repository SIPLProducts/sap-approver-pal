# Transportation (90%) Exception Billing — Plant-based Customer F4 in results table

## Change
- The Customer column F4 in the results table will use the `90%_Plant_Base_Cust_F4` API instead of `90%_CUST_API`.
- Each row sends its own Plant: `{ "kunnr": [ { "plant": "<row WERKS>" } ] }`.
- The dropdown lists the returned KUNNR values, with the same F4 design (search, paging, loading/error states). Picking a value fills in that row's Customer.

## What stays the same
- The Customer Name column, Plant filter, New Record, Execute/Save/Change/Delete, payloads, response handling, and other screens. `90%_CUST_API` stays in place for any other use.

## Technical details
- Add `getTransportPlantCustConfig` in `src/lib/sap/customer.functions.ts`: looks up the active `90%_Plant_Base_Cust_F4` config (case-insensitive), following the same pattern as the existing lookups.
- In `imw.transportation-exception-billing.tsx`: query that config, and give the Customer cell's `CustomerSelect` `configId` from it and `inputs={{ kunnr: [{ plant: String(row.WERKS ?? "") }] }}`. The query cache is keyed per payload, so each plant is cached separately.
- Typecheck afterwards.
