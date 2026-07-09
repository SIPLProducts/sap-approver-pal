## Email Configuration screen (UI only)

Build a new authenticated screen matching the reference mockup, styled with the existing app's tokens (ivory canvas, red primary, graphite sidebar) — no persistence, no send. Local component state only.

### Route

- New file: `src/routes/_authenticated/settings.email-config.tsx`
  - `createFileRoute("/_authenticated/settings/email-config")`
  - `head()` with title "Email Configuration" + matching og/description
  - Accessible to any authenticated user (route sits under `_authenticated`, no extra screen-key gate)

### Layout (matches reference, single active tab)

Page header (using existing `PageHeader` pattern from `src/components/exec/page-header.tsx` if suitable, otherwise inline):
- Icon (Mail, lucide) + title "Email Configuration"
- Subtitle: "Manage SMTP credentials for outbound emails (host, port, sender, app password)."

Tabs (shadcn `Tabs`) with two triggers to mirror the mockup, but only the second is functional:
- "User SMTP Configuration" — disabled trigger (kept for visual parity)
- "No Reply Email Configuration" — active, default

Card body ("No Reply Email Configuration" section):
1. Header row: Mail icon + "No Reply Email Configuration" title, helper copy underneath.
2. "Enable No-Reply Sending" toggle row (shadcn `Switch`) inside a bordered/muted panel — bold label + muted helper "When off, system notifications are not sent."
3. Two-column grid (`grid md:grid-cols-2 gap-4`) of fields, all shadcn `Input` / `Select`:
   - SMTP Host (text) — default placeholder "smtp.gmail.com"
   - Port (number) — default "587"
   - Encryption (Select: None, SSL (465), TLS (587), STARTTLS)
   - Username (email)
   - App Password (password input with eye toggle button) — helper "(leave empty to keep existing)"
   - From Email (email)
   - From Name (text, spans 1 col)
   - CC Recipients (optional) — tag/chip input: press Enter or comma to add; each chip shows email + × to remove; free-text input to type next; invalid entries silently skipped. Helper text underneath.
4. Info alert (shadcn `Alert` with `Info` icon, using `--info` token): explains From/To/CC behavior.
5. Footer row: left "Send test to" input; right side "Send Test Email" (outline button, `Send` icon) + "Save Configuration" (primary button). Both are click-handlers that only `toast()` (using existing sonner toast) — no network calls.

### Styling

- Card wrapper: `bg-card border border-border rounded-lg shadow-card p-6`
- Inputs use existing shadcn styling; no custom colors introduced.
- Toggle uses `Switch` (primary red when on) — matches the app's red accent (reference is orange; we use app primary for consistency).
- Chips: `bg-accent text-accent-foreground` rounded-full pill with × button.
- No new tokens added to `src/styles.css`.

### Navigation entry

- Add a "Email Configuration" link inside `src/routes/_authenticated/settings.tsx` (or wherever settings sub-nav lives). If settings.tsx is a leaf (not a layout), keep the new route independently reachable at `/settings/email-config` and add a `<Link>` on the existing settings page pointing to it.

### Files touched

- New: `src/routes/_authenticated/settings.email-config.tsx` (all UI + local state)
- Edit: `src/routes/_authenticated/settings.tsx` — add a link/card entry to open the new screen
- Auto-regenerated: `src/routeTree.gen.ts`

### Out of scope

- No DB table, no server function, no email send, no persistence across reloads.
- No permission/screen-key gating beyond existing `_authenticated` guard.
- User SMTP Configuration tab body (visual tab only, disabled).
