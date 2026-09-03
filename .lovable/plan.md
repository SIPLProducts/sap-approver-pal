# Rename ZNFA Rating to ZTER Rating in MM Approvals

## Goal
Replace every user-facing "ZNFA Rating" label with "ZTER Rating" in the MM Approvals area, without changing any code logic, API names, payload structures, or functionality.

## What changes

Only display strings that reference the screen name are updated. The route path (`/mm/gate-process`), SAP API keys, screen key (`mm.gate_process`), permissions, and business logic remain unchanged.

### Files to edit

1. **src/routes/_authenticated.tsx** (line ~160)
   - Sidebar navigation label: `ZNFA Rating` → `ZTER Rating`

2. **src/lib/admin/screen-keys.ts** (line ~32)
   - Screen-key label: `ZNFA Rating` → `ZTER Rating`

3. **src/routes/_authenticated/mm.gate-process.tsx**
   - PageHeader title: `ZNFA Rating` → `ZTER Rating`
   - PageHeader subtitle: `Rate, change and review ZNFA tender records.` → `Rate, change and review ZTER tender records.`
   - DataTable title: `ZNFA Rating` → `ZTER Rating`
   - DataTable emptyMessage: `Click Execute to load ZNFA Rating records from SAP.` → `Click Execute to load ZTER Rating records from SAP.`
   - All SapResponseDialog / alert titles that read `ZNFA Rating` → `ZTER Rating`
   - `defaultTitle="ZNFA Rating"` → `defaultTitle="ZTER Rating"`

4. **src/lib/mm/gate-process.functions.ts** (line ~2)
   - JSDoc comment: `MM Gate Process / ZNFA Rating` → `MM Gate Process / ZTER Rating`

## What does NOT change

- Route file paths and route IDs (`/mm/gate-process`, `mm.gate_process`).
- SAP API configuration names (e.g., `ZNFA_Fetch_API`, `ZNFA_Rating_Save_API`, `ZNFA_PRINT_API`).
- ZNFA Release screen and its APIs/labels.
- Type names, function names, payload shapes, middleware handling, RLS, or any behavior.

## Verification

- Run `bunx tsgo --noEmit -p tsconfig.json` (or the project typecheck command).
- Run `npm run build:selfhost` to confirm no build regressions.
- No functional or data changes are expected.
