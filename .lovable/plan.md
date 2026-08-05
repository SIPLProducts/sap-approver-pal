# ZNFA Release — document toolbar + Attachments CB checkbox

Two presentation-only changes in `src/routes/_authenticated/mm.znfa-release.tsx`.

## 1. Thin toolbar above the opened NFA document

Shown only when a document is open (the same condition that renders the detail cards), directly above the APPROVAL / RELEASE MATRIX card.

```text
+---------------------------------------------------------------------------+
| NFA 4100000123 |  Approve  Reject  Back  Clarification  Display Clar.  Preview |
+---------------------------------------------------------------------------+
```

- One compact bar (small buttons with labels + lucide icons), horizontally scrollable on mobile.
- **Back** — returns to the results list: clears the loaded document (`docLoaded`, `clickedNfaNo`, `displayError`) and resets the detail form, keeping the Release/Approved List result table intact. On the Display path, Back returns to the Main NFA Number card.
- **Approve / Reject** — open the existing `ConfirmDialog` first. No SAP release/reject API is configured for ZNFA yet, so after confirming they show an info toast stating the action will be sent once the SAP API is wired. Ready to swap in the real call later.
- **Clarification / Display Clarification / Preview** — info toast placeholders in the same style.

## 2. Attachments List — CB column as a checkbox

The `CB` cell currently renders empty. Render a `Checkbox` per attachment row with local per-row selected state (row index / attachment id), and a header checkbox is not added — only per-row selection, as asked. Selection is UI state only.

## Technical notes

- Single file: `src/routes/_authenticated/mm.znfa-release.tsx`; no API or business-logic changes.
- Reuse `Button`, `Checkbox`, `ConfirmDialog`, `toast`, and existing card chrome; no new colors.
