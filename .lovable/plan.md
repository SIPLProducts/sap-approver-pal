# ZNFA Release — Award & Attachments Card

Add one new card below the **Final Recommendation** card on the ZNFA Release screen (visible only in Creation → Create mode), matching the reference SAP layout using existing app styling.

## Layout

```text
+-------------------------------------------------------------------------+
| AWARD & ATTACHMENTS                                                     |
|-------------------------------------------------------------------------|
| Proposed to award:  [ input line 1                    ]                 |
|                     [ input line 2 (wider)            ]                 |
|-------------------------------------------------------------------------|
| NFA Texts (table)        | Remarks (textarea)   | Budget                |
|  cols: NFA Texts | T&C   |                      |  Approved Budget [ ]  |
|  (empty state row)       |                      |  Balance  Budget [ ]  |
|                          |                      |-----------------------|
|                          |                      | Attachments  [Display]|
|                          |                      | CB | Vendor | Name    |
|                          |                      | (empty state row)     |
+-------------------------------------------------------------------------+
```

Responsive: single column on mobile, 3-column grid (`lg:grid-cols-3`) on desktop — NFA Texts left, Remarks middle, Budget + Attachments right.

## Fields and behaviour

- **Proposed to award** — two text inputs (short + long), local state, UI only.
- **NFA Texts** — table with columns `NFA Texts` and `T&C`, empty-state message consistent with the other detail tables on this screen.
- **Remarks** — textarea (separate from the existing Scope of Work remarks; own state).
- **Budget** — `Approved Budget` and `Balance Budget` numeric inputs, read-only styling matching Buyer Details (filled once SAP data arrives).
- **Attachments List** — table with `CB` (checkbox column), `Vendor`, `Name`; a `Display` button in the card header that shows an info toast until the SAP attachment API is wired.
- All values reset with the existing `resetCreateForm()`.

## Technical notes

- Single file change: `src/routes/_authenticated/mm.znfa-release.tsx`.
- Reuse the existing `Card` / `Label` / `Input` / `Textarea` / `Table` / `Button` / `Checkbox` primitives and the same card chrome (`border border-border/60 p-5 shadow-card`, uppercase muted section heading with a lucide icon).
- No backend, API, or business-logic changes; presentation only.
