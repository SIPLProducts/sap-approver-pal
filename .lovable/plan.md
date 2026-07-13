## Plan

### 1. Fix Search Term value mapping
The current extractor sorts codes alphabetically and normalizes by uppercased key aliases. The user wants the exact SAP response order and values shown. Change `extractSearchTermOptions` to:
- Only consume the `SEARCH_TERM` field (drop the alias list) so it always mirrors what SAP actually returned.
- Preserve the SAP response order (no `sort`), dedupe by exact string.
- Keep the response-envelope unwrapping (`data.data`, JSON-string payloads) so the middleware wrapper still works.

### 2. Restyle the Search Term field to match Customer
Rebuild `SearchTermMultiSelect` to look exactly like `CustomerSelect`:
- Replace the `<Input>` trigger with a `Button` (`variant="outline"`, `role="combobox"`, `h-9 w-full justify-between`) whose label shows the selected codes (comma-joined) or the placeholder.
- Show a `ChevronsUpDown` icon on the right, just like `CustomerSelect` (user asked to match Customer field exactly; Customer keeps this chevron). No search icon, no F4 button, no manual text input.
- Clicking the trigger opens the popover directly (no F4 keybinding needed anymore).
- `PopoverContent` uses the same sizing/classes as Customer.

### 3. Remove Apply / Cancel from dropdown
- Delete the footer row containing the Apply / Cancel buttons and the "N selected" counter.
- Selecting a row toggles it and immediately calls `onChange` with the updated list (no draft state, no apply step).
- Keep the "Select all / Clear all" `CommandItem` at the top, but have it act on the committed value directly.

### 4. Tests
Update `search-term-multi-select.test.ts`:
- Keep the SAP-shape test but assert the returned options preserve SAP order (`PWMP-1180`, `LUCKY ENGINEERS`, `ARORA REFRACTORIES`) and only use `SEARCH_TERM`.
- Keep the envelope-unwrap and parse-error tests.

### Files touched
- `src/components/sap/search-term-multi-select.tsx` — extractor + full UI rewrite to mirror `CustomerSelect`.
- `src/components/sap/search-term-multi-select.test.ts` — update order expectation.

No middleware or server-function changes.
