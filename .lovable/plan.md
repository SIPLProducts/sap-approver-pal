## Fix BP Status pie chart label clipping

**File:** `src/routes/_authenticated/sd.dashboard.tsx` (lines ~477–497)

**Problem:** The BP Status donut uses fixed pixel radii (`innerRadius={70}`, `outerRadius={105}`) with an external label `"${name}: ${value}"`. As the ChartCard grows wider (large screens / browser zoom out), the donut stays a fixed small size in the middle while the external labels are anchored to the pie's geometry — the labels then extend past the container edges and get clipped.

**Fix (styling only, no data/logic changes):**

1. Replace fixed pixel radii with percentage strings so the donut scales with the container:
   - `innerRadius="55%"` , `outerRadius="78%"`
2. Add a `PieChart` `margin={{ top: 16, right: 24, bottom: 16, left: 24 }}` so external labels have breathing room on both sides at any width.
3. Keep external labels visible but ensure they render on top and don't wrap awkwardly:
   - Keep `label={(e) => `${e.name}: ${e.value}`}` and add `labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.5 }}`.
   - Add `isAnimationActive={false}` on the labels? Not needed — leave animation.
4. Cap the visible label length only if it grows too wide by rendering labels with a small font via a custom label renderer that positions text at the polar angle, clamping x within container bounds. Simpler: rely on the added horizontal margin + percentage radii — this is enough for "Active" / "Inactive" strings which are short.
5. Keep the `<Legend />` as-is (already shows the labels below), so even in the rare narrow case, the identity is visible.

**Out of scope:** No changes to `bpStatus` computation, colors, other charts, or the ChartCard component.

**Verification:** Load `/sd/dashboard` at 1188px and at zoomed-out widths (1440–1920). Confirm "Active: N" and "Inactive: N" labels render fully inside the card at every width.