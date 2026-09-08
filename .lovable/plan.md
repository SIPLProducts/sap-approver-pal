# MIGO Cancel — include selected items in the payload

The Cancel button on the MIGO Release screen will now send the material-document items of the rows you have ticked, in the shape SAP expects:

```text
{ "cancel": { "mblnr": "<doc number>", "mjahr": "<year>", "item": [ { "item": "2" } ] } }
```

## Server function (`src/lib/mm/migo-release.functions.ts`)

In `cancelMigo` only:

- Extend the input validator with `items: z.array(z.string().trim().min(1)).default([])`.
- Build the payload as:
  ```ts
  const payload = {
    cancel: {
      mblnr: data.mblnr,
      mjahr: data.mjahr,
      item: data.items.map((it) => ({ item: it })),
    },
  };
  ```
- Everything else stays exactly as today: MIGO_CANCEL config lookup, credentials/proxy handling, sync-log writes, response parsing (first array element, `TYPE`/`MESSAGE`, `ok = TYPE === "S"`).

## Screen (`src/routes/_authenticated/mm.migo-release.tsx`)

- In `onCancel()`, after the existing Material Document Number check:
  - Collect the Material Document Item (`MATDOC_ITM`) of every selected row.
  - Require at least one selected row when items exist (toast "Select at least one row to cancel" if none are ticked and rows are loaded).
  - Pass the item list along with `mblnr`/`mjahr` to the cancel call; if the list is empty (no items identifiable), the call still goes through with an empty `item` array so whole-document cancellation keeps working.
- Response popup, success screen-clear, and every other behaviour (Release, Display, Post, fetch, check, save) remain untouched.

## Untouched

`fetchMigo`, `checkMigo`, `saveMigo`, `postMigo`, the Post flow, validations, table columns, styling, and all other screens.

## Verification

Typecheck (`bunx tsgo --noEmit -p tsconfig.json`); confirm Release/Display still behave as before and Cancel sends the new payload shape.
