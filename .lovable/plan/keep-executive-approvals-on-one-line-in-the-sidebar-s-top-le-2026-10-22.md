Keep "Executive Approvals" on one line in the sidebar's top-left brand area.

Change (only `src/routes/_authenticated.tsx`, line 219): add `whitespace-nowrap` to the label and reduce letter spacing from `tracking-[0.18em]` to `tracking-[0.08em]`. This keeps the text on one line within the sidebar width. Nothing else changes: text, colors, collapse behavior, and logic stay the same.

Verify: typecheck, then a screenshot showing the label on one line.
