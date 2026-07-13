## Plan

1. **Fix Search Term response parsing**
   - Update the Search Term option extractor so the middleware response shape `[{ SEARCH_TERM: "..." }]` is always recognized.
   - Also handle common wrapper shapes returned by the generic SAP invoker, such as `data`, `DATA`, and nested `data.data`, so options display even if the middleware wraps the SAP response.

2. **Keep Search Term as an input field**
   - Keep the visible control as a normal text input so users can type one or more terms manually.
   - Open the F4 help from keyboard `F4` and by interacting with the input area, but remove the separate magnifier/search/dropdown button.

3. **Match Customer field styling**
   - Use the same height, border, width, typography, disabled/loading treatment, popover width, and command-list styling as the Customer field.
   - Do not show search, dropdown, or chevron icons in the Search Term field.

4. **Preserve multi-select behavior**
   - Keep checkboxes inside the F4 popup for selecting multiple search terms.
   - Keep Apply/Cancel controls so manual typed values and selected F4 values merge into the comma-separated input.

5. **Validate**
   - Add or update a focused test for `extractSearchTermOptions` with the provided response structure.
   - Verify the Search Term field renders without icons and the parsed options include `PWMP-1180`, `LUCKY ENGINEERS`, and `ARORA REFRACTORIES`.