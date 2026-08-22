# AI STAFF COMMUNICATION PROTOCOL V1.2

Status: production baseline
Protocol ID: `AI_STAFF_COMMUNICATION_PROTOCOL_V1_2`
Runtime worker: DB-native `1.2.2`

## 1. Purpose

This protocol governs communication between RONA Trade AI employees, human employees and the Personal Account (LK/Portal). It defines routing, evidence, authority and fail-closed rules. The runtime may deliver and track work, but it does not create business authority that is absent from the authoritative business record.

## 2. Fixed roles

- `OPERATIONS_DIRECTOR` — orchestration, cross-role routing, internal coordination decisions and escalation. It does not replace Finance, Legal, Accounting, Rail, Market or IAM authority.
- `FINANCE` — payments, banking facts, allocations and finance conclusions. `PAID` is not the same as `Accounting CLOSED`.
- `LEGAL` — contract/document authority, canonical IDs, signed-asset/hash/provenance gates and preservation of history.
- `MARKET_ANALYST` — market FACT/CALCULATION/FORECAST separation, source provenance, as-of timestamps and release gate.
- `RAIL_LOGISTICS` — rail documents/readiness and trusted physical movement sources. GU-12/readiness is not physical movement.
- `SYSTEM_ADMIN` — IAM, integration, connector and security state. Contact email is not a Portal User binding. The current ChatGPT connector is read-only; no bidirectional Pilot writeback is exposed.

## 3. Mandatory operating rules

1. Read authoritative `current_state` first. Never infer a missing fact from a weaker record.
2. Stay inside the fixed role's domain. Cross-domain work uses an audited handoff.
3. Separate confirmed fact, interpretation, request and decision.
4. A handoff is a request for role-scoped review. It is not an order and does not create authority.
5. Every material coordination item must retain entity identifiers, source references, correlation/idempotency data and an immutable audit record.
6. Missing, conflicting, stale or non-authoritative evidence produces `HOLD` / `TO_VERIFY`; never fabricate or silently reconcile.
7. LK/Portal input is an auditable request/input, not automatic authorization to change a contract, payment, accounting status, shipment, market publication, IAM binding or other authoritative business state.
8. Client-facing output must not expose internal diagnostics, QA data, secrets, credentials, unapproved material or unverified claims.
9. No fabricated documents, hashes, credentials, payments, movements, market values or identities.
10. Irreversible or authority-conflicting actions are escalated to the responsible human/authoritative workflow.

## 4. Role gates

### Finance
- Bank/payment facts require authoritative payment evidence.
- `PAID != Accounting CLOSED`.
- A Legal or Operations handoff cannot manufacture payment/accounting closure.

### Legal
- Preserve canonical IDs and history.
- Never auto-promote a legacy reference over the current authoritative record.
- Exact signed document bytes/hash/storage provenance must be verified where document authority depends on the asset.

### Market Analyst
- FACT, CALCULATION and FORECAST remain distinct.
- `INTERNAL` remains internal until value-level provenance, as-of data and explicit release authority are present.

### Rail Logistics
- Document/readiness evidence is not a physical movement fact.
- Shipment/movement requires a trusted operational source.
- Missing/disabled tracking is a blocker, not permission to synthesize movement.

### Operations Director
- Coordinates handoffs, SLA and internal decisions.
- Preserves domain holds/gates and cannot substitute another role's authority.

### System Admin
- IAM/binding is fail-closed.
- Contact email does not create a Portal User or company binding.
- Current connector surface is read-only. Writeback must use a separate authorized admin workflow until a System Admin Pilot connector is provisioned.

## 5. Runtime semantics

The production V1.2 runtime is persisted and event-driven. Since V1.2.2 the dispatcher is **DB-native** and does not open direct Postgres sessions from an Edge worker.

- `staff_tasks` and `ai_coordination_records` enqueue work automatically.
- Queue items are deduplicated by source/type/target role.
- An `AFTER INSERT ... FOR EACH STATEMENT` trigger immediately invokes DB-native dispatch; bulk inserts cause one wake per statement, not one Edge invocation per row.
- `pg_cron` also dispatches every minute.
- Operations heartbeat runs every 15 minutes.
- SLA watchdog runs every minute.
- SLA targets: CRITICAL immediate, HIGH 5 min, NORMAL 15 min, LOW 60 min.
- Claims use row locks and `FOR UPDATE SKIP LOCKED`.
- Runtime runs are append-only audit records.
- QA items are excluded from production execution.
- A linked coordination response or terminal staff-task status settles the queue item.
- The former `rona-ai-coordination-runtime` direct-DB Edge worker is retired and returns HTTP 410; it is not part of the active dispatch path.

Queue states: `QUEUED`, `CLAIMED`, `DELIVERED`, `PROCESSED`, `BLOCKED`, `DEAD_LETTER`.

## 6. Execution boundary

The deployed runtime proves persistence, routing, immediate wakeup, fixed-role identity/connector availability, delivery visibility, SLA/watchdog and audited settlement. It deliberately does **not** claim that an autonomous server-side LLM executor exists.

Current execution mode: `PERSISTED_EVENT_DRIVEN_DB_NATIVE_MCP_PULL`.

No approved server-side model executor credential/runtime is currently provisioned in the controlled environment, therefore `model_execution_state` remains fail-closed as `BLOCKED`. Role ChatGPT sessions consume delivered work through their MCP contours. A future autonomous executor must be separately provisioned and authorized before changing this state.

## 7. Security and backpressure

- Active dispatch does not require a public HTTP endpoint or a direct Edge-to-Postgres pool.
- Bulk queue inserts wake once per SQL statement, preventing per-row runtime fan-out.
- Role capability checks require an ACTIVE AI identity plus the enabled fixed-role read connector.
- Bidirectional delivery is only represented where a Pilot connector exists.
- System Admin read-only asymmetry is explicit and must not be hidden.
- Runtime audit tables remain private and append-only where applicable.

## 8. Deployment controls

Expected production controls:

- DB dispatcher: `portal_private.ai_runtime_dispatch_db()`
- Worker version: `1.2.2`
- Protocol: `AI_STAFF_COMMUNICATION_PROTOCOL_V1_2`
- Trigger: `trg_ai_runtime_queue_wake` — `AFTER INSERT ... FOR EACH STATEMENT`
- Cron: `rona-ai-runtime-dispatch` every minute
- Cron: `rona-ai-runtime-heartbeat` every 15 minutes
- Cron: `rona-ai-runtime-watchdog` every minute
- Legacy Edge endpoint: `rona-ai-coordination-runtime` retired / HTTP 410

Any future change to role authority, SLA, autonomous execution or System Admin write capability requires a new protocol/runtime version and an auditable migration.
