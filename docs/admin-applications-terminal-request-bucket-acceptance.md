# Acceptance gate — terminal historical request bucketing

PASS requires all of the following:

- terminal standalone request with staff task `COMPLETED/DONE/CLOSED` renders only in `COMPLETED`;
- `lifecycle_state=ARCHIVED` never falls through to `WORK`;
- current `NEW` requests remain `NEW`;
- current `IN_PROGRESS` requests remain `WORK`;
- supplier-pending remains `DECISION`;
- supplier-approved handoff remains actionable and is not prematurely archived;
- no raw/intake/business data mutation;
- no Payments/Finance change;
- no record-specific hardcode.
