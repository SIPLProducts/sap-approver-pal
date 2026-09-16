# ZGP Cancel: Guarantee `user_name` in SAP Payload

## Confirmed current state

- The active `ZGP_CANCEL_REPORT` service uses `PUT` and recent cancel calls have reached it successfully.
- The current code intends to add `user_name` inside the `cancel` object, but existing request logs do not preserve the outgoing field names, so they cannot confirm the exact serialized body SAP received.

## Fix

1. Refactor the ZGP cancel payload construction into one strict builder that creates the exact required structure for every selected record:

```text
{
  "cancel": {
    "user_name": "<signed-in SAP user ID>",
    "type_from": "...",
    "type_to": "...",
    "number_from": "...",
    "number_to": "...",
    "material_from": "...",
    "material_to": "...",
    "date_from": "...",
    "date_to": "...",
    "plant_from": "...",
    "plant_to": "...",
    "vendor_from": "...",
    "vendor_to": "...",
    "type": "...",
    "unique": "...",
    "material": "...",
    "DESCRIPTION": "..."
  }
}
```

2. Resolve the signed-in SAP user ID on the authenticated server before building the payload. Treat an empty ID as an error and do not call SAP.
3. Validate the completed payload immediately before transmission so `cancel.user_name` cannot be missing or blank in either direct or middleware mode.
4. Add a focused automated test for the payload builder, checking the exact key name, nesting, value, field order, and preservation of all existing filter and selected-row fields.
5. Add a safe request audit marker recording that `cancel.user_name` was present, without recording the user ID itself.

## Scope preserved

- Keep the ZGP API service, method, endpoint, selected-row behavior, confirmation popup, SAP response messages, filters, result refresh, and all other screens unchanged.

## Verification

- Run the focused payload test and project type check.
- Trigger ZGP Cancel and confirm the audit marker reports `user_name_present=true` for the outgoing SAP request.
