## Goal

Make the Customer F4 help behave exactly like the Plant F4 (single combobox with searchable dropdown showing `code — name`, check mark on selected), and add it to the BMW Status Report screen for both Customer From and Customer To.

## Changes

### 1. Rewrite `src/components/sap/customer-select.tsx` to mirror `PlantSelect`

Replace the current Input + search-button pattern with the same Popover/Command combobox used by `PlantSelect`:

- Trigger: a single `<Button variant="outline" role="combobox">` showing `"{code} - {name}"` when a value is selected, or the placeholder otherwise, with a `ChevronsUpDown` icon.
- Popover content: `<Command>` with built-in `<CommandInput>` search (client-side filtering, `shouldFilter` left to default like PlantSelect — no debounced server refetch on keystroke).
- Items: `<Check>` marker + monospace code + muted `— name` text; selecting the same value clears it (toggle), matching PlantSelect.
- Loading / error / empty states identical in look to PlantSelect (Loader2 spinner, destructive error block with Retry, "No customers returned by Customer_Fetch_API" empty state).
- Fetch behavior: one call to `Customer_Fetch_API` via `runSapApi`, keyed by `[configId, plants]`, cached (5 min stale). Send `{ PLANT: plants[0], PLANTS: plants, VKORG: plants[0] }` when plants are supplied, otherwise no plant filter. Drop the per-keystroke `SEARCH` input — search is client-side.
- Fallback to plain `<Input>` when `Customer_Fetch_API` config is missing/inactive (same as today, same as PlantSelect).
- Keep the `plants` and `onEnter` props so existing SD Contract / Sales Order / SC-SO usages keep working unchanged.

### 2. Wire Customer F4 into `src/routes/_authenticated/sd.bmw-status.tsx`

- Import `CustomerSelect`.
- Replace the plain `<Input>` for **Customer From** with `<CustomerSelect value={customerFrom} onChange={setCustomerFrom} plants={salesOrgFrom ? [salesOrgFrom] : []} onEnter={execute} placeholder="Select customer…" />`.
- Replace the plain `<Input>` for **Customer To** the same way, bound to `customerTo` / `setCustomerTo`.
- No changes to payload wiring, mode radios, table, or report fetch — `customer_from` / `customer_to` continue to flow into `fetchBmwStatusReport` unchanged.

## Out of Scope

- No changes to `Customer_Fetch_API` server config, `getCustomerConfig`, `runSapApi`, or any migrations.
- No changes to Contract / Sales Order / SC-SO screens beyond what they already have (they pick up the new combobox behavior automatically via the rewritten `CustomerSelect`).
- Price Approval screen remains excluded per prior scope.
