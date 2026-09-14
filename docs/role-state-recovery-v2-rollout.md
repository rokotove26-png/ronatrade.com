# Rollout gate

Production behavior is already active and verified. Repository merge is the source-of-truth synchronization step.

Merge gate requirements:

- migration source matches deployed `portal_private.ai_role_state_*_v2` objects;
- `rona-mcp-gateway/index.ts` remains a narrow wrapper around the established authenticated/audited gateway;
- `current_state` returns V2 compact projection only after the legacy authenticated call succeeds;
- no business mutation path is changed;
- max 20 coordination records; no payload/source_refs/evidence_refs in current state;
- stale-write transaction test remains PASS;
- end-to-end Operations current_state remains PASS.
