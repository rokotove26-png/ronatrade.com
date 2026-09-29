# Primary System Admin controlled writes — 2026-09-30

Owner removed the handoff restriction on gateway changes. Restore controlled technical coordination for existing rona-mcp-system-admin; no new app or client.

Baseline: production gateway v50 (custom OAuth authentication, verify_jwt=false). Preserve all deployed wrapper and finance extension behavior. Pin upstream gateway source locally from commit 36727a94820e1e85e95d4abfc5d6aab8234c5c18 to make the primary binding and contracts reviewable.

Primary fixed binding: SYSTEM_ADMIN / AI-SYSTEM-ADMIN. Advertise mcp:coordinate. Existing read-only tokens keep read-only authority; reconnect with consent for the coordinate scope.

Primary base write contracts: task_acknowledge, task_progress_submit, functional_conclusion_submit, handoff_request_submit. Conclusions and handoffs restricted to SYSTEM / TASK. TASK conclusions, handoffs and terminal actions require assigned SYSTEM_ADMIN technical task. No business change proposal, payment mutation or business entity write. Existing wrapper additionally advertises task_complete and task_close for coordinate tokens and retains terminal workflow gates.

Verification: node tests/mcp-primary/primary-system-admin-write.test.mjs. Matrix verifies old read tokens, primary identity mismatch, business-domain rejection, Pilot/other role contracts unchanged and cross-role handoff scope.

Rollback: redeploy exact original v50 files, retained below tests/mcp-primary/fixtures; no database migration or token scope update. Do not change existing token scopes in SQL.
