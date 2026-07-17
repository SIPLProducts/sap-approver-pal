Make two minimal, presentation-only changes to keep every Cloudscape table header and cell value on a single line.

1. Remove `wrapLines` prop from `<Table>` in `src/components/aws/cloudscape-approval-table.tsx`.
2. Add CSS under `.awsui-app-scope` in `src/styles.css` that applies `white-space: nowrap` to both table header (`th`) and body (`td`) cells.

No other props, styles, or business logic will be changed.