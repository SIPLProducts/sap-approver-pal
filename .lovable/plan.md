## Goal
On Contract, Sales Order, and Service Cert & SO (SC-SO) approval screens, remove the "Customer To" filter and rename "Customer From" to "Customer".

## Changes

### Client routes (UI + state)
For each of:
- `src/routes/_authenticated/sd.contract.tsx`
- `src/routes/_authenticated/sd.sales-order.tsx`
- `src/routes/_authenticated/sd.sc-so.tsx`

Do:
- Remove the "Customer To" `Label` + `Input` block (around lines 349/378/411).
- Rename the "Customer From" label to "Customer".
- Drop the `customerTo` `useState` and any references.
- In the mutation payload, send `customer_from: customer.trim()` and `customer_to: customer.trim()` (mirror the same value), so the server-side range logic still works without UI change to the server.
- Rename the local state variable `customerFrom` → `customer` for clarity (optional but minor).

### Server functions
No changes required — they continue to accept `customer_from` / `customer_to` and already default `customer_to` to `customer_from` when missing. Keeping them untouched avoids touching the SAP request shape.

### Price screen
Out of scope — user did not list it.

## Non-goals
- No changes to `sd-approval-shell.tsx`, server functions, or middleware.
- No DB or admin changes.
