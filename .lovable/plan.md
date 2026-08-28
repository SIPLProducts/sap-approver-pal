# ZNFA Release — Show exact ATTACH response values in Attachments List

## Goal
After Release, Display, or Approve List loads a document, the Attachments List table shows the `ATTACH` array exactly as SAP returned it, with this field mapping:

| Response field | Column |
|---|---|
| CHECK | Check (checkbox) |
| VENDOR | Vendor |
| NAME1 | Name |
| ATTACHMENT_ID | Attachment ID |
| NO_ATTACHMENTS | Attachments |

No derivation, trimming, or substitution of values.

## Changes — `src/routes/_authenticated/mm.znfa-release.tsx` only

### 1. Attachments List table (~lines 2218–2244)
- Attachment ID cell: render the row's own `a.ATTACHMENT_ID` value instead of the `rfqNumber` state (currently the RFQ key is shown for every row).
- Vendor / Name / Attachments cells: render `a.VENDOR`, `a.NAME1`, `a.NO_ATTACHMENTS` exactly as received — remove the `.trim()` so the raw response value is shown verbatim (empty value still falls back to "—").
- Headers, checkbox column, single-select behavior, and empty state unchanged.

### 2. Display payload (`onDisplayAttachments`, ~lines 1346–1383)
- Build the `ZNFA_ATTACH_API` payload from the selected row's own fields: `VENDOR`, `NAME1`, `ATTACHMENT_ID`, `NO_ATTACHMENTS` — using the row's `ATTACHMENT_ID` instead of `rfqNumber`, so the payload matches what is displayed in the table.
- Keep the existing missing-value guard popup and the `CHECK: "X"` flag sent by the server function.

## Not changed
- Server functions (`znfa-click`, `znfa-display`, `znfa-attach`) — `ATTACH` is already passed through as `res.attach` untouched.
- Attachment Details table, document preview, and all other ZNFA logic.

## Acceptance
- Each Attachments List row shows the exact `VENDOR`, `NAME1`, `ATTACHMENT_ID`, `NO_ATTACHMENTS` values from the response (e.g. `4008330`, `Arun Transport`, `6100078885`, `2` and the `NFA/SCM/2026/2500000018` row).
- Clicking Display sends the same values shown in the row.
