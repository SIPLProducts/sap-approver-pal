## Goal

On the **Contract Approvals**, **Service Certificate & SO Approvals**, and **Sales Order Approvals** selection screens, add a new field **Search Term** immediately after the Customer field. The field uses F4 help sourced from the `Get_Search_Term` API (configured in Admin → SAP API Settings) and supports selecting multiple values.

## Changes

### 1. New server function — `src/lib/sap/search-term.functions.ts`
Mirror `getCustomerConfig`: look up the active `sap_api_configs` row named `Get_Search_Term` and return its `configId` (or `null` when missing/inactive). Auth-protected via `requireSupabaseAuth`.

### 2. New component — `src/components/sap/search-term-multi-select.tsx`
Reusable multi-select F4 dropdown (same visual pattern as `PlantMultiSelect` + `CustomerSelect`):
- Loads config via `getSearchTermConfig`, then calls `runSapApi` with `configId` and any active `PLANTS` context.
- Extracts options from the SAP response using tolerant key detection (`SORTL` / `SEARCH_TERM` / `SEARCHTERM` for code, `DESCRIPTION` / `NAME` for optional label).
- Renders checkboxes with search input; `value: string[]`, `onChange(next: string[])`.
- Trigger shows "N selected" summary; "Select all" / "Clear" controls.
- Graceful fallback: when config is missing → comma-separated text input; when SAP returns nothing → informative empty state (same UX as `CustomerSelect`).

### 3. Wire the field into the three screens
Files: `src/routes/_authenticated/sd.contract.tsx`, `src/routes/_authenticated/sd.sales-order.tsx`, `src/routes/_authenticated/sd.sc-so.tsx`.

For each:
- Add `const [searchTerms, setSearchTerms] = useState<string[]>([])`.
- Insert a new grid cell **directly after** the Customer cell in the SELECTION SCREEN card:
  ```tsx
  <div className="space-y-1.5">
    <Label className="text-xs">Search Term</Label>
    <SearchTermMultiSelect value={searchTerms} onChange={setSearchTerms} plants={plants} />
  </div>
  ```
- Pass `search_terms: searchTerms` through the fetch mutation `vars` and the corresponding server fn call.
- Include `search_terms` in `reset()` (clear to `[]`).

### 4. Extend fetch server functions
Files: `src/lib/sd/contract-approval.functions.ts`, `src/lib/sd/sales-order-approval.functions.ts`, `src/lib/sd/sc-so-approval.functions.ts`.

- Extend the zod input schema with `search_terms: z.array(z.string().trim().min(1)).max(100).optional()`.
- When non-empty, forward to the SAP fetch API payload as `SEARCH_TERMS` (array) **and** `SORTL` (first value) for backend compatibility with either convention. Existing `customer_from` / `customer_to` handling is untouched.

### 5. Reports screens (out of scope)
Not modified this pass. If the same filter is later needed on `sd.contract-reports.tsx`, `sd.sales-order-reports.tsx`, `sd.sc-so-reports.tsx`, we can add it symmetrically — flag if you want it done now.

## Assumption to confirm during build
The `Get_Search_Term` API returns rows keyed by `SORTL` (SAP standard) with optional description. The extractor will accept `SORTL` / `SEARCH_TERM` / `SEARCHTERM` interchangeably; if your API uses a different key, tell me the field name and I'll pin it.

## Out of scope
- No changes to approval decision / submit payloads.
- No DB or RLS changes (the API config is already administered via `sap_api_configs`).
- No changes to the Reports variants of these screens.
