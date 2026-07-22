## Diagnosis (verified from middleware logs)

The middleware log line
```
[/sap/invoke] sap status=200 ... body= {"pr_number":"1000056124","pr_date":"2026-06-29","ter_sub_id":"TER2026/300011"}
```
is the **mapped** body, not what SAP actually returned. `invokeSap` runs the SAP response through `mapSapResponse(cfg.responseFields, raw)` (middleware/server.js:547).

`mapSapResponse` (middleware/response-mapper.js) behavior:
- If any configured field starts with `[].` → return raw (untouched).
- Else if response is `{DATA:[…]}` / `{data:[…]}` / array → return raw.
- Otherwise → build a NEW flat object containing only the configured `field_name` paths.

The ZNFA_Create_API config in `sap_api_configs.response_fields` currently has just `pr_number`, `pr_date`, `ter_sub_id` (flat, no `[].`), so the mapper strips `OUTPUT`, `ITEMS`, and `RATINGS` before returning. The client handler (`src/lib/mm/gate-process.functions.ts:351`) then reads `sapJson?.OUTPUT ?? sapJson?.output ?? {}` and gets `{}`, so the ITEMS/RATINGS tables render empty and downstream code errors.

Also, the client handler currently looks only at uppercase `OUTPUT`, but SAP for ZNFA returns lowercase top-level keys (`pr_number`, `items`, `ratings`) based on the mapped output we can see.

## Fix

**1. `src/lib/mm/gate-process.functions.ts` — `createZnfa` handler**

- When calling via proxy, add a flag in the request body telling middleware to skip response mapping for this call: `{ configId, inputs: payload, raw: true }`.
- Read the SAP response defensively:
  - `const root = proxied ? (json?.data ?? {}) : json;`
  - `const output = root?.OUTPUT ?? root?.output ?? root;` (fall back to root itself, since SAP returns keys at top level for ZNFA)
  - Build `ZnfaOutput` by case-insensitive picking of `PR_NUMBER/pr_number`, `PR_DATE/pr_date`, `TER_SUB_ID/ter_sub_id`, `ITEMS/items`, `RATINGS/ratings`, and per-item fields (`MATERIAL/material`, etc.). No change to the exported `ZnfaOutput` type shape.

**2. `middleware/server.js` — `/sap/invoke`**

- Extend `InvokeBody` zod schema with `raw: z.boolean().optional()`.
- When `raw === true`, call `invokeSap` and return the un-mapped SAP JSON (skip `mapSapResponse`). Concretely, inside `invokeSap` accept an options arg `{ skipMapping }` and, when true, set `data = raw` instead of `data = mapSapResponse(...)`. Everything else (logging, latency, HTML detection, JSON repair) stays the same.
- Behavior for existing callers is unchanged — they don't pass `raw`.

**3. Verification**

- After deploying middleware + app changes, click Rating on ZNFA screen; middleware `raw sap body` log line already prints the pre-mapping SAP body. Confirm it contains the `ITEMS`/`RATINGS` (or lowercase equivalents), and that the ZNFA screen response card populates the two tables.
- Regression check: Search Term F4 and other SAP screens still work (they don't pass `raw`, so mapping path is unchanged).

## Non-goals

- No DB / `sap_api_configs.response_fields` edits — leaves other integrations untouched.
- No UI changes on the ZNFA Rating screen beyond what already exists.
