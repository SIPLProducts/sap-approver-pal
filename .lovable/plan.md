## Goal

On `/login`, keep the executive hero panel intact but swap the three bullet feature list (Lock/ShieldCheck/FileCheck2 lines) for 2–3 clean SAP-approval UI mockup images that match the theme (deep navy gradient + brand red + gold accents). Everything else on the panel — logo, "Secure SAP Approvals" pill, headline, subtitle, and footer — stays.

## Changes

1. **Generate 3 mockup images** with `imagegen` (standard tier for crisp UI text) saved as JPGs under `src/assets/`:
   - `login-mockup-inbox.jpg` — stylized SAP approval inbox card list (row of approvals with amounts, status chips, avatars). Deep navy card on transparent/subtle background, brand red accent, gold status dot.
   - `login-mockup-approval.jpg` — a single approval detail card (line items table + "Approve" / "Reject" buttons), same palette.
   - `login-mockup-kpi.jpg` — a KPI/analytics tile trio (Pending, Approved Today, Value) in the same dark card style.

   Prompt style: "clean modern enterprise SaaS UI mockup, dark navy #0B1220 card, subtle glass, thin 1px white/10 borders, brand red #d4202a accents, gold #d4b453 accent, rounded-2xl, soft shadow, on a clean transparent background, no logos, no real names, high-fidelity, crisp typography". Transparent PNG isn't needed — JPGs sit on the gradient.

2. **Edit `src/routes/login.tsx`**:
   - Remove the `<ul>` block (lines ~134-147) containing the three `<li>` feature items and the `Lock`, `ShieldCheck` (inside list), `FileCheck2` icon usages inside them.
   - Clean up the lucide-react import — keep `ShieldCheck` and `ArrowRight` (still used in footer + submit button); drop `Lock` and `FileCheck2`.
   - Insert a new mockup stack in the same slot below the headline/subtitle:
     - A relatively-positioned container with three overlapping cards.
     - Each card: `rounded-2xl border border-white/10 shadow-2xl` wrapping an `<img>` of the mockup, subtle rotation/translate for a layered "stack" feel (e.g., back card `-rotate-3 translate-x-6`, middle straight, front `rotate-2 -translate-x-4 translate-y-4`).
     - Sizes tuned so it fits within the existing hero column without overflowing on `lg` and gracefully hides the back two cards on small screens (`hidden sm:block` on decorative ones).
     - `loading="eager"` + descriptive `alt` for the primary card, `alt=""` + `aria-hidden` for decorative ones.
   - No changes to the right-hand sign-in form, the forgot-password dialog, or any auth logic.

3. **No changes** to routing, styles.css tokens, or any business logic.

## Verification

- Build passes.
- Visual check at desktop (`lg` breakpoint) shows the three mockups layered under the headline, replacing the bullet list.
- Mobile view (`< lg`) still shows the hero panel compactly without horizontal scroll — decorative back cards hidden.
- Forgot Password dialog, sign in, and sign up flows unchanged.
