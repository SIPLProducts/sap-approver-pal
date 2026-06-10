## Goal
On the SAP API config edit page (`/admin/sap-api/:id`), let admins upload a sample JSON payload (or paste it) for **Request** and **Response** tabs, then auto-generate field mapping rows from the detected keys.

## UX

In both the **Request** and **Response** tab headers, add two controls next to "Add row" / "Save":
- **Upload payload** — file picker accepting `.json` / `.txt`
- **Paste & autodetect** — opens a dialog with a JSON textarea + "Detect fields" button

After parsing, show a preview list of detected field paths with checkboxes (all on by default) and a **Merge mode** select:
- `Replace existing rows` (default)
- `Append new fields only` (skip names already present)

Confirm → populates the table. User still has to click **Save** to persist (no silent writes).

## Autodetect logic (client-only, in `src/lib/admin/payload-detect.ts`)

Accepts a parsed JSON value. Flattens to dot/bracket paths:
- Objects → recurse with `parent.child`
- Arrays → take the first element, recurse with `parent[].child`; if array of primitives, treat as leaf
- Leaves → record `{ path, sampleValue, inferredType }` where type ∈ `string | number | boolean | date | null`
  - `date` if string matches ISO 8601 / `YYYY-MM-DD`
- Caps: max 500 fields, max recursion depth 8, payload size ≤ 1 MB → show error toast otherwise

Mapping to rows:
- **Request row**: `field_name = path`, `source = "static"`, `default_value = String(sampleValue ?? "")`, `required = false`
- **Response row**: `field_name = path`, `target_table = ""`, `target_column = path.split(/[.\[]/).pop()` (snake_cased), `transform_expr = ""`

## Files to change
- New: `src/lib/admin/payload-detect.ts` — `flattenPayload()`, `toReqRows()`, `toResRows()` + small unit-test friendly pure functions.
- New: `src/components/admin/payload-import-dialog.tsx` — reusable dialog (`mode: "request" | "response"`, `onApply(rows, mergeMode)`); contains upload input, textarea, detect preview, merge select.
- Edit: `src/routes/_authenticated/admin.sap-api.$id.tsx` — add dialog triggers in Request and Response tab toolbars; wire `onApply` to merge into `reqRows` / `resRows` state. No server-side or schema changes.

## Out of scope
- No backend changes, no new tables, no schema migration.
- XML/CSV payloads (JSON only for v1).
- Auto-saving after detect — user reviews + clicks Save.
