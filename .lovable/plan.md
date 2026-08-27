# ZNFA Release — Correct attachment-display payload mapping

## Goal
Ensure that clicking Display in the Attachments List sends the actual row values shown in the UI for `VENDOR`, `NAME1`, `ATTACHMENT_ID`, and `NO_ATTACHMENTS`, with `ATTACHMENT_ID` taken from the Attachment ID column value.

## Changes

### UI payload mapping
**File:** `src/routes/_authenticated/mm.znfa-release.tsx`

In `onDisplayAttachments` (around lines 1345–1364), after resolving the selected `attachRows` row, build the `attachDetailMutation.mutate` variables using the displayed column values:

- `CHECK` → `"X"` (selected checkbox).
- `VENDOR` → `String(row.VENDOR ?? "").trim()`
- `NAME1` → `String(row.NAME1 ?? "").trim()`
- `ATTACHMENT_ID` → the value shown in the **Attachment ID** column (`rfqNumber`), not `row.ATTACHMENT_ID`, which may be empty.
- `NO_ATTACHMENTS` → `String(row.NO_ATTACHMENTS ?? "").trim()`

Add a lightweight guard: if any of `VENDOR`, `NAME1`, `ATTACHMENT_ID`, or `NO_ATTACHMENTS` is empty after trimming, show the existing `SapResponseDialog` popup with a message asking to check the attachment row instead of calling the API with empty values.

No other attachment logic, table rendering, selection behavior, server functions, or preview code changes.

## Acceptance
- When a row is selected and Display is clicked, the `ZNFA_ATTACH_API` payload contains the actual displayed vendor, name, attachment ID, and attachments count for that row.
- Empty/incorrect values are never sent; if a required value is missing, a popup is shown and the API call is skipped.
