### Add back arrow to Price Approval Reports page

**Goal:** Add a back arrow button at the top of the Price Approval Reports (`/sd/price-reports`) page that navigates back to the Price Approval (`/sd/price`) tab.

**Changes:**

1. **`src/routes/_authenticated/sd.price-reports.tsx`**
   - Import `ArrowLeft` from `lucide-react` and `useNavigate` from `@tanstack/react-router`.
   - Add a small back-arrow button (outline variant, icon-only or with a label) above or beside the page title.
   - On click, call `navigate({ to: '/sd/price' })`.
   - Keep the existing layout and functionality untouched.

**Out of scope:** No changes to data fetching, table columns, or the price-approval screen itself.

**Verification:** Open `/sd/price-reports` and click the back arrow → lands on `/sd/price`.