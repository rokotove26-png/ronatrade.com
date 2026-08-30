# Portal reverse event closed loop v1

## Scope
Repair lifecycle closure for functional conclusions without changing authoritative business records.

## Findings
- MCP write tool validates entity scope before creating immutable coordination records.
- Functional conclusion tool requires target entity existence and role scope.
- Rail conclusions must use DEAL, SHIPMENT, RAIL_DOCUMENT or TASK scopes.
- Existing branch state remains unchanged until migration and QA pass.

## Required implementation
1. Add supported lifecycle settlement handler for portal reverse events.
2. Keep price publications and deal records immutable.
3. Link conclusion records to audit trail.
4. Add regression QA for idempotency and role scope.

## Current Rail conclusion
Calculated rail input remains conditional and does not create a new commercial offer.
