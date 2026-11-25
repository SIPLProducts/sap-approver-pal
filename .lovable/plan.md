# Fix: Material F4 shows "No materials returned by SAP" even though middleware receives data

## What is happening
- The middleware terminal shows SAP's material list, so SAP and the middleware are fine.
- The dropdown only shows options if the response reaches the screen as a list of rows with `MATNR`.
- The likely cause: SAP sends this response as text (not marked as JSON), so it arrives in the app as one long text string instead of a list. The dropdown reader ignores text, finds zero rows, and shows "No materials returned by SAP".
- A second case seen earlier: SAP replies with the message "Data is not available", and the dropdown hides that message behind the same generic text.

## Changes (Material dropdown reader only, no API or payload change)
1. Before reading options, if the response is text, try to read it as JSON (also handle text wrapped in extra quotes). If it becomes a list or an object holding a list, use it.
2. Accept a single object with `MATNR` (one material) as a one-item list.
3. When SAP returns a message instead of rows (e.g. "Data is not available") or the call fails, show that exact SAP message in the dropdown instead of the generic text.
4. Add a temporary console line showing the response shape the app received, so if it still fails we can see it immediately in your browser.

## Verify
- Open Financial Year Base Rate, plant 3601, New Record, open Material: list of MATNR values appears and picking one fills the row.
- Customer dropdowns on other screens keep working unchanged (same reader, only additional formats accepted).

## Technical details
- File: `src/components/sap/customer-select.tsx` — `extractCustomerOptions` gets a string/JSON normalizer; query surfaces `resp.ok === false` / string `data` as an error message.
- No changes to middleware, SAP API Settings, request payload `{ material: "" }`, or other screens.
