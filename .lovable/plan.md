## MIGO Release — rename Save → Post, call MIGO_POST_API

### Behavior
- Rename the "Save" button on `src/routes/_authenticated/mm.migo-release.tsx` to **Post** and style it green (`bg-green-600 hover:bg-green-700 text-white`), same size/position (right-aligned above the Items table).
- On Post click, call a new server function `postMigo` that invokes the SAP API config **`MIGO_POST_API`** through the existing middleware/proxy path (same auth/proxy handling as `saveMigo`).
- Payload sent to SAP:
  ```json
  {
    "HEADER": { ...header fields..., "POST": "X" },
    "DATA": [ ...selected & edited rows... ]
  }
  ```
  - `HEADER` is the fetched header object as-is (DOC_DATE, PSTNG_DATE, DELIV_NOTE, VENDOR_NAME, HEADER_TEXT, etc.) merged with `POST: "X"`.
  - `DATA` contains only the checkbox-selected rows, each merged with its `edits` map entry (so STGE_LOC, STCK_TYPE, WARRANTY, OK edits flow through) — same selection/merge logic that Save currently uses.
- Response handling (exact SAP response shown, no field renaming):
  - Show a dialog "MIGO Post Result" with:
    - The `MESSAGE` string prominently (success TYPE=S green, error TYPE=E red).
    - A "View raw response" collapsible showing the full JSON (`TYPE`, `MAT_DOC`, `DOC_YEAR`, `MESSAGE`) — mirrors the PO Release response dialog pattern.
  - Toast: success on `TYPE=S`, error on `TYPE=E`, using `MESSAGE` verbatim.
  - On success, re-run Get Details (same as current Save success) and clear selection.

### Implementation notes (technical)
- Add `postMigo` in `src/lib/mm/migo-release.functions.ts`:
  - Duplicate `saveMigo` scaffolding but with `POST_CONFIG_NAME = "MIGO_POST_API"`.
  - Payload: `{ HEADER: { ...data.header, POST: "X" }, DATA: data.data }` (do NOT spread header at top level like `saveMigo` does; SAP payload requires nested `HEADER`).
  - Return `{ ok, type, message, mat_doc, doc_year, raw }` where `raw` is the parsed SAP JSON.
  - Log to `sap_api_sync_log` with tag `migo-post`.
- In `src/routes/_authenticated/mm.migo-release.tsx`:
  - Add `postFn = useServerFn(postMigo)` and `postMutation` (mirrors `saveMutation`).
  - Add `postResult` state and a Dialog to show it (reuse pattern from PO Release: message text + collapsible raw JSON).
  - Replace Save button label/handler with Post; keep the same disabled logic (`selected.size === 0 || postMutation.isPending`).
- Keep existing `saveMigo` server function intact (unused after this change but harmless) — or remove its button wiring only. No changes to fetch/check flow.

### Out of scope
- No changes to items table columns, header card, custom fields card, or STCK_TYPE dropdown.
- No changes to MIGO_Fetch_API or MIGO_Check_API logic.