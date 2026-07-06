## Problem

Inspecting the live Accept/Reject buttons shows Cloudscape puts the variant class directly on the `<button>` itself:

- Accept: `class="awsui_button_… awsui_variant-primary_…"`
- Reject: `class="awsui_button_… awsui_variant-normal_…"`

My previous CSS used `.awsui-app-scope [class*="awsui_variant-primary"] button {…}`, which expects a wrapper with the variant class and a nested button — nothing matches, so no color applied.

## Fix

Update the block in `src/styles.css` (Cloudscape Accept/Reject rules added last turn) so the variant class is on the button element itself. Keep colors and hover/disabled behavior unchanged:

- Accept: `.awsui-app-scope button[class*="awsui_variant-primary"]` → green background, white text.
- Reject: `.awsui-app-scope button[class*="awsui_variant-normal"]` → `var(--destructive)` background, `var(--destructive-foreground)` text.
- Hover/focus variants use the same selector with `:hover:not(:disabled)` / `:focus:not(:disabled)`.
- Icon/text descendants: `.awsui-app-scope button[class*="awsui_variant-primary"] *` and same for `variant-normal` → `color: inherit`, `fill: currentColor`.
- Disabled: same selectors with `:disabled` (or with the Cloudscape `awsui_disabled` class as a fallback) → `opacity: 0.55`.

## Out of Scope

- No changes to the Cloudscape component, route files, or header background rules.
- No new tokens; reuse `--destructive` / `--destructive-foreground` and the inline green already introduced.
