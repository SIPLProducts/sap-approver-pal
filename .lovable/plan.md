## Move Email Configuration out of Settings

Turn Email Configuration into a top-level standalone screen at the bottom of the left sidebar, alongside `Settings`. Remove the entry card that was added to the Settings page.

### Route change

- Rename file: `src/routes/_authenticated/settings.email-config.tsx` → `src/routes/_authenticated/email-config.tsx`
- Update `createFileRoute("/_authenticated/settings/email-config")` → `createFileRoute("/_authenticated/email-config")`
- Component/head unchanged.

### Sidebar

- Edit `src/routes/_authenticated.tsx` `manage_items` array — add a new entry directly ABOVE `Settings` (so it renders just above it at the bottom):
  - `{ to: "/email-config", label: "Email Configuration", icon: Mail, screen: null }`
- Import `Mail` from `lucide-react` (already imported elsewhere; add if missing).
- `screen: null` matches the pattern used for Settings so it's visible to any authenticated user.

### Revert settings.tsx

- Remove the Email Configuration `<Link>` card block added in the previous step.
- Remove the unused `Link`, `Mail`, `ChevronRight` imports if no other usage.

### Files touched

- Renamed: `src/routes/_authenticated/settings.email-config.tsx` → `src/routes/_authenticated/email-config.tsx` (route string updated)
- Edited: `src/routes/_authenticated.tsx` (sidebar entry)
- Edited: `src/routes/_authenticated/settings.tsx` (revert card + imports)
- Auto-regenerated: `src/routeTree.gen.ts`

### Out of scope

No changes to the screen's content, styling, or behavior.
