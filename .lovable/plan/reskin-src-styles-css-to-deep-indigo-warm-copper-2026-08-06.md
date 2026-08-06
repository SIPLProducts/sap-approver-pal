# Reskin `src/styles.css` to deep indigo + warm copper

Replace the current ivory/red/gold visual tokens with the requested deep indigo, warm copper, and cool porcelain palette, and switch the typeface to IBM Plex Sans/Mono.

- Add the Google Fonts import at the very top of `src/styles.css`.
- In `@theme inline`, change `--font-sans` and `--font-display` to IBM Plex Sans, and add `--font-mono` for IBM Plex Mono.
- Replace `:root` color values with the provided hex values while keeping every variable name unchanged.
- Replace `.dark` color values with the provided dark-mode hex values.
- Add `font-family: var(--font-mono);` to the `.tabular, .tabular-nums, td.num, .num` rule alongside the existing tabular numeric styling.

No component logic, layout, or page structure changes.