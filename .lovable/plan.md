# ZNFA Release — Show RFQ key in Attachments List

## Goal
In the ZNFA Release screen, after a user clicks an NFA number and the document results load, the RFQ key value must appear in the Attachments List table under a new "Attachment ID" column header. Existing business logic, API calls, and other table behavior must stay unchanged.

## Changes

### UI: Add Attachment ID column in Attachments List
**File:** `src/routes/_authenticated/mm.znfa-release.tsx`

- Add a new column header **"Attachment ID"** in the Attachments List `TableHeader` (between the checkbox column and the existing "Vendor" column).
- Render the RFQ key value in each attachment row under that new header.
- The RFQ key value is already captured in the `rfqNumber` state from `res.rfqs[0]?.RFQ` inside `applyZnfaDocument` (line ~704). Re-use that state value so no new server logic or data mapping is required.
- Update the empty-state `colSpan` from `4` to `5` to account for the extra column.
- Leave all other columns (Vendor, Name, Attachments count), selection checkboxes, button handlers, and SAP response logic untouched.

## Acceptance
- When an NFA number is clicked and results load, every row in the Attachments List shows the same RFQ key value under the "Attachment ID" column.
- No changes to fetch payloads, response parsing, mutation handlers, print logic, or other tables.
