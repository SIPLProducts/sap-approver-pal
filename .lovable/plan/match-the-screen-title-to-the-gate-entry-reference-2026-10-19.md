# Match the screen title to the Gate Entry reference

The reference title ("Inward Gate Entry – PO Reference") is bigger than ours (about 30px against our 24px). It is bold, tightly spaced, and sits a little further below the breadcrumb.

## Change (only `src/components/exec/page-header.tsx`, the title line)
- Change the title from `text-2xl font-bold tracking-tight` to `text-[30px] leading-tight font-bold tracking-tight`, keeping the foreground colour and the Plus Jakarta Sans font.
- Keep the breadcrumb-to-title gap as it is (`mb-3`), which matches the reference.

This updates the screen name in the body of all 34 screens that use the shared title, since they all use this one title line. Nothing else changes: breadcrumb, subtitle, actions, layout, CSS file, logic and APIs all stay as they are.

## Check
- Typecheck.
- Screenshot at 1366×768 on the Transportation screen to confirm the title fits next to its action buttons and long titles wrap cleanly.
