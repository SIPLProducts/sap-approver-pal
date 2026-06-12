## Goal

After Approve/Reject on Price Approvals, show the SAP response in a polished modal like the attached screenshot (header banner + per-message cards with Success/Error badge), instead of the current SweetAlert HTML table.

## Approach

Drop SweetAlert for this flow and use the existing shadcn `Dialog` component (already in the project), so the popup matches the app's design system, supports scrolling cleanly, and is easier to style than swal HTML strings.

## What changes (frontend only, `src/routes/_authenticated/sd.price.tsx`)

1. Remove `import Swal from "sweetalert2"` and the `Swal.fire(...)` call inside `decisionMutation.onSuccess`.
2. Add local state:
   - `resultOpen: boolean`
   - `resultData: { action: "accepted" | "rejected"; messages: Array<{CUSTOMER?: string; TYPE?: string; MESSAGE?: string}>; total: number }`
3. In `onSuccess`, keep the existing envelope unwrap (`sap.data ?? sap` → `MESSAGE`), then set `resultData` + open the dialog (no swal).
4. Render a new `<Dialog open={resultOpen} onOpenChange={setResultOpen}>` at the bottom of the page with:
   - **Header banner** (green if all `S`, red if any `E`/`A`, amber if any `W`):
     - Icon (`CheckCircle2` / `XCircle` / `AlertTriangle`)
     - Title: `Approved`, `Rejected`, or `Completed with errors`
     - Subtitle: `{successCount} of {total} condition record(s) saved in SAP`
   - **"SAP Response Details"** heading
   - **Scrollable list** (`max-h-[60vh] overflow-auto`) of cards, one per `MESSAGE` row:
     - Card left: `MESSAGE` text as title (bold), then small muted meta line `Customer: {CUSTOMER || "—"}`
     - Card right: pill badge `Success` (green) or `Error` (red) or `Warning` (amber) based on `TYPE`
   - Footer: `Close` button.
5. Errors keep using `toast.error` (unchanged).
6. Keep `decided`/`selected` state updates as they are — only the popup UI changes.

## Notes

- No backend / server-function changes.
- `sweetalert2` import is removed from this file; package stays installed (no need to uninstall).
- Uses existing tokens (`bg-green-50/600`, `bg-red-50/600`, `border`, `Badge`) so it respects light/dark theme.
