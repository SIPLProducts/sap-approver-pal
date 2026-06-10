## Goal

Integrate the configured `Price_Approval_Fetch` SAP API into **SD Approval → Price Approvals** so the user enters a Plant, executes a live fetch, sees the returned rows, multi-selects them, and clicks Accept/Reject (UI-only for now — toast + clear selection; no backend write until a post-decision API is configured).

## Scope

- Only the route `src/routes/_authenticated/sd/price.tsx` (and a new dedicated component) changes UI-side.
- The existing generic `SdApprovalShell` (DB-backed list) is **not** modified — Price now uses its own dedicated screen because the data source and columns differ. Other SD screens (Contract, SO, SC-SO) keep using the shell unchanged.
- Existing `?status=pending|accepted|rejected` URL behaviour and tests are preserved (status drives a client-side filter over the fetched + locally-decided rows).

## UX flow

```text
[ Selection Screen ]
  Plant *  [____]   USER_ID (auto)   [Execute]  [Reset]
  Tabs: Pending | Accepted | Rejected      ← URL ?status=

[ Toolbar above table ]
  N selected     [Accept]  [Reject]        ← disabled when N = 0 or status ≠ pending

[ Table ]
  [☑] Sel | Key Comb | Cond Type | Customer | Material | Plant
        | Old Price | New Price | Curr | UOM | Valid From | Valid To
```

- **Plant is mandatory.** Execute button stays disabled until Plant is non-empty; on click, calls the new server fn.
- **USER_ID** = `profiles.sap_user_id` for the signed-in user, falling back to the config's request-field default (`NEOBMWCONS`). Shown read-only next to Plant.
- **Selection**: header checkbox toggles all visible rows; per-row checkbox toggles one. Selected state lives in component state, keyed by a stable row key (KEY_COMBINATION + CONDITION_TYPE + CUSTOMER + MATERIAL + PLANT).
- **Accept / Reject**: only enabled on the Pending tab when ≥1 row selected. Click → move selected rows from the in-memory `pending` set into `accepted` / `rejected` set, show `toast.success("3 rows accepted")`, clear selection. Decided rows then appear under the Accepted / Rejected tabs (still client-side only).
- **Status tabs**: filter the same fetched dataset by which local bucket the row is in (`pending` by default for every fetched row). URL `?status=` is preserved and back/forward still works (existing test stays green because `searchSchema` is unchanged).

## Server function

New file `src/lib/sd/price-approval.functions.ts`:

- `fetchPriceApprovals` — `createServerFn({ method: "POST" })` with `requireSupabaseAuth`, input `{ plant: string (min 1) }`.
- Inside handler (admin client, loaded with `await import("@/integrations/supabase/client.server")`):
  1. Look up the active `sap_api_configs` row named `Price_Approval_Fetch` (and its `sap_api_credentials`).
  2. Look up `profiles.sap_user_id` for `context.userId`; fall back to the config's `USER_ID` request-field default.
  3. Build URL: append `&PLANT=<plant>&USER_ID=<user_id>` to `endpoint_url` (the endpoint already has `?sap-client=300`).
  4. Honour `auth_type`:
     - `basic` → `Authorization: Basic base64(user:pass)` from credentials.
     - `proxy` → POST/GET via `middleware_url` with `x-shared-secret: process.env[proxy_secret_ref]`, mirroring `testSapConnection`'s pattern.
  5. Merge any `extra_headers` from credentials.
  6. `fetch()` the endpoint; on non-2xx, throw with status + truncated body.
  7. Parse JSON, read `DATA` array, map each item to a plain DTO using the configured response-field paths (lowercase keys: `select_flg`, `key_combination`, `condition_type`, `customer`, `price_group`, `plant`, `material`, `new_price`, `currency`, `uom`, `calculation_sc`, `valid_from_sc`, `valid_to_sc`, `old_price`).
  8. Insert one row into `sap_api_sync_log` (`status: ok|error`, `latency_ms`, `message`) — same pattern as `testSapConnection`.
  9. Return `{ rows: PriceRow[], fetched_at: ISO, count }`.

No DB schema changes. No mutation server fn yet (Accept/Reject is UI-only this round).

## Route + component

`src/routes/_authenticated/sd/price.tsx` is rewritten to host a dedicated `PricePage`:

- Keeps `validateSearch` with `status` enum (`pending|accepted|rejected`, fallback `pending`) — unchanged shape so existing test passes.
- Local state: `plant` (string), `userIdHint` (loaded via small companion server fn `getMySapUserId` or read from a profile query), `rows` (PriceRow[]), `decided` (`Map<rowKey, "accepted"|"rejected">`), `selected` (`Set<rowKey>`), `isFetching`, `lastFetchedAt`.
- Uses `useMutation` (TanStack Query) to call `fetchPriceApprovals`; on success, replace `rows`, clear `selected`, leave `decided` intact.
- Renders:
  - Header (title, T-code badge, single-level badge).
  - Selection card: Plant input (required), USER_ID readonly, Execute (disabled if !plant || isFetching), Reset.
  - Status tabs bound to `?status=` via `navigate({ search: prev => ({...prev, status})})` (same pattern as today).
  - Toolbar: "N selected" + Accept (variant default) + Reject (variant destructive), both disabled unless `status==='pending' && selected.size>0`.
  - Table with header checkbox + per-row checkbox, filtered by current bucket.
  - Empty state: "Enter a Plant and click Execute to load price approvals from SAP."

## Files touched

- **New** `src/lib/sd/price-approval.functions.ts` — `fetchPriceApprovals`, `getMySapUserId` server fns, shared `PriceRow` type.
- **Rewrite** `src/routes/_authenticated/sd/price.tsx` — dedicated component (no longer uses `SdApprovalShell`), preserves `searchSchema`.
- **Unchanged**: `src/components/sd/sd-approval-shell.tsx`, the other SD route files, the existing `sd-status-search.test.tsx`.

## Out of scope

- Posting decisions back to SAP (waiting on a second API config).
- Persisting decisions to `approval_documents` / audit log.
- Pagination / server-side filtering beyond Plant (the API only takes PLANT + USER_ID).
- XML/CSV payloads (response is JSON).