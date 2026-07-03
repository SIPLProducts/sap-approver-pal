
## Scope

Add a Customer F4 (value help) picker to the **Customer** input on the SD Approvals screens, driven by the SAP config named `Customer_Fetch_API` from Admin → SAP API Settings.

**In scope (3 screens):**
- `src/routes/_authenticated/sd.contract.tsx`
- `src/routes/_authenticated/sd.sales-order.tsx`
- `src/routes/_authenticated/sd.sc-so.tsx`

**Out of scope:** `sd.price.tsx` (explicitly excluded) and `sd.bmw-status.tsx` (it's a report, not an approval screen — happy to include if you want, just say so).

## What the user sees

The Customer field becomes a searchable combobox (same UX as `PlantSelect`): a text input with a small F4/lookup button on the right. Clicking it (or typing → Search) opens a popover listing customers returned by SAP with columns Customer Code + Name, filterable by keyword. Selecting a row fills the input with the customer code. Free typing is still allowed (so existing behavior of typing a code is preserved).

The picker calls `Customer_Fetch_API` (configured in SAP API Settings) via the existing `runSapApi` server function — same path already used by `PlantSelect` for `Get_Plant`. No new server function, no new secrets.

## Payload sent to Customer_Fetch_API

The plant(s) selected on the screen are sent as inputs so SAP can scope results:

```json
{ "PLANT": "<active plant>", "PLANTS": ["…"], "SEARCH": "<typed text>" }
```

The exact input field names depend on how the config's Request Fields are set up in Admin → SAP API Settings. The client sends the common variants above; unused ones are ignored by SAP. If the config expects different names, they can be adjusted in one place.

## Technical plan

1. **New helper server fn** `getCustomerConfig` in `src/lib/sap/customer.functions.ts` — mirrors `getPlantConfig`: looks up `sap_api_configs` by `name = 'Customer_Fetch_API'` and returns `{ configId, codeField, textField }` (defaults: `KUNNR`, `NAME1`). Returns `configId: null` if not configured/inactive so the UI can fall back to a plain input.

2. **New component** `src/components/sap/customer-select.tsx` — Popover + Command combobox modeled on `PlantSelect`:
   - Props: `value`, `onChange`, `plants?: string[]` (for payload scoping), `placeholder`, `disabled`.
   - Uses `useQuery` to call `runSapApi({ configId, inputs: { PLANT, PLANTS, SEARCH } })`.
   - Response parser tolerant of shapes (`DATA`, `data`, top-level array); reads code from `KUNNR`/`CUSTOMER`/`Customer` and text from `NAME1`/`NAME`/`CUSTOMER_NAME`.
   - If config missing → renders the existing plain `<Input>` (no regression).
   - Debounced re-fetch on search term (300 ms), keyed by `[configId, plants, search]`.

3. **Wire into 3 screens** — replace the current `<Input value={customerFrom} … />` in the SELECTION SCREEN with `<CustomerSelect value={customerFrom} onChange={setCustomerFrom} plants={plants} />`. No other logic changes: existing `customer_from` / `customer_to` payload wiring to fetch functions is untouched.

## Prerequisite (user action, one-time)

An admin must create/verify an SAP API config named exactly `Customer_Fetch_API` in Admin → SAP API Settings, pointing to the SAP customer-lookup endpoint, with Request Fields for whichever inputs SAP needs (PLANT/SEARCH). Until then the field silently falls back to a plain text input.

## Non-goals

- No changes to how `customer_from` / `customer_to` are sent to the existing fetch functions.
- No new columns, RLS, or migrations.
- Price screen and any non-SD screens are untouched.
