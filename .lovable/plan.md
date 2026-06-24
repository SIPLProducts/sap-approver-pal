# Fix: Middleware URL behaving inconsistently across ngrok URLs

## Root cause (verified — nothing is hardcoded)

I searched the entire codebase for `ngrok`, `donation-pantyhose`, `worsening-doodle`, and `middleware_url`. There is **no hardcoded middleware URL anywhere in the app** — every SAP call reads the URL from the database at runtime.

The real cause is a **per-API override sitting in the database** that silently wins over the global Middleware Configuration you edit on the SAP API Settings screen.

Every approval flow (Price, Contract, Sales Order, Service Certificate) resolves the middleware URL with this rule:

```
effectiveUrl = sap_api_configs.middleware_url  // per-API override
            ?? sap_global_settings.middleware_url  // global setting
```

Checking the data right now:

- `sap_global_settings.middleware_url` = `https://donation-pantyhose-starter.ngrok-free.dev`
- `sap_api_configs` row **`Price_Approval_Fetch`** has its own `middleware_url` = `https://donation-pantyhose-starter.ngrok-free.dev` (stale)
- All other API rows have `middleware_url = NULL` (correctly falling back to global)

So when you change the global URL to a fresh ngrok (e.g. `worsening-doodle-floral.ngrok-free.app`):

- Contract / Sales Order / Service Certificate approvals → use the new global URL → work.
- Price approval (Fetch) → still hits the stale `donation-pantyhose-starter.ngrok-free.dev` from the per-API override → "works for a while then stops" / 404.

There is also a subtle issue: the working URL you mentioned ends in `.ngrok-free.app`, but the stored one ends in `.ngrok-free.dev`. Different TLD = different (dead) tunnel.

## Fix

Two parts — one data cleanup, one code change so this can't recur.

### 1. Data cleanup (one SQL migration)

Null out every per-API `middleware_url` so all APIs fall back to the single global setting:

```sql
UPDATE public.sap_api_configs SET middleware_url = NULL;
```

After this, only the value in **SAP API Settings → Middleware Configuration** controls where SAP calls go, exactly as you expect.

### 2. Code change — stop using the per-API override

In all five server modules, change the resolution to use the **global setting only** and ignore `cfg.middleware_url`:

- `src/lib/sd/price-approval.functions.ts` (2 spots)
- `src/lib/sd/contract-approval.functions.ts` (2 spots)
- `src/lib/sd/sales-order-approval.functions.ts` (2 spots)
- `src/lib/sd/sc-so-approval.functions.ts` (2 spots)
- `src/lib/admin/sap-api.functions.ts` (test-connection path already uses global only — leave as is)

Replace:

```ts
const middlewareUrl =
  (cfg.middleware_url && cfg.middleware_url.trim()) ||
  (globalSettings?.middleware_url?.trim() ?? null);
```

with:

```ts
const middlewareUrl = globalSettings?.middleware_url?.trim() || null;
```

Also drop `middleware_url` from the `sap_api_configs` select in those same files (cosmetic, keeps the query tight).

### 3. Admin UI — hide the per-API middleware URL field

`src/routes/_authenticated/admin.sap-api.$id.tsx` currently exposes a per-API "Middleware URL" input that re-introduces the same drift. Remove that field from the form so the only place to set it is **SAP API Settings → Middleware Configuration**. The DB column stays (for backward compatibility) but is no longer writable from the UI and no longer read by the runtime.

## Result

- No hardcoded URLs anywhere (already true, confirmed).
- A single source of truth: `sap_global_settings.middleware_url`.
- Changing the global URL takes effect immediately for every approval flow.
- Any valid ngrok URL (`.ngrok-free.app`, paid custom domain, self-hosted) will work consistently.

## Technical notes

- Migration is a single `UPDATE` — safe, idempotent, no schema change.
- Code change is mechanical (~10 edits across 4 files).
- No change to `sap_global_settings` schema or to the Middleware Configuration screen you're already using.
- After deploy, re-test by saving a fresh ngrok URL in Middleware Configuration and running a Price approval (the one that was failing).
