# ZNFA Release — Approved List table tweaks

## 1. Hide the Release column in Approved List

In `src/routes/_authenticated/mm.znfa-release.tsx`, the Release / Approved List results table currently renders the constant `RELEASE_RESULT_COLUMNS` for both actions. Replace that constant usage with a derived column list based on the current `action`:

- When `action === "Approved List"`, omit the `RELEASE` column.
- For the "Release" action, keep the existing columns unchanged (Release column visible, Accept/Reject plain text).

## 2. Render Accept/Reject values as status icons in Approved List

In the same derived column list, mark the `ACCEP_REJECT` column with the existing `statusIcon: true` flag **only** for Approved List. The table body already uses `SapStatusIcon` when `statusIcon` is set, so `@01@`, `@02@`, and `@5D@` will render as the existing green tick, red cross, and amber alert icons. Unknown values still fall back to plain text.

## Technical notes

- No data fetch, payload, API config, or server function changes.
- Reuses the existing `SapStatusIcon` component and `statusIcon` column option already present in `DetailColumn`.
- Display mode is unaffected because it does not use this results table.
