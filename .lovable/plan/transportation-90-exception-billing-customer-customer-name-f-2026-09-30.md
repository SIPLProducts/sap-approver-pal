# Transportation (90%) Exception Billing — Customer & Customer Name F4 APIs

Wire the two F4 dropdowns on the Transportation (90%) Exception Billing screen to the configured SAP services, reusing the existing F4 design. No changes to any other screen, API, or logic.

## Customer F4 — `90%_CUST_API`

- New server function `getTransportCustConfig` (in `src/lib/sap/customer.functions.ts`, same pattern as `getCustomerConfig`): looks up the active SAP API config named `90%_CUST_API` (case-insensitive) and returns its config id.
- The Customer dropdown fetches with payload `{ "kunnr": "" }` and lists every returned `KUNNR` value as an option.

## Customer Name F4 — `90%_CUSTNAME_API`

- New server function `getTransportCustNameConfig` (same file/pattern): looks up the active config named `90%_CUSTNAME_API` and returns its config id.
- The Customer Name field becomes the same F4 dropdown design, fetching with payload `{ "name1": "" }` and listing every returned `NAME1` value as an option.

## Implementation

- `CustomerSelect` (`src/components/sap/customer-select.tsx`) gets an optional `configId` / `payload` override prop so the same dropdown design (search, paging, loading/error states) can be driven by a different configured API and payload; default behavior (Customer_Fetch_API) is untouched.
- `src/routes/_authenticated/imw.transportation-exception-billing.tsx`:
  - Customer field: `CustomerSelect` with the `90%_CUST_API` config and `{ kunnr: "" }` payload; options keyed on `KUNNR`.
  - Customer Name field: `CustomerSelect` with the `90%_CUSTNAME_API` config and `{ name1: "" }` payload; options keyed on `NAME1` (replaces the plain text input).
- Execute/Reset behavior, layout, styling, and the empty results shell stay exactly as they are.

## What stays the same

No changes to any existing screen, the shared `Customer_Fetch_API` behavior, payloads of other modules, permissions, navigation, or design tokens.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Preview pass: both dropdowns open with the existing F4 design and list values from the two APIs; other IMW/MM/SD screens unchanged.
