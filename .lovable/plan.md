## Goal
Turn the top-bar Plant selector into a multi-select, and make every Plant field in the SD Approvals screens show only the plants selected up there.

## Changes

### 1. `src/hooks/use-active-context.tsx` — store multiple active plants
- Replace `activePlant: string | null` with `activePlants: string[]` on the context (kept in localStorage as JSON under `app.activePlants`).
- Keep a derived `activePlant` (= `activePlants[0] ?? null`) so role resolution (roles come from one plant) and any legacy consumers keep working.
- Default: on first hydration, select all assigned plants. If the stored list contains codes no longer assigned, prune them; if it becomes empty, fall back to all assigned plants.
- Expose `setActivePlants(codes: string[])`; retain a thin `setActivePlant` for compatibility.

### 2. `src/routes/_authenticated.tsx` — top-bar multi-select
Replace the current `<Select>` for plant with a small popover multi-select limited to `ctx.plants` (the user's assigned plants — not the full SAP list). Reuse the existing shadcn `Popover + Command + Checkbox` styling used by `PlantMultiSelect` so it looks identical. Trigger label:
- 0 selected → "Select plants"
- 1 → "Plant XXXX — Name"
- n → "n plants"
Include "Select all / Clear all". On change: `ctx.setActivePlants(next)`, then `qc.invalidateQueries()` + `router.invalidate()` (same as today).

### 3. `src/components/sap/plant-multi-select.tsx` and `plant-select.tsx` — restrict options
Both components currently fetch the full SAP plant list. Add a new prop `restrictToActive?: boolean` (default **true**). When true and `useActiveContext().activePlants.length > 0`, filter the fetched options down to that set before rendering. This automatically confines every Plant field on the SD screens to the top-bar selection.

Also: if `value` contains codes no longer in the restricted set, drop them via `onChange` in an effect so state stays consistent when the top-bar selection shrinks.

### 4. SD screen local state — follow the top-bar selection
In `sd.price.tsx`, `sd.contract.tsx`, `sd.sc-so.tsx`, `sd.sales-order.tsx`, and `components/sd/sd-approval-shell.tsx`:
- Initialize local `plants` state from `activePlants` (not just `activePlant`).
- In the existing `useEffect` that syncs with the top bar, replace it with: whenever `activePlants` changes, set local `plants` to the intersection of previous local `plants` and `activePlants`; if that becomes empty, default to all `activePlants`.

`sd.bmw-status.tsx` uses two single `PlantSelect`s (From/To sales org). Same rule applies via the `restrictToActive` default; if the currently selected value is no longer allowed, clear it.

### 5. Admin screens keep the full plant list
`src/routes/_authenticated/admin.users.tsx` assigns plants to users, so it must still show all SAP plants. Pass `restrictToActive={false}` to both `PlantSelect` (line 398) and `PlantMultiSelect` (line 961) there.

## Out of scope
- Role selector behavior (still tied to one plant — the first of `activePlants`).
- Server-side approvals functions (they already accept a `plants: string[]` array).
- No DB or schema changes.