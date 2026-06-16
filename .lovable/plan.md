# Fix result dialog after Accept/Reject

The SAP response uses `MSG` (not `MESSAGE`) and `TYPE` arrives as a SAP icon code like `@02@` (not `S`/`E`/`W`). The current dialog therefore shows empty rows and the wrong tone (success vs error).

## Changes — `src/routes/_authenticated/sd.contract.tsx` only

No backend, schema, or business-logic changes. Pure presentation fix in the existing `ResultDialog`.

### 1. Update `SapMsg` type
```
type SapMsg = {
  TYPE?: string;
  CUSTOMER?: string;
  CONTRACT?: string;
  MSG?: string;
  MESSAGE?: string; // keep as fallback
};
```

### 2. SAP icon-code → severity mapper
Map both icon codes and letter codes:
- `@01@`, `@5B@`, `S` → success
- `@02@`, `@09@`, `W` → warning
- `@03@`, `@5C@`, `@AY@`, `E`, `A` → error
- `@04@`, `@08@`, `I` → info
- anything else → info (neutral)

Use this mapper in two places:
- `tone` computation for the banner (error if any row maps to error, else warning if any warning, else success).
- Per-row badge (S/W/E/I) instead of printing the raw `@02@`.

### 3. Row layout (flat list, one row per message)
Columns shown per row:
- Severity badge (color by mapped type)
- `CUSTOMER`
- `CONTRACT` (contract no.)
- `MSG` (fallback to `MESSAGE` if `MSG` missing)

### 4. Header count
Show `{success} ok · {warning} warn · {error} err` summary line above the list when there are messages.

### 5. `onSuccess` extraction (no behavior change, just guard)
Keep the existing extraction: `inner?.MESSAGE ?? inner?.message ?? inner?.Messages ?? sap?.MESSAGE ?? []`. The new dialog reads `MSG` from each row, so the array of objects shown in your sample will render correctly.

## Out of scope
- No change to `submitContractDecision` server fn.
- No change to middleware logging.
- No change to the SAP payload or table.

## Result
For your sample response, the dialog will show two rows like:

```
[W] 0001060033   44100070   SD document 44100070 is not in the database or has been archived-Not Released
[W] 0001060033   44100070   SD document 44100070 is not in the database or has been archived-Not Released
```

Banner tone = Warning (since `@02@` → warning), title "Completed with warnings".
