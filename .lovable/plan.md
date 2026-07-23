## Goal
Add F4 dropdown for the Rating column in the ZNFA Rating output table's Ratings section, populated from `ZNFA_RATINGS_F4s_API`. Show dropdown only in Rate/Change modes; keep Display mode read-only.

## Changes

### 1. `src/lib/mm/gate-process.functions.ts`
Add a new server function `fetchZnfaRatingF4` that:
- Reads the `ZNFA_RATINGS_F4s_API` sap_api_configs row (config name constant).
- Calls SAP via proxy/basic, same pattern as `fetchGateProcess`.
- Parses response array `[{ "VEN1_RATE1": "T1" }, ...]` — extracts the value from whatever the single key is per row (case-insensitive), dedupes, returns `{ options: string[], error: string | null }`.

### 2. `src/routes/_authenticated/mm.gate-process.tsx`
- Add `useQuery` for rating F4 options, enabled only when `isEditable && output?.RATINGS?.length > 0`. Query key includes `lastAction` so it refetches on Rate/Change.
- Replace the RATE `<Input>` in the Ratings table with a shadcn `<Select>` when `isEditable`:
  - Options from the query result.
  - Value bound to `rt.RATE`; onChange updates `ratings[idx].RATE`.
  - Falls back to plain `<Input>` if the query returned no options (so users aren't blocked).
- Display mode keeps the read-only span (unchanged).
- Vendor column stays as input in editable modes (unchanged).

## Response parsing detail
Since keys vary (`VEN1_RATE1`, possibly `VEN2_RATE1`, etc.), extract `Object.values(row)[0]` per row and coerce to string; skip empty values.

## Out of scope
- No changes to Items table, header fields, or Attachments view.
- No changes to save payload shape (RATE string still submitted as-is).
