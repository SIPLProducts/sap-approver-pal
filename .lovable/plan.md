## Executive Redesign — CFO/CEO grade across mobile, tablet, laptop

Goal: lift the entire experience to a world-class enterprise-finance aesthetic — restrained, precise, dense, fast to scan — without changing any business logic, API calls, or data shapes.

### 1. Brand-derived design system (`src/styles.css`)

Anchor on the RESL logo: signature red on a deep graphite-slate field, with warm ivory surfaces and a single quiet gold accent for status / emphasis.

- Light surfaces: ivory `#FAF8F4`, paper `#F2EFE8`, ink `#0E1116`.
- Deep field (sidebar, hero, exec headers): graphite `#0E1116` → slate `#1A1F2A`.
- Primary brand red kept (RESL mark), tightened to oklch(0.55 0.21 27); add `--brand-deep` for hover/pressed.
- Accent gold `#C9A24A` for KPI highlights, approval streaks, badge edges (used sparingly — never as fill on large surfaces).
- Status tokens retained but tuned for AA contrast on both ivory and graphite.
- New tokens: `--surface-elevated`, `--surface-sunken`, `--rule` (1px hairline), `--shadow-exec` (soft, low, long), `--gradient-exec-hero`, `--ring-focus`.
- Radii tightened to 8 / 12 / 16; chips 999px.

### 2. Typography (Urbanist + Epilogue)

- Install `@fontsource-variable/urbanist` and `@fontsource-variable/epilogue`; load in `src/start.ts` / `__root.tsx` per stack rules.
- `--font-display: "Urbanist Variable"` for H1/H2/section titles and KPI numbers (tabular nums, -0.02em tracking).
- `--font-sans: "Epilogue Variable"` for body, tables, forms.
- Numeric: `font-variant-numeric: tabular-nums` on all amounts, IDs, dates.

### 3. Login / landing (`src/routes/login.tsx`)

Split-screen on ≥md, single-column on mobile.

- Left (60%): deep graphite canvas with subtle dotted grid + soft radial brand-red glow bottom-left; large Urbanist wordmark "Approvals, decided." with one-line subline ("Executive approvals for sales orders, contracts, pricing and service certificates."); three small KPI chips at bottom (Pending today / Avg. decision time / Approved this month — static visual proof).
- Right (40%): ivory card, RESL mark top, "Sign in" H2, email + password, "Continue with Google" secondary, footer micro-legal. Tight 12px field spacing, 44px tap targets.
- Mobile: deep band as compact hero (35vh) with mark + title, form below on ivory.

### 4. App shell & navigation

- Sidebar: graphite, Urbanist labels in 13px uppercase tracked, brand-red rail indicator on active route, gold dot for unread approval count.
- Top bar: breadcrumb (Epilogue 13px), global search (`⌘K`), notifications, user menu — hairline divider, no shadow.
- Mobile: collapses to bottom tab bar (Inbox, History, Notifications, Profile) + hamburger for modules; tablet keeps rail sidebar collapsed to icons.

### 5. Inbox / approvals home (`src/routes/_authenticated/inbox.index.tsx` + `inbox.$module.tsx`)

Dense dashboard density per preference.

- Executive header strip: 4 KPI tiles (Pending, Overdue, Approved 7d, Rejected 7d) — large Urbanist numbers, delta vs last week, sparkline, gold underline on the lead KPI.
- Module rail: Sales Order / Contract / Price / Service Cert + SO — pill tabs with live counts.
- Data table (desktop/tablet): zebra-free, hairline rows, sticky header, columns = ID • Customer • Amount (right-aligned tabular) • Aging • Requested by • SLA bar • Actions. Row hover reveals quick-approve / quick-reject icon buttons; multi-select with sticky bulk-action bar.
- Filters: collapsible left drawer (Date, Amount band, Plant, Sales Org, Status) — persists in URL.
- Mobile: each row becomes a tight card — ID + amount on first line, customer + aging on second, swipe-right approve / swipe-left reject, tap opens detail.

### 6. Approval detail screens (Sales Order, Contract, Price, SC & SO)

Three-pane on laptop, two-pane on tablet, stacked sheets on mobile. No logic changes — only layout/typography.

- Header card: customer name (Urbanist 24), doc reference + plant + sales org chips, big amount right-aligned, status pill, "Approve / Reject" primary action cluster pinned top-right (also pinned bottom on mobile).
- Left pane: meta grid (dates, terms, references) in 2-column dense key/value rows, hairline separators, no boxes.
- Center pane: line-items table — sticky header, tabular numerics, subtle group totals, expand-row for tax/discount breakdown.
- Right pane (collapsible): approval trail (timeline), prior approvers, attachments, comments.
- Reject modal keeps existing reason flow; restyle only.
- Existing SAP response SweetAlert is preserved as-is (already simplified to TYPE + message per prior change).

### 7. Responsiveness rules applied everywhere

- Header rows: `grid-cols-[minmax(0,1fr)_auto]` on mobile, promote to flex at `sm:`; `min-w-0` on text containers, `shrink-0` on icons, `truncate` on titles.
- All page heights use `h-dvh` not `h-screen`.
- Tap targets ≥44px; icon-only buttons get `aria-label`.
- Tables: horizontal scroll inside a card on tablet/mobile, with frozen first column for ID.
- Preview viewport switched to desktop for QA, then tablet, then mobile.

### 8. Out of scope (explicitly unchanged)

- All `createServerFn` handlers, SAP API routes, middleware passthrough, payload shapes.
- The approve/reject SweetAlert content and the recently-simplified SAP response modal.
- Auth flow, RLS, user-roles, route tree generation.

### Files to edit / add

- `src/styles.css` — tokens, gradients, shadows, fonts.
- `src/start.ts` or `src/routes/__root.tsx` — font imports.
- `src/components/brand-logo.tsx` — sizing variants + optional wordmark.
- `src/components/ui/*` — light variant tweaks via class (no API changes) for `button`, `card`, `badge`, `table`, `input`.
- New: `src/components/exec/kpi-tile.tsx`, `sla-bar.tsx`, `page-header.tsx`, `data-toolbar.tsx`, `executive-shell.tsx` (optional wrapper around existing `_authenticated.tsx`).
- `src/routes/login.tsx` — split hero layout.
- `src/routes/_authenticated.tsx` — sidebar + topbar + mobile tab bar.
- `src/routes/_authenticated/inbox.index.tsx`, `inbox.$module.tsx` — KPI strip + dense table/card list.
- `src/routes/_authenticated/sd.sales-order.tsx`, `sd.contract.tsx`, `sd.price.tsx`, `sd.sc-so.tsx` — three-pane detail layout.

### Verification

1. Build passes; route tree unchanged.
2. Visual QA via Playwright at 1440, 1024, 768, 390 widths — screenshot login, inbox, one approval detail.
3. Confirm Approve / Reject still hits the same endpoints with the same payloads (no functional drift).
