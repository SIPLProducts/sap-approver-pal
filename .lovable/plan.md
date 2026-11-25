# Fix Material dropdown wording

The Material dropdown on Financial Year Base Rate reuses the customer picker, so it shows "Search customer…", "Fetching customers…" etc.

## Changes
- Shared picker: add an optional `entityLabel` (default "customer") used for the button placeholder, search box, loading, error, empty and "no results" texts. Customer dropdowns stay exactly as today.
- Financial Year Base Rate Material column: pass `entityLabel="material"` so it shows "Select material…", "Search material…", "Fetching materials…", "Failed to load materials.", "No material found.", "No materials returned by Finance_Material_F4_API."

No API, data or behavior changes.
