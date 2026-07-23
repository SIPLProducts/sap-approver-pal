Update the ZNFA Rating screen to render the Attachments API response as a dedicated table with only Name, Created By, and Created On columns.

Changes to `src/lib/mm/gate-process.functions.ts`
1. Add an attachment type:
   - `ZnfaAttachment` with `NAME`, `CREATED_BY`, and `CREATED_ON`.
2. Extend `ZnfaOutput` with an optional `ATTACHMENTS?: ZnfaAttachment[]` array.
3. In `createZnfa` handler, after parsing the SAP response, detect the `ATTACHMENTS` action and read the response root (which arrives as an array of objects). Map each item to `ZnfaAttachment` and populate `output.ATTACHMENTS`. For non-attachment actions, keep the existing `ITEMS`/`RATINGS` parsing unchanged.

Changes to `src/routes/_authenticated/mm.gate-process.tsx`
1. Update `outputTitle` useMemo to return `"Attachments Result"` when `lastAction === "ATTACHMENTS"`.
2. In the output card:
   - When `lastAction === "ATTACHMENTS"`, render only the Attachments Result table with columns Name, Created By, Created On.
   - For all other actions (`RATE`, `CHANGE`, `DISPLAY`), keep the existing PR details grid, Items table (with editable Remarks), and Ratings table.
3. Clear/initialize `itemRemarks` and `lastAction` consistently in reset and mutation `onSuccess` callbacks.

Out of scope
- No changes to the ZNFA fetch, SAP payload, or action buttons.
- No changes to the middleware.
- No changes to other screens or table layouts.