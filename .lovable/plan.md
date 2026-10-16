# New Record checkbox on Transportation (90%) Exception Billing

## What changes

1. **New Record checkbox** — a checkbox labelled "New Record" sits next to the Plant field in the selection card, using the app's existing checkbox styling.

2. **Execute payload** — the `get_data` payload gains a `check` key:
   - Checkbox selected → `"check": "X"`
   - Checkbox not selected → `"check": ""`

```text
before
[Plant ▼ ............]        [Execute] [Reset]

after
[New Record ☐] [Plant ▼ ...]  [Execute] [Reset]
```

3. **Save button visibility** — Save appears at the top-right of the results table (its current spot, before Change and Delete) only when the last Execute was sent with `"check": "X"`. When `check` is empty, Save is not rendered at all — Change and Delete keep their existing colors, enabling rule (row selection required), and behavior.

4. Everything else is unchanged: the response is rendered by the same code path either way (same table, same eight columns, row checkboxes, editable Customer / Customer Name / Check Value / Remarks), and Save's existing `90%_Save_API` behavior is untouched.

## Behaviour notes

- Toggling the checkbox after Execute does not change the already-loaded table; the flag takes effect on the next Execute, and Save's visibility follows the flag used for the currently displayed results.
- Save still requires at least one ticked row and stays disabled during save/change, exactly as today.

## Technical details

- `src/routes/_authenticated/imw.transportation-exception-billing.tsx` only:
  - Add `const [newRecord, setNewRecord] = useState(false);`.
  - In the filter card grid, render a labelled checkbox (Label + `Checkbox` in a small flex row) before the Plant field; keep the grid alignment and Execute/Reset position.
  - In `fetchMutation.mutationFn`, add `check: newRecord ? "X" : ""` inside `get_data`.
  - Track the flag used for the results being shown (e.g. store it in state when Execute runs, or derive Save visibility from `newRecord && executed`) and conditionally render the Save `<Button>` inside `headerExtras`.
- No shared-component, API, or other screen changes.
- Verify with `bunx tsgo --noEmit -p tsconfig.json` and the preview build log, then visually confirm the checkbox, payload flag, and Save visibility in the preview.
