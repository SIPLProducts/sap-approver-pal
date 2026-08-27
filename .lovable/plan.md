In the ZNFA Rating (Gate Process) screen, change the Save response so the exact message returned by SAP is shown in the existing `SapResponseDialog` popup instead of a toast.

What will change
- Update `saveMutation.onSuccess` in `src/routes/_authenticated/mm.gate-process.tsx`.
  - When `res.ok` is true: open `SapResponseDialog` with the API success message (`res.message`) and keep the existing header update (`TER_SUB_ID`).
  - When `res.ok` is false: the dialog already opens with `res.error`, which is already the exact `MSG` / `MESSAGE` value from SAP — no logic change needed there.

What will NOT change
- The SAP payload sent by `saveZnfa` in `src/lib/mm/gate-process.functions.ts`.
- The validation, state updates, or any other business logic in the screen.
- The existing `SapResponseDialog` component itself.
