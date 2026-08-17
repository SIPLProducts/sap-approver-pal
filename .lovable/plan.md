Make the login hero image stable-size and centered while keeping the layout responsive

## Goal
Adjust the login page hero image so it stays at a fixed, stable size and centered in its section when the browser is resized or zoomed. The surrounding layout and text should remain responsive, but the image itself should not stretch, shrink, or change proportions. The image must remain fully visible and not clipped.

## Current state
In `src/routes/login.tsx`, the hero image (`heroArt`) uses fluid sizing classes (`clamp(...)` and `max-h-[30vh]`, `xl:w-[clamp(10rem,16vw,20rem)]`). This causes the image to resize with the viewport, which is the opposite of a stable size.

## Proposed changes
1. Update the hero image in `src/routes/login.tsx` to use a fixed intrinsic size (for example, `w-[320px] h-[320px]`) while keeping `object-contain` so aspect ratio is preserved.
2. Center the image in its column using flex/grid centering (`flex items-center justify-center` or `place-items-center`).
3. Add only overflow-safe guardrails (`max-w-full max-h-full`) so the image is never clipped if the section becomes smaller than its fixed size, but it should not be the primary sizing mechanism.
4. Keep the hero grid layout (`grid-cols-[minmax(0,1fr)_auto]`) so the text column continues to adapt responsively, while the image column sizes to its fixed content.
5. Remove any `clamp(...)` width/height values from the image itself to stop it from stretching or shrinking with the viewport.
6. Preserve all existing login logic, authentication, forgot-password flow, form state, and the password eye toggle without changes.

## Verification
After the change, the login hero image should appear at the same visual size across browser zoom levels (100%, 125%, 150%) and across typical desktop widths, while remaining centered and fully visible in its section.