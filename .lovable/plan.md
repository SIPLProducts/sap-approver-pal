Remove the count sub-line under "Approved successfully" / "Rejected successfully" in the SAP Response modal on 3 SD screens.

Changes:
1. `src/routes/_authenticated/sd.price.tsx` — Remove lines 490-492:
   `{successCount} of {total} condition record{total === 1 ? "" : "s"} saved in SAP`

2. `src/routes/_authenticated/sd.contract.tsx` — Remove lines 602-604:
   `{successCount} of {total} contract{total === 1 ? "" : "s"} released in SAP`

3. `src/routes/_authenticated/sd.sales-order.tsx` — Remove lines 634-636:
   `{successCount} of {total} sales order{total === 1 ? "" : "s"} released in SAP`

The "Approved successfully" / "Rejected successfully" title in the green banner stays exactly as-is. Only the smaller sub-line below it (showing counts) is removed.