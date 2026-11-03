# Unified screen header (design only)

Every signed-in screen gets the same simple header as the reference image: a dark, bold screen name with one grey line of description under it, on the plain page background. Nothing else changes: no functions, data, SAP calls, permissions, tables, filters, routes, or the login page.

## Design
- Screen name: 28px, bold, dark text color, left-aligned (line height 36px).
- Description: 16px, regular weight, grey (muted text color), directly below with a 4px gap, one line (long text is cut off with "…" and the full text shows on hover).
- No breadcrumb (the Home > … trail is removed), and no card, border, or icon behind the header.
- Action buttons stay on the right side, lined up with the screen name. Any extra info shown under the title on some screens (badges) is kept as it is.
- 24px space below the header. The existing slide-up animation is kept.

## Changes
1. **`src/components/exec/page-header.tsx`**: remove the breadcrumb and apply the sizes above. The props stay the same (`eyebrow` is still accepted but no longer shown), so every screen that already uses it updates automatically. That covers about 35 screens across BMW, MM, IWM, Admin, Settings, History, and Notifications.
2. **`src/components/sd/sd-approval-shell.tsx`**: replace its own custom header with `PageHeader`, using the same title and subtitle. The two transaction-code and approval-level badges move into the right-hand actions area.
3. **Screens without a description**: go through every screen that uses `PageHeader` and add a short line saying what the screen is for wherever `subtitle` is missing.
4. The inbox entry and MM dashboard pages only redirect, so they have no header to change.

## Check
After the changes, compare a few screens with the reference image: BMW Price, PR Release, Transportation (90%), and SAP API Settings.
