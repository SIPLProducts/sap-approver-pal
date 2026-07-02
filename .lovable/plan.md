## BMW Status Report: fix duplicate/incorrect results vs Postman

### Root causes identified
1. **Overlapping requests + stale response overwrite** — Enter key triggers `execute()` without an in-flight guard; sync log shows identical requests fired twice within seconds. Whichever response arrives last wins, so the screen can show stale/mixed data for the payload you tested in Postman.
2. **Middleware JSON "repair" corrupts values** — `safeParseSapJson` in `middleware/server.js` applies regex fixes for SAP's malformed JSON but also rewrites matches *inside string values*, altering real data.
3. **No exact request/response trace** — impossible to diff app vs Postman byte-for-byte.
4. **Direct-mode URL bug** — non-proxy branch sends the raw relative path instead of resolving it against the global SAP base URL.

### Changes

**1. `src/routes/_authenticated/sd.bmw-status.tsx` — request guard + stale-response protection**
- `execute()` returns early when `mutation.isPending` (covers Enter key path).
- Tag each request with an incrementing id; `onSuccess` ignores responses that aren't from the latest request — a slow older response can never overwrite a newer one.
- Show raw vs displayed row counts (e.g. "524 records · 12 exact duplicates from SAP") when duplicates exist.

**2. `middleware/server.js` — string-safe JSON repair + full trace**
- Replace the blind regex sanitizer with a state-machine repair that only patches empty values *outside* string literals, so real data is never rewritten.
- Log per invoke: exact outbound URL, method, payload SHA-256, response length, parsed row count, and whether repair was needed — everything needed to reproduce the identical request in Postman.

**3. `src/lib/sd/bmw-status-report.functions.ts` — trace + generic dedupe**
- Resolve the endpoint via `resolveSapUrl` in the direct (non-proxy) branch (same as the test-connection path).
- Detect exact duplicate rows (full-row JSON identity — no hardcoded fields), report `duplicates_removed` in the response, and record raw vs deduped counts in the sync log so we can prove whether duplicates come from SAP or the app.
- Store the outbound payload hash + row count in `sap_api_sync_log` for direct comparison with the middleware's log and Postman.

### Verification
- Run the report from the app, then compare the logged URL/payload hash/row count against a Postman call — they must match.
- Confirm rapid Enter+click no longer fires two requests (sync log shows one entry per execute).

### Out of scope
- No changes to SAP field mappings, column schemas, or Admin screens.
- No hardcoded data or filters anywhere.