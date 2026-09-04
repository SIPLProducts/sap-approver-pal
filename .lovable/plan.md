# Rename "SD Approvals" to "BMW Approvals" and "SD Dashboard" to "BMW Dashboard"

## Goal
Update user-facing labels only. No route paths, screen keys, SAP activity codes, module codes, API names, payloads, or logic change.

## Label changes

"SD Approvals" -> "BMW Approvals", "SD Dashboard" -> "BMW Dashboard", "SD Approvals Inbox" -> "BMW Approvals Inbox", and the related eyebrow text "SD Reports" -> "BMW Reports" for consistency.

### Files to edit (display strings only)

1. `src/routes/_authenticated.tsx` — sidebar group title/label "SD Approvals" (2 places) and nav item label "SD Dashboard".
2. `src/lib/admin/screen-keys.ts` — module name "SD Approvals", screen labels "SD Approvals Inbox" and "SD Dashboard". Keys (`sd.dashboard`, `approvals.inbox.sd`) and activities (`SD.DASHBOARD`, `APPROVALS.INBOX_SD`) stay unchanged.
3. `src/routes/_authenticated/sd.dashboard.tsx` — PageHeader eyebrow "SD Approvals · Live analytics" and title "SD Dashboard".
4. `src/routes/_authenticated/inbox.$module.tsx` — heading string "SD Approvals".
5. PageHeader eyebrows "SD Approvals" in `sd.price.tsx`, `sd.contract.tsx`, `sd.sc-so.tsx`, `sd.sales-order.tsx`.
6. `src/components/sd/sd-approval-shell.tsx` — "SD Approvals · {tCode}" caption.
7. `src/routes/index.tsx` — landing card heading and footer link text "SD Approvals".
8. Report eyebrows "SD Reports" -> "BMW Reports" in `sd.price-reports.tsx`, `sd.contract-reports.tsx`, `sd.sales-order-reports.tsx`, `sd.sc-so-reports.tsx`, `sd.bmw-status.tsx`.

## What does NOT change
- File names, route paths (`/sd/...`), route IDs, screen keys, SAP activity codes.
- The `"SD"` module enum used in SAP config, approvals constants, MCP tools, and database types.
- Any function, payload, permission, or business logic.

## Verification
- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Sidebar, dashboards, and SD approval pages show the new BMW wording with unchanged behaviour.
