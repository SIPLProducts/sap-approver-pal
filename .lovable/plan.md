## Plan: Forgot Password Modal Popup

### Current state

- `src/routes/login.tsx` contains a small inline "Forgot?" link that, when clicked, expands a panel below the password field with an Email input + Send button.
- The SAP-based forgot password API (`sapForgot`) already works and must not change.

### Goal

Open a popup/modal matching the provided reference design when the user clicks "Forgot" on the login page. The modal should contain:

- Title: "Recover your password"
- Subtitle: "Enter your account email and we'll send you a password."
- Email label and input
- Two bottom-right actions: "Cancel" and "Send" (primary)
- Close (X) button in the top-right

### Implementation steps

1. **Import the shadcn Dialog components** in `src/routes/login.tsx`.
   - Add `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`.

2. **Remove the inline forgot section** (lines ~218-261).
   - Delete the conditional `forgotOpen && mode === "signin"` block that renders inline.

3. **Wrap the existing forgot handler inside a Dialog**.
   - Add a `Dialog open={forgotOpen} onOpenChange={setForgotOpen}`.
   - Use `DialogContent` with `className="sm:max-w-md"`.
   - Use `DialogHeader` with:
     - `DialogTitle` = "Recover your password"
     - `DialogDescription` = "Enter your account email and we'll send you a password."
   - Add `DialogFooter` with:
     - "Cancel" button (`variant="outline"`) calling `setForgotOpen(false)`
     - "Send" button (primary `Button`) that calls the existing `sapForgotFn` handler.

4. **Keep the existing API integration and state logic unchanged**.
   - Retain `forgotOpen`, `setForgotOpen`, `forgotEmail`, `setForgotEmail`, `forgotBusy`, `setForgotBusy`.
   - Keep the existing `sapForgotFn({ data: { email: forgotEmail.trim() } })` call and success/error toast handling.

5. **Verify build**.
   - Run a build check to ensure no TypeScript/import errors and no duplicate JSX tags.

### No changes needed

- Backend / SAP forgot password logic (`sapForgot` server function).
- Authentication flow or other login UI elements.
