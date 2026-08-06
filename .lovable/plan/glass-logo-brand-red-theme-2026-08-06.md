# Glass logo + brand-red theme

## 1. Login page logo (top-left)
- Replace the solid white pill behind the logo with a frosted-glass panel: translucent white fill, soft blur, thin light border, gentle inner highlight and shadow, slightly larger rounding and padding.
- The current logo file is red artwork on a solid white block, so on glass it would show as a white rectangle. A transparent-background version of the same mark is prepared and used only where it sits on dark/glass surfaces (the login hero). All other placements keep working as they do today.
- Layout, sizes and the surrounding text stay as they are.

## 2. Primary theme to match the logo
The logo is a single brand red (#E31F26) on white. Colour tokens in `src/styles.css` move from deep indigo to that red family, keeping the same porcelain canvas and neutrals so nothing else shifts:

- `--primary` #D01F25, `--primary-glow` #E8474C, `--primary-deep` #9C161B, `--primary-foreground` #FFFFFF
- `--ring` and `--sidebar-primary` / `--sidebar-ring` follow the same red
- `--accent` becomes a warm red-tinted neutral (#FBE9E9 / foreground #7A1B1E)
- Dark mode gets the lighter equivalents (`--primary` #F0555A on the existing dark surfaces)
- The hero gradient token used by the login panel is re-based on the deep red instead of indigo
- Root `theme-color` meta returns to the brand red

Neutrals, success/warning/info, radii, spacing, shadows and fonts are untouched — shadows already reference these variables and pick up the new colour automatically.

## 3. Out of scope
No component logic, layout, route, or copy changes anywhere in the app.

## Technical notes
- Edits limited to `src/styles.css` (token values), `src/routes/login.tsx` (logo wrapper classes), `src/routes/__root.tsx` (`theme-color`), plus a new transparent logo asset + an optional `variant` prop on `BrandLogo` to select it.
- Glass uses Tailwind `bg-white/10 backdrop-blur-xl border border-white/20` — standard properties only, no vendor prefixes.
