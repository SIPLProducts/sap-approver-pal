## Problem
On desktop, the sidebar is `lg:static` and the outer flex container has `min-h-dvh`. When the page content is tall, the entire page scrolls — including the sidebar. The sidebar should remain fixed while only the main content area scrolls.

## Fix
In `src/routes/_authenticated.tsx`:

1. Change the outer wrapper from `min-h-dvh` to `h-screen overflow-hidden` so the overall layout never scrolls.
2. Change the sidebar from `fixed lg:static` to `fixed lg:sticky lg:top-0 lg:h-screen` so it stays pinned on both mobile and desktop.
3. Add `overflow-y-auto` to the `<main>` element so only the page content scrolls.
4. Ensure the sidebar nav area still has `overflow-y-auto` so long nav lists remain scrollable within the fixed sidebar.

No other files or logic change.
