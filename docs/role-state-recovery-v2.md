# RONA ROLE STATE RECOVERY V2

Status: production-active candidate, deployed 2026-09-14.

## Contract

Role bootstrap precedence is deterministic:

1. PRODUCTION_CANONICAL
2. ROLE_CHECKPOINT
3. ACTIVE_TASK
4. EVENT_HISTORY
5. HANDOFF
6. CHAT_MEMORY

`current_state` is compact by construction: max 20 coordination records, heavy `payload/source_refs/evidence_refs` excluded, full history excluded, response budget 20 KB at the data-contract layer and 24 KB at the MCP gateway envelope.

State checkpoints are versioned. `ai_role_state_write_v2` requires `expected_version`; mismatches return `STALE_STATE` with `refresh_required=true`.

Full state history is retained in `ai_role_state_history_v2` and read separately with `ai_role_state_history_read_v2`. Task detail is read separately with `ai_role_task_detail_v2`.

Staff-task and coordination inserts/updates touch the role checkpoint and advance the state version. Active task is aligned to the latest open task. Coordination projection is `LATEST_NON_SUPERSEDED`.

## Production integration

`rona-mcp-gateway` wraps the existing authenticated/audited gateway path. It allows the legacy backend call to complete, then replaces only a successful `current_state` payload with the V2 compact projection derived from the already authenticated fixed role. All OAuth, role binding, read audit, rate limiting and existing tool behavior remain on the established gateway implementation.

This wrapper is deliberately narrow: it does not alter business writes or other MCP tools.
