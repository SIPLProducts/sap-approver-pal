# Dark blue table headers app-wide

## What changes

Table header colors are already centralized as CSS variables in `src/styles.css`, and every table (shared table primitives, Cloudscape approval table, and hand-rolled headers) reads them. So this is a token-only change.

- `--table-header-bg` → `#2A3F87`
- `--table-header-text` → `#FFFFFF`
- `--table-header-border` → a slightly darker blue (`#1F2F66`) so the header edge stays visible against the new background
- Same values applied in both the light `:root` block and the `.dark` block so the header looks identical in either theme

## Out of scope

No layout, column, logic, data-fetching, or component changes. Row hover, sticky header behavior, and all other colors stay as they are.
