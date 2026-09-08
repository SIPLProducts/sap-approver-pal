# ZGP Report UI Redesign

## Goal
Redesign the existing ZGP Report as a compact enterprise reporting workspace while preserving every current field, action, state, API boundary, validation, and business rule.

## Visual direction
- Use the selected **Enterprise reporting workspace** composition, adapted to the app’s existing shell.
- Keep the established porcelain background, white work surfaces, graphite text, deep-indigo actions, and restrained brand-red identity.
- Keep IBM Plex typography to remain consistent with the rest of the application.
- Use crisp borders, restrained shadows, 6–8px corners, and compact enterprise spacing.

## Implementation
1. **Refine the page heading**
   - Tighten the title and supporting description into a clearer, more compact hierarchy.
   - Preserve the existing MM Approvals context and wording.

2. **Rebuild the selection area**
   - Arrange all six existing filters in a balanced two-column dashboard grid on wide screens.
   - Keep each From/To pair grouped under its field label, with a clear visual separator and equal control widths.
   - Stack each group cleanly on phones and avoid clipped labels or controls.
   - Preserve the existing RGP/NRGP options, text inputs, date pickers, and state behavior exactly.

3. **Improve action placement**
   - Place Execute as the clear primary action and Reset as a quieter secondary action in a compact footer/command area.
   - Preserve the current click behavior and icons.

4. **Integrate the results region**
   - Keep the existing report table, columns, pagination, row keys, empty state, and conditional visibility unchanged.
   - Visually align the results surface directly below the filters for a cohesive report workflow.
   - Preserve horizontal scrolling on narrow screens.

5. **Responsive and accessibility pass**
   - Verify desktop, tablet, and mobile field alignment and spacing.
   - Keep visible labels, keyboard focus, readable contrast, and stable button/input sizing.

## Scope guardrails
- No new filters, search, export, sample data, statuses, or actions from the visual prototype.
- No API, validation, state, routing, permission, pagination, or business-logic changes.
- Limit implementation to the ZGP Report presentation.

## Verification
- Run the project type check.
- Inspect the live ZGP Report at desktop and mobile widths, including date controls, Execute, Reset, empty results, and horizontal table behavior.
