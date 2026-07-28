## Change

In `src/routes/_authenticated/mm.migo-release.tsx`:

1. Remove the three appended columns: **HOD Approval**, **HOD Rejection**, and **Remarks**.
2. In the auto-generated data columns, detect keys `WARRANTY` and `OK` (case-insensitive) and render them as checkboxes instead of text. The checkbox reflects whether the SAP value equals `"X"` and toggles the in-memory row value between `"X"` and `""`.
3. Remove the now-unused `rowStates` / `RowState` / `updateRow` logic and the `skip` set that hid these columns from the auto-generated list.
4. Update the Save payload builder to send each selected row as-is (including the toggled `WARRANTY` / `OK` values), dropping the HOD/Remarks overrides.

No changes to `src/lib/mm/migo-release.functions.ts`, the middleware, or the fetch/save server functions — Save still posts through `saveMigo` with the same header + data shape, only the per-row fields differ.

### Technical notes

- Track edits in a `Map<string, Record<string, any>>` keyed by `rowKey`, seeded from the fetched rows. Cell renderers read/write into this map so table re-renders don't lose toggles.
- Column detection: treat any column whose key uppercased is `WARRANTY` or `OK` as a checkbox column; keep its original header text.
- Selection, header card, Execute/Reset, and Save button behavior stay unchanged.