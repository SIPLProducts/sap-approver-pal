# ZGP Report — ensure USER_NAME reaches SAP Cancel

## Goal
Ensure ZGP Report cancellation always sends the signed-in SAP user ID as the first `user_name` key inside `cancel`, matching the requested payload, while preserving filters, selected-row fields, API routing, responses, and refresh behavior.

## Steps
1. Verify the live cancel request boundary and confirm whether the value is lost in the screen-to-server call or while forwarding through the raw SAP proxy.
2. Harden the ZGP cancel input so a blank or omitted user ID cannot silently produce a request without a usable `user_name` value.
3. Keep the signed-in SAP ID resolution from the SAP profile, with the existing authenticated-user metadata fallback and sign-in prompt when unavailable.
4. Confirm the server builds `cancel` with `user_name` first, preserves all twelve filters and raw selected-row fields, and forwards the same object unchanged in direct and proxy modes.
5. Typecheck and verify the resulting request shape and existing cancellation/refresh behavior.

## Technical details
- Update only the ZGP report screen and `cancelZgpRecords` server function unless request tracing identifies the shared forwarding layer as the source of loss.
- Do not change fetch filters, row selection, confirmation, SAP response handling, permissions, or other report APIs.
- Expected per-row shape:

```text
{ cancel: { user_name, type_from, type_to, number_from, number_to,
  material_from, material_to, date_from, date_to, plant_from, plant_to,
  vendor_from, vendor_to, type, unique, material, DESCRIPTION } }
```
