## Goal

When the user clicks Approve or Reject on the **Sales Order Approvals** screen, the SAP response dialog (swal-style) must clearly display the four fields from each SAP `MESSAGE[]` entry: **TYPE**, **MSG**, **CUSTOMER**, **CONTRACT**.

The dialog already opens and renders cards — this change makes the four fields explicit and labelled so multi-message responses (like the sample with two contracts) are readable at a glance.

## Change

**File:** `src/routes/_authenticated/sd.sales-order.tsx` (only the `ResultDialog` card body, ~lines 647–663)

Update each message card to render a small labelled grid showing:

- **TYPE** — the raw SAP code (`@01@`, `S`, `E`, …) plus the existing colored severity pill (Success / Error / Warning / Info derived via `mapSeverity`)
- **CUSTOMER** — `m.CUSTOMER` (trimmed; leading zeros preserved as SAP returns)
- **CONTRACT** — `m.CONTRACT` (falls back to `m.SALES_DOCUMENT_NO` if CONTRACT is missing, so older responses still render)
- **MSG** — `m.MSG` (falls back to `m.MESSAGE`) shown on its own line as the primary text

Header banner (Approved / Rejected / Completed with errors / warnings) and the summary count stay as-is. No business-logic, server-function, or backend changes.

### Card layout (per message)

```text
┌──────────────────────────────────────────────────────────┐
│  Sales Order Released Successfully-1000500123    [Success]│
│                                                           │
│  TYPE     @01@                                            │
│  CUSTOMER 0001060033                                      │
│  CONTRACT 1000500123                                      │
└──────────────────────────────────────────────────────────┘
```

With the sample two-message payload, two such cards stack vertically inside the existing scrollable list.

## Out of scope

- Contract Approvals and Price Approvals screens — already match the target design; not touching them.
- Middleware / server function / response parsing — extraction logic already handles the sample payload correctly.