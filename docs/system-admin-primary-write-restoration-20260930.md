# System Admin controlled writes — primary and Pilot

Owner authorized both fixed SYSTEM_ADMIN / AI-SYSTEM-ADMIN connectors, gateway changes and public publication of Pilot parity on 2026-09-30.

Both expose task_acknowledge, task_progress_submit, functional_conclusion_submit and handoff_request_submit with mcp:coordinate. The wrapper also exposes task_complete and task_close with existing terminal workflow gates. Technical conclusions and handoffs are restricted to SYSTEM / TASK; TASK actions require assigned technical tasks. No business entity writes. Existing read tokens keep their authority.

Primary-only v51 rollback: commit 419c4f686631c9334f83772ba55dd0cf7a78bd61. v50 rollback fixtures retained. Pilot parity deployed as v52.

Test: node tests/mcp-primary/primary-system-admin-write.test.mjs; passed scope/identity/business-domain rejection, primary/Pilot parity and other-role regression checks.

ChatGPT write not verified: the Pilot-named tool call correlated to the old rona-mcp-system-admin and mcp:read. Existing Pilot app binding and OAuth consent require repair; no token scope SQL updates.
