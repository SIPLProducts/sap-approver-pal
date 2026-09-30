# Fix doubled values in Transportation (90%) Exception Billing dropdowns

The Customer and Customer Name dropdowns show each value twice in one row (e.g. "1000 - 1000") because both F4 APIs return a single field (KUNNR / NAME1), and that same field is used as both the code and the text, so the option renders as `code — text` with identical values.

## Fix

In `src/components/sap/customer-select.tsx` (presentation only, no API or behavior change):

- In the option row rendering, when `text` is empty or identical to `code`, render only the code (skip the `— text` suffix).
- In `triggerLabel`, when the selected option's `text` equals its `code`, show just the code instead of `code - code`.
- `extractCustomerOptions` already de-duplicates by code, so no data change is needed; this only stops rendering the same value twice.

## What stays the same

- Both F4 APIs (`90%_CUST_API` with `{ "kunnr": "" }`, `90%_CUSTNAME_API` with `{ "name1": "" }`), payloads, dropdown design, search, pagination, and all other screens using CustomerSelect are unchanged — when code and text genuinely differ (e.g. "1000 — Acme Corp"), both still display as before.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Preview: open both dropdowns on `/imw/transportation-exception-billing` and confirm each value appears once per row.
