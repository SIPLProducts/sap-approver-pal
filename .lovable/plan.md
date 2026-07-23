## Goal
Add a **Save** button between the ZNFA Rating table card and the Result card. Clicking Save calls `ZNFA_SAVE_API` (from SAP API Settings) with the current header/items/ratings state and shows a success/error toast based on the response.

## Scope
- `src/lib/mm/gate-process.functions.ts` — add `saveZnfa` server function.
- `src/routes/_authenticated/mm.gate-process.tsx` — add Save button + wire mutation.

No middleware, RLS, or DB changes. Prereq: an entry named `ZNFA_SAVE_API` exists in Admin → SAP API Settings (same pattern as `ZNFA_Create_API`).

## Changes

### 1. `saveZnfa` server function (mirrors `createZnfa`)
- Reads config by name `ZNFA_SAVE_API`; proxy/basic resolution identical to `createZnfa`.
- Input (from client state after Rate/Change):
  - `user_id`, `pr_number`, `pr_date`, `ter_sub_id`
  - `action`: `"RATE" | "CHANGE"` (drives RATE/CHANGE flags in payload)
  - `items[]`: `{ SR_NO, MATERIAL, DESCRIPTION, TENDER_SPEC, UOM, VENDOR_NAME, REMARKS }`
  - `ratings[]`: `{ VENDOR, RATE }`
- Outgoing payload sent (via proxy `raw:true` or direct POST JSON):
  ```json
  {
    "PR_NUMBER": "...", "PR_DATE": "...", "TER_SUB_ID": "...",
    "USER_ID": "...",
    "RATE": "X" | "", "CHANGE": "X" | "", "SAVE": "X",
    "ITEMS": [...], "RATINGS": [...]
  }
  ```
- Response parsing (case-insensitive `pick`):
  - Success object `{ TYPE:"S", TER_SUB_ID, MESSAGE }` → return `{ ok:true, ter_sub_id, message }`.
  - Failure array `[{ TYPE:"E", MSG }]` (or object form) → return `{ ok:false, error: MSG }`.
- Writes to `sap_api_sync_log` like `createZnfa`.

### 2. UI changes in `mm.gate-process.tsx`
- Add `saveMutation` using `useServerFn(saveZnfa)`.
- Render a right-aligned Save button in a small flex row placed **after** the `CloudscapeApprovalTable` and **before** the `{output && ...}` result Card:
  ```
  <div className="flex justify-end">
    <Button ... onClick={handleSave} disabled={...}>Save</Button>
  </div>
  ```
- Visible only when `isEditable` (i.e., `lastAction === "RATE" | "CHANGE"`) and `output` is present — Save has no meaning in Display/Attachments or before any action.
- `handleSave` builds payload from current `header`, `items`, `ratings` state maps + `userId` + `lastAction`.
- On success: `toast.success(message)`, update `header.TER_SUB_ID` with returned `TER_SUB_ID`.
- On failure/error: `toast.error(error)`.
- Loading state on the button (`Loader2` spinner) while mutation pending.

## Out of scope
- No changes to Rating/Change/Display/Attachments buttons or payload.
- No validation beyond "user_id present".
- No middleware config edits (assumes `ZNFA_SAVE_API` row exists like other ZNFA configs).

## Verification
- Typecheck passes.
- After Execute → select row → click Rating: Save button appears on the right between the two cards.
- Click Save: toast shows either "Tender Rating Saved Successfully" (and TER SUB ID updates) or the SAP error message.
- Display / Attachments modes: Save button is hidden.