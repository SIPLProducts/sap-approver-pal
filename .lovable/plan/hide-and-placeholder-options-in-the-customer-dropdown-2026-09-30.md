# Hide "--" and "+" placeholder options in the Customer dropdown

The `90%_CUST_API` response includes placeholder rows like `--` and `+`, which currently appear at the top of the Customer dropdown on the Transportation (90%) Exception Billing screen.

## Fix

In `src/components/sap/customer-select.tsx`, inside `extractCustomerOptions` (shared option parser):

- Skip any row whose extracted code contains no letters or digits (i.e. codes made only of symbols/punctuation such as `--`, `+`, `*`). A simple check like `/[a-z0-9]/i.test(code)` gates inclusion.
- Apply the same guard to string/number rows.

This is data filtering only — no API, payload, design, or behavior change. Real customer codes (alphanumeric) are unaffected, and other screens using CustomerSelect keep working since SAP codes are always alphanumeric.

## What stays the same

- Both F4 APIs, payloads, dropdown design, search, pagination, and selection behavior are unchanged.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Preview: open the Customer dropdown on `/imw/transportation-exception-billing` and confirm `--` and `+` no longer appear; only real customer values list.
