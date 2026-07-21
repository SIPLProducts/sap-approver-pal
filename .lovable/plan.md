## Change

In `src/components/aws/cloudscape-approval-table.tsx`, restructure the card's toolbar row so that on SD approval screens (and any screen using this shared table) the layout is a single row with:

- **Left:** the search input
- **Right:** Reject button, then Accept button (green)

### Details

Current toolbar has three logical groups: title + count (left), then search + extras + Reject + Accept (right). This will be reorganized to:

```text
[ 🔍 Search........... ]                          [ Reject ] [ Accept ]
```

- Move the title/count line above the toolbar row (or drop into a small header strip) so it doesn't compete for horizontal space — search stays flush left, buttons flush right.
- Keep the toolbar as a single `flex items-center justify-between` row containing only: search (left) and action buttons (right).
- `headerExtras` (if any) stays near the buttons on the right.
- No changes to button colors, ordering (Reject before Accept), business logic, selection, pagination, or any screen files.

This automatically covers all SD approval screens (Contract, Sales Order, Price, SC-SO, BMW Status, Reports) since they all render via `CloudscapeApprovalTable`.
