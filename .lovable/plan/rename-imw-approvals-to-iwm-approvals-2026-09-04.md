# Rename "IMW Approvals" to "IWM Approvals"

Display-label-only rename. No routes, screen keys, SAP activity codes, API config names, payloads or logic change.

## Label changes

"IMW Approvals" -> "IWM Approvals", "IMW Approvals Inbox" -> "IWM Approvals Inbox".

### Files to edit (display strings only)

1. `src/lib/admin/screen-keys.ts` — module name `"IMW Approvals"` and screen label `"IMW Approvals Inbox"`. Keys (`approvals.inbox.imw`, `imw.price_master`, `imw.price_master_approvals`) and activities (`APPROVALS.INBOX_IMW`, `IMW.PRICE_MASTER`, `IMW.PRICE_MASTER_APPROVALS`) stay unchanged.
2. `src/routes/_authenticated.tsx` — sidebar group `title` and label text (2 places).
3. `src/routes/_authenticated/imw.price-master.tsx` — PageHeader eyebrow and head() title / og:title text.
4. `src/routes/_authenticated/imw.price-master-approvals.tsx` — PageHeader eyebrow and head() title / og:title text.

## What does NOT change

- Route paths (`/imw/...`), file names, route IDs, screen keys, SAP activity codes.
- SAP API config names (`IMW_PMU_FETCH_API`, and both accepted edit spellings) and the code comments referencing them.
- Any function, payload, permission or business logic.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Sidebar group and both Price Master screens read "IWM Approvals" with unchanged behaviour.
