# ZNFA Rating Attachments table update

## Goal
Update the ZNFA Rating / Gate Process screen so that the **Attachments** action displays the new SAP response fields exactly as provided, without changing any other code or logic.

## Current behavior
The attachment table expects fields named `NAME`, `CREATED_BY`, and `CREATED_ON`. The actual API response now returns objects with `OBJDES`, `OWNNAM`, and `CRDAT`.

## Required change
In the attachments result table only:

| SAP key     | UI label              | Format / mapping                          |
|-------------|-----------------------|-------------------------------------------|
| `OBJDES`    | Object Description    | exact value                               |
| `OWNNAM`    | Created By            | exact value                               |
| `CRDAT`     | Created Date          | from SAP `YYYY-MM-DD` to `DD-MM-YYYY`     |

## Implementation plan

1. **Update types** in `src/lib/mm/gate-process.functions.ts`
   - Replace `ZnfaAttachment` shape (or add alongside) to use `OBJDES`, `OWNNAM`, `CRDAT`.
   - Update the attachments mapping inside `createZnfa` to read `OBJDES`, `OWNNAM`, and `CRDAT` case-insensitively using the existing `pick()` helper.

2. **Format the date**
   - When mapping `CRDAT`, parse the `YYYY-MM-DD` value and render as `DD-MM-YYYY`.
   - Keep the mapping pure; store the formatted string in the `CRDAT` field.

3. **Update UI** in `src/routes/_authenticated/mm.gate-process.tsx`
   - In the `ATTACHMENTS` output branch, change the `<TableHead>` labels to:
     - Object Description
     - Created By
     - Created Date
   - Change the table cells to render `att.OBJDES`, `att.OWNNAM`, and the pre-formatted date value.

4. **Verification**
   - Run `bun run build:dev`.
   - Run existing tests if any touch `gate-process.functions.ts`.

## Scope / constraints
- Only the Attachments table is affected.
- No changes to fetch, rating, change, display, save, row selection, or payload logic.
- No changes to SAP API config names, middleware handling, or other screens.