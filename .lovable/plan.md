# AWS Cloudscape UI for Approval Screens

Restyle the five approval screens to match AWS Console (Cloudscape Design System, Light theme) by installing the official Cloudscape component library and swapping current shadcn primitives on those screens for their Cloudscape equivalents.

## Scope (screens)

- `src/routes/_authenticated/sd.contract.tsx` — BMW Contract Approvals
- `src/routes/_authenticated/sd.sc-so.tsx` — Service Cert & SO
- `src/routes/_authenticated/sd.sales-order.tsx` — Sales Order Approvals
- `src/routes/_authenticated/sd.bmw-status.tsx` — BMW Status Report
- `src/routes/_authenticated/sd.price.tsx` — Price Approvals (for consistency)

Out of scope: sidebar, top nav, login, admin/*, inbox/*, approval/$id, history, settings, notifications, global theme tokens, server functions.

## Visual pattern (per screen)

Each screen adopts the Cloudscape "Table view" pattern:

```text
┌─ ContentLayout ────────────────────────────────┐
│  Header (h1 + counter "(N)")                   │
│  ┌─ Table ─────────────────────────────────┐   │
│  │ Header slot: filter input + Refresh +   │   │
│  │              Approve/Reject actions     │   │
│  ├─────────────────────────────────────────┤   │
│  │ Sticky column header (Cloudscape navy)  │   │
│  │ Selectable rows, zebra, compact density │   │
│  ├─────────────────────────────────────────┤   │
│  │ Pagination footer (Cloudscape)          │   │
│  └─────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

- Cloudscape `<Table>` with `stickyHeader`, `selectionType="multi"`, `variant="full-page"`, `resizableColumns`, `stripedRows`.
- Cloudscape `<Pagination>` replaces the local `PagerNav`.
- Cloudscape `<TextFilter>` replaces the per-column filter inputs (single global filter, matching AWS convention). Column-level filtering stays available via `filteringFunction`.
- Cloudscape `<Button variant="primary|normal">` replaces shadcn `<Button>` in the table toolbar and decision dialog footer.
- Cloudscape `<StatusIndicator>` replaces the current pending/accepted/rejected badges.
- Dialogs remain shadcn (they aren't part of Cloudscape's table pattern in use here) — only their action buttons switch to Cloudscape buttons for consistency.

## Technical details

### Package install

```bash
bun add @cloudscape-design/components @cloudscape-design/global-styles
```

Import Cloudscape's global CSS once in `src/main.tsx`:

```ts
import "@cloudscape-design/global-styles/index.css";
```

Light theme is default — no theme override needed.

### Isolation from Tailwind

Cloudscape ships its own reset and CSS variables. To prevent bleed into non-approval pages, wrap only the five approval screens in a `<div className="awsui">` container and scope any custom overrides to that class. No changes to `src/styles.css` beyond ensuring Cloudscape's CSS import order (Cloudscape after Tailwind base so its component styles win inside the wrapper).

### Per-file changes (identical pattern)

For each of the 5 route files:

1. Replace the outer `<Card>` + custom table markup with:
   - `<AppLayout>`-less `<ContentLayout header={<Header variant="h1" counter={\`(\${total})\`}>Title</Header>}>`
   - `<Table>` with `columnDefinitions`, `items={pageRows}`, `selectedItems`, `onSelectionChange`, `header={<Header actions={...}>…</Header>}`, `filter={<TextFilter…/>}`, `pagination={<Pagination…/>}`, `empty={…}`, `loading={pending}`.
2. Map existing column config → Cloudscape `columnDefinitions` (`id`, `header`, `cell`, `sortingField`, `minWidth`).
3. Replace the current `page`/`pageSize`/`PagerNav` state with Cloudscape's `useCollection` hook from `@cloudscape-design/collection-hooks` (install alongside) for pagination + filtering + sorting.
4. Replace decision-dialog action buttons with Cloudscape `<Button variant="primary">Approve</Button>` / `<Button>Reject</Button>`.
5. Replace status pills with `<StatusIndicator type="success|error|pending">`.
6. Remove now-unused imports (`Pagination*` from shadcn, `PagerNav`, `FilterInput`).

`bmw-status.tsx` keeps its multi-row grouped header via Cloudscape's `columnDisplay` + header groups (Cloudscape doesn't natively support grouped headers, so grouped labels move into a header caption row above the `<Table>`).

### Data / logic

No changes to server functions, `useMutation` flows, `submit*Decision` wiring, filter query shapes, or selection semantics. Pagination becomes client-side via `useCollection` (currently manual slicing).

### Risk / notes

- Cloudscape adds ~350 KB gzipped to the bundle for these routes.
- Cloudscape uses its own font (Open Sans / Amazon Ember fallback). This will look different from the rest of the app inside the wrapper — intentional per the AWS Light choice.
- Grouped headers in BMW Status Report degrade to a caption row (Cloudscape limitation).

## Deliverable

Five approval screens render as AWS Console tables (sticky navy header, striped rows, native Cloudscape pagination + filter + selection), while the rest of the app is untouched.
