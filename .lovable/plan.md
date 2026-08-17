# Plant F4 on Service Entry Sheet (PO Data)

Give the Plant row in the PO Data card the same searchable plant picker used on PR Release and PO Release, limited to the plants assigned to the logged-in user.

## Behaviour

- The Plant "from" field becomes the shared plant dropdown (search + code/description list), instead of a plain text box.
- The list comes from the same source as PR/PO Release (`GET_USER_PLANT`) and is filtered to the plants selected in the top bar / assigned to the user.
- The Plant "to" field stays a plain input so ranges still work.
- If the plant API config is missing, the dropdown falls back to a plain input automatically (existing behaviour of the shared component).
- Reset still clears it; every other field, card, and the Execute flow stay exactly as they are.

## Technical notes

- Edit only `src/routes/_authenticated/mm.service-entry-sheet.tsx`.
- Add an optional `component?: "plant"` flag on the `RangeField` type and set it on the `WERKS` entry in `PO_FIELDS`.
- In `RangeRows`, when `f.component === "plant"`, render `<PlantSelect value={...} onChange={...} source="user-plant" />` for the "from" cell; otherwise keep the current `Input`.
- No changes to server functions, styles, other screens, or the database.
