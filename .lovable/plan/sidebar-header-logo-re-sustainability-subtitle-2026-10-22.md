# Sidebar header: logo + "RE Sustainability" + subtitle

Match the RE Gate Entry sidebar header layout, keeping current sidebar colours.

## Changes (only the sidebar header block in `src/routes/_authenticated.tsx`)
- Logo tile: white rounded square (~56px, `rounded-xl`, soft shadow) with the existing logo centered inside.
- Beside it, stacked:
  - "RE Sustainability" — bold, 18px, white (sidebar foreground), tight tracking.
  - "Executive Approvals" — 12px, muted sidebar foreground, normal case, `whitespace-nowrap` so it never wraps.
- Header padding slightly increased (`px-4 py-4`, gap 12px) to give the larger tile room; border-bottom kept.
- Collapsed sidebar: unchanged behaviour — only the logo tile shows, centered (tile shrinks to fit the 64px width).

## Unchanged
- Navigation items, collapse/expand, mobile header, colours, all other screens and logic.
