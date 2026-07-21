## Goal
Apply the same table header styling used in the approval tables to every table across the app — including admin screens, approval detail screens, and any Cloudscape-based tables — via global CSS so no per-screen edits are needed.

## Changes

### 1. `src/styles.css` — add global rules

Add app-wide table styling scoped to any `<table>` under the app root, plus an override for Cloudscape:

- Header cells (`thead th`):
  - `background: #F8F9FA`
  - `color: #374151`, `font-weight: 700`
  - `border-bottom: 1px solid #E5E7EB`
  - `padding: 12px 16px`
  - `position: sticky; top: 0; z-index: 10`
  - Left-align by default; `.num` / `[data-align="right"]` / `[align="right"]` → right-align
- Body rows: `hover` → `background: #F1F2F4`
- Body cells: numeric variants (`.num`, `.tabular-nums`) right-aligned (already partly there — consolidate)
- Keep the existing red accents on buttons/status; explicitly do not touch `button`/`.badge` colors

Also update the existing Cloudscape override block so the header uses the new light gray (`#F8F9FA` / `#374151`) instead of the current sidebar-graphite background — the request is that headers are NOT brand-colored.

### 2. `src/components/ui/table.tsx` — bake the style into the shadcn primitives

Update default classes so any consumer of `<Table>` inherits the new style without needing overrides:
- `TableHeader`: sticky, light gray background
- `TableHead`: `bg-[#F8F9FA] text-[#374151] font-bold border-b border-[#E5E7EB] px-4 py-3`, left-aligned
- `TableRow`: hover `bg-[#F1F2F4]`

This covers `admin.users.tsx`, `admin.sap-api.$id.tsx`, `approval.$id.tsx`, `sd-approval-shell.tsx`, `mm.pr-release.tsx`, and the shared `cloudscape-approval-table.tsx` (which already uses these primitives).

### 3. Numeric alignment convention

Document (via CSS) that any `<th>` / `<td>` with class `num` or `tabular-nums` is right-aligned. Existing rules already do this; keep them and ensure they win under the new selectors.

## Out of scope
- No changes to button, badge, or status colors (brand red preserved).
- No changes to business logic or per-screen table markup.
- No new components.

## Files touched
- `src/styles.css`
- `src/components/ui/table.tsx`
