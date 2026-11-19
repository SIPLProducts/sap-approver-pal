# Sidebar label tweaks (IWM Approvals)

Display-only change in the sidebar menu; no routes, permissions or screen logic change.

1. **Financial Year Base Rate** — show on two lines: "Financial Year" / "Base Rate", using the same two-line style already used for "Price Master Update / Approvals".
2. **Distance Master Screen** — rename the sidebar label to "Distance Master".

## Technical details
- Only `src/routes/_authenticated.tsx`, the two `imwChildren` label values.
- Permission keys (`imw.financial_year_base_rate`, `imw.distance_master`) and routes stay unchanged.
