## Changes in `src/routes/_authenticated/mm.migo-release.tsx`

1. **Line ID first column**: When building `dataKeys` for the columns memo, hoist any key whose uppercased name is `LINE_ID` (fallback: `LINEID`) to the front of the array before mapping to `CloudscapeColumn`s. Preserve original ordering of all other keys.

2. **STGE_LOC as editable input**: Add a helper `isEditableTextKey(k)` that returns true when the uppercased key is `STGE_LOC` (also accept `STGELOC` / `LGORT` if present). In the column mapping, when a key matches, render a small `<Input>` (h-8 text-xs) whose value comes from `edits.get(k)?.[key] ?? item[key]` and whose `onChange` calls the existing `updateCell(k, key, value)`. Checkbox handling for `WARRANTY`/`OK` stays as-is; plain-text rendering stays as fallback.

Save payload already merges `edits` into each selected row, so the edited STGE_LOC value flows to `saveMigo` unchanged. No changes to server functions, middleware, or the shared table component.
