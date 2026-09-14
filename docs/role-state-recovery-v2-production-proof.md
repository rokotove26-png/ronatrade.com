# RONA ROLE STATE RECOVERY V2 — production proof

Production database migrations applied on 2026-09-14:

- `rona_role_state_recovery_v2`
- `rona_role_state_recovery_v2_checkpoint_alignment`

Production Edge Function:

- `rona-mcp-gateway` version 19
- deployment sha256: `c711f13b93a92edc043078ebb3ebad321e74af9e34a396240b849e5c330198cd`

Transactional stale-write QA:

- correct `expected_version=1` advanced the transactional state to version 2;
- repeating `expected_version=1` returned `STALE_STATE`, `current_version=2`, `refresh_required=true`;
- transaction was rolled back;
- persistent SYSTEM_ADMIN checkpoint remained version 1 with one bootstrap history row.

Compact projection size QA before gateway activation:

- COMMERCIAL_DIRECTOR: 8,414 bytes
- FINANCE: 8,850 bytes
- LEGAL: 8,383 bytes
- MARKET_ANALYST: 8,011 bytes
- OPERATIONS_DIRECTOR: 9,847 bytes
- RAIL_LOGISTICS: 8,568 bytes
- SYSTEM_ADMIN: 8,132 bytes

All were below the 20 KB data-contract budget.

End-to-end MCP verification after gateway v19 deployment:

- `RONA_Operations_Director.current_state` returned `data_contract=RONA_ROLE_STATE_RECOVERY_V2`;
- coordination projection returned max 20 records;
- `heavy_fields_included=false`;
- bootstrap precedence and deterministic procedure were present;
- checkpoint was baseline-aligned to a canonical coordination record;
- `active_task_id` was populated from the latest open Operations task.
