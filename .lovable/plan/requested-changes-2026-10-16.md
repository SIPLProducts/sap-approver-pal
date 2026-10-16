## Requested changes

- In IWM plant multi-select fields, show only the selected WERKS code in the field itself. Preserve the existing IWM_PLANTS_F4 lookup, multi-selection, option labels, and API payload behavior.
- In Transportation (90%) Exception Billing, replace dynamic response columns with the requested ordered columns: Plant, Customer, Customer Name, Check Value, Remarks, Approved By, Update By, and Status. Map them to WERKS, KUNNR, NAME1, CHK_VALUE, REMARK, APPROV_BY, UPDATE_BY, and STATUS; never show MANDT or unrelated fields.
- Keep Check Value as a checkbox and Remarks as an editable input. Make each Customer and Customer Name cell editable using the screen’s existing 90%_CUST_API and 90%_CUSTNAME_API F4 integrations.
- Preserve the current screen design, Execute behavior, plant filter, SAP request, and unrelated functionality.

## Technical approach

- Limit implementation to the shared PlantMultiSelect display and the Transportation Exception Billing screen.
- Keep existing SAP API configuration lookups and reuse the existing CustomerSelect behavior for row-level customer editing, updating the selected response row without changing the Execute request.
- Validate with the project typecheck/build signal and inspect the Transportation screen behavior after changes.
