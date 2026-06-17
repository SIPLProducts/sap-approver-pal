## Goal

Plant field on every SD approval screen (Price, Contract, Service Cert, Sales Order, SC-SO) must be a searchable dropdown populated from the `Get_Plant` SAP config, and we need to find out why the current call returns nothing.

## What's already in place

- `PlantSelect` (searchable Popover + Command) is wired into `SdApprovalShell` — which Price / Contract / Sales Order all use — and into `sd.sc-so.tsx`. So Plant is already a dropdown on all four screens.
- `Get_Plant` config exists in DB: `GET http://10.150.150.154:8103/sd_approval_mng/f4_help/help?sap-client=300`, basic auth, no required request fields. Middleware request log shows `POST /sap/invoke` with the right configId arrives.

## Why the dropdown shows nothing

The middleware log stops after `[request] body= …` — `/sap/invoke` (generic route) never logs the SAP call URL, status, or body. Only named alias routes (e.g. `/service_certificate/Fetch`) log the SAP side. So we cannot tell whether SAP returned `[]`, `{DATA:[...]}`, `{PLANT_LIST:[...]}`, HTML, or an error. `extractPlants` only knows three shapes (top-level array, `DATA`, `data.DATA`) — if SAP wraps the rows under any other key, the client silently sees zero plants.

## Plan

### 1. Add full request/response logging to `/sap/invoke` (middleware/server.js)

In the existing `/sap/invoke` handler, after `loadConfig(configId)` log the resolved config (name, id, url, method) and inputs — same shape as the named routes already log. After `invokeSap` log `sap status=… latency=… body=<preview 800 chars>`. This is the only way to see what SAP actually returns for Get_Plant.

### 2. Make `extractPlants` resilient (src/components/sap/plant-select.tsx)

Generalize row discovery so any object shape works:
- accept top-level array, `DATA`, `data`, `data.DATA`, `ITEMS`, `RESULTS`, or — as a fallback — the first array-valued property on the response.
- per row, pull the first non-empty value among: configured `plantField`, `VKORG`, `WERKS`, `PLANT`, `Plant`, `Werks`, `Vkorg`, `plant`, `werks`.

### 3. Surface failures to the user

In `PlantSelect`:
- when `plantsQuery.isError`, show the error message (not just "Failed to load plants"), so config / network errors are visible in-app.
- when `plants.length === 0` after a successful fetch, show "No plants returned by Get_Plant — check SAP API Settings".

### 4. Verification

After restarting the middleware, click the dropdown on the Service Certificate screen. The middleware log will now print the SAP URL, status, and a body preview for `/sap/invoke`. Two outcomes:
- SAP returns rows → dropdown populates (the broader `extractPlants` handles whatever wrapper SAP uses).
- SAP returns `[]` / non-200 / HTML → the new in-UI error message plus middleware log pinpoints whether to fix the endpoint URL, auth, or sap-client param in `sap_api_configs.Get_Plant`.

No changes are needed to the SD screens themselves — they already render `PlantSelect` via the shared shell.

## Technical notes

- Files touched: `middleware/server.js` (logging block in `/sap/invoke`), `src/components/sap/plant-select.tsx` (extractor + error UI). No DB or schema changes.
- The middleware must be restarted on the ngrok host after the edit; the app side hot-reloads on its own.
