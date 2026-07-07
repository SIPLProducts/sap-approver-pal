## Goal

Release code columns (`REL_1`, `REL_2`, and any future `REL_*`) must render the raw SAP value verbatim — e.g. `22011840` — not reformatted as a date (`18.11.2201`).

## Cause

`buildDynamicColumns()` in `src/lib/sd/dynamic-columns.tsx` runs date detection before it consults the text-forced list. `REL_1`/`REL_2` are already in `FORCE_TEXT_KEYS`, but any 8-digit value passes `isDateLike`, so `looksDate` wins and the cell gets `fmtDate()` applied.

## Change

`src/lib/sd/dynamic-columns.tsx`: make text-forced keys short-circuit date detection too.

Replace:

```ts
const looksDate = !forcedNumeric && samples.length > 0 && samples.every(isDateLike);
```

with:

```ts
const looksDate = !forcedNumeric && !forcedText && samples.length > 0 && samples.every(isDateLike);
```

No other logic changes — numeric-detection already respects `forcedText`, and the render path already falls through to `String(v)` when neither `looksDate` nor `looksNumeric` is true.

## Out of scope

- No changes to the column set, headers, or any other screen.
- No changes to genuine date columns (`so_creation_date`, etc.) — they remain formatted.

## Verification

- `tsgo` typecheck.
- Load a Contract or Sales Order report where `REL_1`/`REL_2` contain an 8-digit value; the cell must show the exact digits (`22011840`), not a date.
