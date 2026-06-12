## Contract Approvals — add Customer From/To and scrollable table

### Selection screen
Add two new optional inputs alongside the existing Plant + USER_ID From/To fields:
- **Customer From** — text input, optional, mapped to SAP `CUSTOMER_FROM`
- **Customer To** — text input, optional, mapped to SAP `CUSTOMER_TO` (defaults to Customer From if only From provided)

Layout becomes a 6-column responsive grid: Plant*, USER_ID From*, USER_ID To*, Customer From, Customer To, then action buttons wrap to the next row. Status radio group stays as-is below.

### Output table — scrollable
Make the table area independently scrollable in both directions with a sticky header:
- Wrap the `<table>` in a container with fixed `max-h-[60vh]` and `overflow-auto` (both X and Y).
- Keep the existing sticky `<thead>` (already `sticky top-0`), add `bg-muted/50 z-10` so it stays solid over scrolled rows.
- Table card content uses the scroll container instead of the current `overflow-x-auto` only wrapper, so vertical scrolling stays inside the card (page no longer grows tall with many rows).

### Server function
`fetchContractApprovals` in `src/lib/sd/contract-approval.functions.ts`:
- Extend `inputValidator` with optional `customer_from` and `customer_to` (trimmed, max 40).
- Populate `inputs.CUSTOMER_FROM` / `inputs.CUSTOMER_TO` from the new fields (instead of hardcoded `""`).
- No other logic changes; proxy + direct paths already forward both fields.

### Out of scope
No changes to status radio behaviour, table columns, API config, or the `Contract_Approval_Fetch` request/response mapping.

### Files
- edit `src/routes/_authenticated/sd.contract.tsx`
- edit `src/lib/sd/contract-approval.functions.ts`
