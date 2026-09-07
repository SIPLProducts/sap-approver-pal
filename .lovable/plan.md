# Keep PR/PO selection controls inside their cards

## Scope
- Update only the selection-card layouts on **PR Release** and **PO Release**.
- Preserve every existing field, button, API call, validation, filter, table, selection rule, and pagination behavior.

## Changes
1. Replace the current fixed five-column row with a responsive grid that uses available card width rather than forcing all controls onto one oversized line.
2. Keep Plant, Release Group, and Release Code aligned as full-width controls within their grid cells.
3. Keep **Cancel Record**, **Execute**, and **Reset** in contained, non-shrinking groups; allow them to move to the next row together when horizontal space is limited.
4. Apply the same layout structure to both screens so they remain visually consistent at 100% browser zoom and narrower viewports.
5. Verify both pages at desktop and mobile widths, confirming no horizontal overflow from the selection card and that Reset remains visible inside it.

## Technical details
- Files: `src/routes/_authenticated/mm.pr-release.tsx` and `src/routes/_authenticated/mm.po-release.tsx`.
- Styling-only class changes; no state, event handlers, server functions, payloads, or data-table logic will change.
