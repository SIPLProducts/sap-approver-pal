## What's actually happening

The toast in your screenshot reads `SAP returned 524 <none>: error code: 524`. That text is produced in `src/lib/sd/bmw-status-report.functions.ts` from the HTTP status of the app's outbound call to the middleware URL. So SAP itself never answered the app — an edge/reverse proxy in front of the middleware cut the connection:

- **524** is a Cloudflare edge timeout (~100 s hard cap on a proxied hostname).
- `nginx/middleware-prod.conf` and `nginx/middleware-quality.conf` set `proxy_read_timeout 60s` / `proxy_send_timeout 60s`, so nginx also gives up long before the middleware's own `SAP_REQUEST_TIMEOUT_MS` of 120 s.

Postman succeeds because it calls the endpoint without those 60 s / 100 s proxy caps and will happily wait several minutes.

Confirmed from the code: dates and customer/contract ranges are already passed through to SAP; there is no missing filter. The problem is purely call duration for the full BMW dataset.

## Fix — three parts

### 1. Stop the proxies cutting the call (infra config)
- `nginx/middleware-prod.conf` + `nginx/middleware-quality.conf`: raise `proxy_read_timeout` / `proxy_send_timeout` to `300s`, add `proxy_connect_timeout 30s` and `send_timeout 300s`.
- Document in `DEPLOYMENT.md` that the middleware hostname must be **DNS-only (grey cloud) in Cloudflare**, or fronted by a Cloudflare tunnel/Enterprise setting — an orange-clouded hostname can never exceed ~100 s regardless of nginx settings.

These two alone remove the 524 for medium result sets, but a truly huge pull will still be slow, so:

### 2. Chunk the fetch by created-date window (app change)
Keep the same UI. In `src/routes/_authenticated/sd.bmw-status.tsx`, when both "Contract/sales created from/to" are filled and the span is larger than a configurable window (default **1 month**), the Execute handler issues the existing server function once per window, sequentially:

- rows accumulate into the table as each window returns, so the user sees data progressively instead of a blank screen;
- the Execute button shows `Fetching… (2/7)`;
- a per-chunk failure is reported but does not discard already-loaded rows;
- exact-duplicate removal already done server-side is repeated across the merged set client-side, so rows appearing in two windows are not double-counted.

If the date range is empty or short, behavior is exactly as today (a single call).

### 3. Guardrail message
If a chunk still returns 502/504/524, the error toast will say plainly that the SAP call exceeded the gateway timeout and suggest narrowing the date range — instead of the raw `error code: 524`.

## Not changed
Server-side business logic in `src/lib/sd/bmw-status-report.functions.ts` (payload shape, dedupe, sync logging), the SAP config, the middleware's SAP request logic, and the report's columns/layout all stay as they are. The function gains no new parameters — chunking reuses the existing `contract_from` / `contract_to` inputs.

## Technical notes
- Files touched: `src/routes/_authenticated/sd.bmw-status.tsx`, `nginx/middleware-prod.conf`, `nginx/middleware-quality.conf`, `DEPLOYMENT.md`.
- The nginx changes require redeploying/reloading the middleware host to take effect; the Cloudflare grey-cloud change is a DNS-panel action on your side.
