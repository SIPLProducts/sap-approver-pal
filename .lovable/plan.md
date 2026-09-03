# ZNFA Rating Save — show exact SAP MSG in popup

In the ZNFA Rating (Gate Process) screen, after the user clicks **Save**, show the exact `MSG` value returned by SAP in the existing `SapResponseDialog` popup.

## Verified cause

The Save API returns a success array like:

```json
[{"TYPE":"S","MSG":"TER Created Sucessfully.Please find TER No:TER2026/300084"}]
```

The UI already opens `SapResponseDialog` from `saveMutation.onSuccess`, but the server function `saveZnfa` currently reads the success message from the `MESSAGE` key only. Because SAP sends the text under `MSG`, the dialog falls back to the generic "Saved successfully" text.

## Change

### `src/lib/mm/gate-process.functions.ts`

In the `saveZnfa` handler, update the success-branch message extraction to prefer `MSG`, then `MESSAGE`:

```ts
message: (pick(first, "MSG") as string) || (pick(first, "MESSAGE") as string) || "Saved successfully",
```

This mirrors the existing failure branch, which already checks `MSG` first.

## Unchanged

- The SAP request payload and endpoint (`ZNFA_SAVE_API`).
- The Save UI flow, validation, state updates, and `TER_SUB_ID` header refresh.
- The `SapResponseDialog` component and SweetAlert styling.
- Failure handling (`res.ok === false`), which already surfaces the exact `MSG`.
