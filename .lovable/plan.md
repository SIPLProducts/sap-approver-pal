Change the login page "Forgot" text to "Forgot Password?" and apply a theme-colored text style for better visibility.

- Update the password label accessory button in `src/routes/login.tsx` to display "Forgot Password?" instead of "Forgot". 
- Apply the project's primary/theme color text styling (e.g., `text-primary` or `text-[var(--primary)]`) so it stands out against the muted-foreground default, keeping the existing hover state.
- Verify the change renders correctly in the preview and build passes.

No other functionality or logic changes.