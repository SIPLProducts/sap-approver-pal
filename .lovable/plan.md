## Goal
On the ZNFA Rating screen, when the user clicks **Rate** or **Change**, make the header fields (PR Number, PR Date, TER SUB ID) and every column in the **Items** and **Ratings** tables editable inputs. In **Display** mode, everything stays read-only. Attachments mode is unchanged.

## Scope
Single file: `src/routes/_authenticated/mm.gate-process.tsx`. No changes to server functions, payload shape, or middleware — this is a UI-only edit as requested.

## Changes

1. **Editable-mode flag**
   - Derive `isEditable = lastAction === "RATE" || lastAction === "CHANGE"`.

2. **Editable state**
   - Extend the existing `itemRemarks` pattern into per-field state maps, seeded from the API response in `createMutation.onSuccess` and cleared in `reset()`:
     - `header`: `{ PR_NUMBER, PR_DATE, TER_SUB_ID }`
     - `items`: `Record<number, { SR_NO, MATERIAL, DESCRIPTION, TENDER_SPEC, UOM, VENDOR_NAME, REMARKS }>` (replaces `itemRemarks`)
     - `ratings`: `Record<number, { VENDOR, RATE }>`
   - Re-seed on every successful response so switching Rate ↔ Change ↔ Display resets values to the latest server data.

3. **Rendering**
   - Header fields: render `<Input>` with `readOnly={!isEditable}` and keep the `bg-muted/40` styling when read-only; normal input styling when editable.
   - Items table: replace each `<TableCell>{toStr(item.X)}</TableCell>` with either a plain text cell (Display) or an `<Input className="h-8 text-xs">` bound to `items[idx].X` (Rate/Change). Remarks stays an input in all three modes to preserve current behavior.
   - Ratings table: same treatment for `VENDOR` and `RATE`.

4. **Behavior preserved**
   - No change to the payload sent to `ZNFA_Create_API` (edits are local UI state only, matching how Remarks works today).
   - Attachments result table unchanged.
   - Auto-scroll, dynamic title, and toolbar buttons unchanged.

## Out of scope
- Sending the edited header/items/ratings back to SAP (not requested).
- Field validation.

## Verification
- Typecheck.
- Click **Rating** → header + all Items/Ratings cells become inputs.
- Click **Change** → same editable behavior.
- Click **Display** → header and all cells render as read-only text (only the card is visible; no inputs except the existing read-only header inputs styled muted).
- Click **Attachments** → unchanged.
