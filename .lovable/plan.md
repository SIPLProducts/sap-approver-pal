## Goal
Allow selecting multiple plants in the Plant F4 picker on the SD approval screens, and fan out the SAP fetch so results are merged across all selected plants.

## Scope
- `src/components/sd/sd-approval-shell.tsx` (shared shell used by SD screens)
- `src/routes/_authenticated/sd.contract.tsx`
- `src/routes/_authenticated/sd.price.tsx`
- `src/routes/_authenticated/sd.sales-order.tsx`
- `src/routes/_authenticated/sd.sc-so.tsx`

Out of scope: Admin → Users plant filter and the Users row-edit plant picker (those stay single-select / existing multi-select as-is).

## Changes

1. **Picker swap**
   - Replace `PlantSelect` with the existing `PlantMultiSelect` in the shell and the four SD screens.
   - State becomes `plants: string[]` instead of `plant: string`. Storage in `localStorage` (the "active plant" defaulting flow used today) keeps a single string; we'll derive the initial array from `[activePlant]` and let the user expand.

2. **Validation**
   - "At least one plant required" — disable the Execute/Fetch button when `plants.length === 0` and surface the existing toast message ("Plant is required" → "Select at least one plant").

3. **Fan-out fetch (per screen)**
   Each screen currently calls a single `fetchFor(plant)` style server fn. Replace with:
   ```ts
   const results = await Promise.all(
     plants.map((p) => fetchFor({ ...inputs, plant: p }))
   );
   const rows = results.flatMap((r) => r.rows ?? []);
   ```
   - Preserve existing error handling: if any single plant call rejects, surface a toast naming the failed plant(s) but still render successful ones (Promise.allSettled).
   - Dedupe rows by the screen's natural key (document number) when merging.
   - `lastFetchedAt` / pagination / cached state shapes stay unchanged — only the row source is the merged array.

4. **Query keys**
   - Update React Query keys from `["sd-...", plant, ...]` to `["sd-...", [...plants].sort().join(","), ...]` so re-selecting the same set hits cache.

5. **Row display**
   - Add a "Plant" column (or ensure existing column is visible) on each screen so merged rows from different plants stay distinguishable. If the column already exists, no change.

## Non-goals
- No changes to SAP server functions themselves (they keep accepting a single plant).
- No DB / migration changes.
- No change to admin.users PlantSelect filter or to role/permission logic.

## Risks
- Fan-out multiplies SAP calls; for users with many assigned plants this may be slow. We're capping nothing by default — flag for future throttling if needed.