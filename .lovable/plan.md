1. Remove the “Division × Distribution Channel” card from `src/routes/_authenticated/sd.dashboard.tsx`.
   - Delete the entire `ChartCard` block (title, subtitle, BarChart, etc.).
   - Remove the `Layers` import from `lucide-react` if it is no longer used elsewhere in the file.
   - Clean up the now-unused `divChannel` aggregation logic inside the `stats` `useMemo` (the Map creation, the row loop, and the derived `divChannelData`/`topChannels` return values).

2. Fix the black fill color in the “Records by Sales Org” card.
   - The first entry of `CHART_COLORS` is `hsl(var(--primary))`, which can fall back to black when the CSS variable is not resolved in that SVG context.
   - Replace that first entry with a solid, theme-aligned blue (e.g. `hsl(221 83% 53%)`) so the first sales-org bar renders clearly. This also corrects any other chart in the same file that uses the first `CHART_COLORS` entry.
   - Keep the rest of the palette unchanged so the bars remain colorful.

3. Verify with `tsgo` typecheck and confirm the dashboard still compiles without errors.