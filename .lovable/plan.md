In the Service Certificate & SO Approvals screen, the SAP Response modal (ResultDialog) currently displays TYPE, CUSTOMER, and CONTRACT for each message. CUSTOMER and CONTRACT always show "—" and are not useful.

Change:
- Edit `src/routes/_authenticated/sd.sc-so.tsx` inside the `ResultDialog` component.
- Remove the `CUSTOMER` and `CONTRACT` rows from the response details grid.
- Keep only `TYPE` and the message text/badge.
- Also clean up the now-unused `contract` and `customer` local variables inside the `messages.map()` render.

No other files are affected.