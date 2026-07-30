Modernize the action buttons in the ZNFA Release screen (`src/routes/_authenticated/mm.znfa-release.tsx`) while keeping the existing Creation/Release logic and placeholder button behavior unchanged.

What will change:
- Layout: render the action buttons in a clean two-row grid instead of the current single wrapping row.
- Sizing: give every button the same fixed height and a consistent minimum width so the grid looks uniform.
- Rounded corners: use a medium-to-large radius (`rounded-lg` or `rounded-xl`) to match the card radius.
- Soft colors: default buttons use muted/secondary/ghost variants tinted with the existing theme (ivory, soft slate, subtle RESL red accent) rather than the stark `default`/`outline` toggles. The currently active action button keeps the primary red accent for clear selection state.
- Hover effects: add `transition` with a subtle lift, soft shadow, and background color shift on hover.
- Responsive: on narrow viewports the buttons remain readable and touch-friendly, collapsing to a single column or wrapping gracefully without breaking the card layout.
- Theme: stay within the existing design tokens in `src/styles.css` (RESL red, executive ivory, graphite, gold accents) — no hardcoded hex classes.

What will not change:
- The mode radio group (Creation vs Release) and the list of actions shown per mode.
- The existing `onAction` placeholder behavior and toast notifications.
- Any other MM screens or the `_authenticated` navigation.

Verification:
- Open the ZNFA Release route in the preview and confirm the Creation/Release modes both show the new two-row button layout.
- Hover and active states render consistently and remain responsive across desktop and mobile viewports.