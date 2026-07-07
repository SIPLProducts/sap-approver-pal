## Goal

Make every SD approval table readable end-to-end: headers and cell values fully visible with no truncation, columns aligned, comfortable spacing.

## Changes

### 1. `src/lib/sd/dynamic-columns.tsx`
- For each derived column, compute a `minWidth` from actual content:
  - Measure the header label length and the longest rendered string in the column (using the same formatter the cell uses — dates → `dd.mm.yyyy`, numbers → `en-IN` with 2 decimals, otherwise the raw string, `—` for empty).
  - `minWidth = clamp( max(headerLen, maxCellLen) * 8 + padding, floor, ceiling )` — approx. floor 90 px, ceiling 320 px, padding 32 px for sort/resize handles.
  - Right-aligned numeric columns get a slightly larger padding to keep the last digit off the edge.

### 2. `src/components/aws/cloudscape-approval-table.tsx`
- Stop forcing a default `minWidth: 120` in the mapper; honor the value the caller provides (fallback only when caller omits it — keep the 120 fallback so non-dynamic callers still look fine).
- Enable Cloudscape `wrapLines` on the Table so long text falls to a second line instead of clipping when a user narrows a column.
- Keep `resizableColumns` so users can still adjust.

## Out of scope

- No column reordering, sorting, filtering, or grouping changes.
- No changes to server-function payloads or row shapes.
- No changes to non-SD tables.
- No visual redesign — only widths, alignment, and wrap behavior.

## Verification

- Load each SD table with real data → every header is fully visible, no `…` truncation in cells at default width; long text wraps to a second line rather than clipping; right-aligned numeric columns stay aligned.
- Resize handles still work.
- Build + typecheck clean.
