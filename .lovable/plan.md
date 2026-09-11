# ZGP Report — Cancel selected records

Wire the existing Cancel button on the ZGP Report results to the SAP cancel service, mirroring the ZMC Report cancel pattern. Nothing else on the screen changes.

## Behaviour

- Select one or more records, then click Cancel.
- A confirmation asks before cancelling (same style as ZMC / Reject confirmations).
- Each selected record is sent to SAP one at a time. Every request carries the twelve lowercase filter values currently applied on the screen plus the record's own identifying fields.
- The result popup lists one line per record with the exact MESSAGE SAP returns, marked success or error, using the standard response popup.
- After any successful cancellation the selection is cleared and the report is re-executed with the same filters so updated cancel status shows.
- If nothing is selected the button stays disabled as it does today.

## Payload shape (per selected row)

```text
PUT { cancel: {
        type_from, type_to, number_from, number_to,
        material_from, material_to, date_from, date_to,
        plant_from, plant_to, vendor_from, vendor_to,
        type:        row.TYPE,
        unique:      row.UNIQUE_NO,
        material:    row.MATERIAL,
        DESCRIPTION: row.DESCRIPTION
      } }
```

Success: `TYPE = "S"` (e.g. "Document Cancelled Successfully"). Failure: `TYPE = "E"` / `A` or `STATUS` false.

## Not changed

Filters, date pickers, Execute, Reset, column building, search, pagination, page size, permissions, the ZGP fetch service, other MM/SD/IWM screens, and all other APIs stay exactly as they are.

## Technical notes

- New `cancelZgpRecords` in `src/lib/mm/zgp-report.functions.ts`, mirroring `cancelZmcRecords`: resolve the `ZGP_Cancel_Report` row from `sap_api_configs` by name, honour `is_active`, `http_method` (PUT), `auth_type`, credentials, extra headers, direct-vs-proxy routing via `sap_global_settings`/`sap_global_secrets` with `/sap/raw-invoke` + `raw: true`; log each call to `sap_api_sync_log`.
- Input: the twelve ZGP filter values plus an array of raw row objects. Filter keys stay lowercase; row fields are mapped from the raw SAP row (`TYPE`, `UNIQUE_NO`, `MATERIAL`, `DESCRIPTION`) — no other hardcoded values.
- `mm.zgp-report.tsx` currently normalises display rows (placeholder dash cleanup). Keep the untouched raw rows in a parallel state (as done in `mm.zmc-report.tsx`) so the placeholder normalisation never leaks into the cancel payload.
- Reuse `extractSapMsg`; treat `TYPE` `E`/`A` or `STATUS` false as failure, `S` as success. Return `{ ref, message, ok }` per row (ref = `UNIQUE_NO`) for `SapResponseDialog`.
- `mm.zgp-report.tsx`: keep the last executed filters in state, add a mutation for the cancel fn, wire the existing Cancel button with `swalConfirm` (loading state while running), show results in `SapResponseDialog`, then re-run the report on any success.
- Verification: `bunx tsgo --noEmit -p tsconfig.json`.
