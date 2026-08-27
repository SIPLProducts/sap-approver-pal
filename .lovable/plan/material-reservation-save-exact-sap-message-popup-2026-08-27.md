# Material Reservation Save — exact SAP MESSAGE popup

## Goal
When Save returns a response containing `MESSAGES: [{ TYPE: "E", MESSAGE: "..." }]`, the popup must show **only** that exact `MESSAGE` value. No generic "Save failed" text, no extra response keys.

## Current state (verified)
- `src/lib/mm/material-reservation.functions.ts` already uses `collectSapMessages` and `extractMessagesArrayError` from `src/lib/mm/sap-message.ts` in the save handler.
- `src/routes/_authenticated/mm.material-reservation.tsx` renders the result through `SapResponseDialog`, passing `response: res` today.

## What this plan will do
1. Verify the save handler's recursive extraction covers the exact shape the user provided, including common middleware wrappers:
   - `{ MESSAGES: [...] }`
   - `[{ MESSAGES: [...] }]`
   - `{ data: { MESSAGES: [...] } }`
   - double-encoded JSON strings
2. If any wrapper prevents the exact `MESSAGE` from being returned, apply the smallest possible change **only** to the message-resolution step in `src/lib/mm/material-reservation.functions.ts`.
3. Ensure the popup displays only the resolved message text. If `SapResponseDialog` is currently rendering the raw `response` object, remove that rendering for the Material Reservation save popup while keeping the dialog reusable for other screens.
4. Leave unchanged:
   - Save payload construction and API call
   - Success handling, list refresh, and row selection reset
   - Other MM screens' popup behavior
   - Any business logic or validations

## Outcome
The Material Reservation Save popup will surface the precise SAP error text such as `"Requested quantity should be lessthan or equal to total stock"` with no other response data visible.
