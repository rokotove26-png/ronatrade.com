# AI STAFF COMMUNICATION PROTOCOL V1.3

Status: staged production protocol. The server-side executor foundation may be deployed while autonomous model execution remains fail-closed. `model_execution_state=ENABLED` is allowed only after a real provider/model probe and explicit backend arm gate succeed.

Protocol ID: `AI_STAFF_COMMUNICATION_PROTOCOL_V1_3`  
Delivery runtime: DB-native V1.2.2  
Model executor: V1.3.0

## Purpose

V1.3 adds a server-side model executor to the audited RONA Trade AI staff runtime without using ChatGPT Scheduled Tasks, Work tasks, conversation creation, conversation renaming or chat-history manipulation as a worker mechanism.

The executor consumes only already-routed backend queue items and may create only controlled internal coordination records. It never receives direct authority to mutate contracts, payments, accounting, prices, shipments, movement, publications, IAM, portal bindings, credentials or client/agent-visible state.

## Fixed autonomous roles

Autonomous model execution is limited to:

- `OPERATIONS_DIRECTOR`
- `FINANCE`
- `LEGAL`
- `MARKET_ANALYST`
- `RAIL_LOGISTICS`

`SYSTEM_ADMIN` is never autonomously claimed. Its ChatGPT connector remains read-only; technical mutations require a separate authorized admin workflow.

## Current-state-first execution

For every claimed queue item the executor:

1. Uses the server-fixed `target_role`; the model cannot change its own role.
2. Uses a bounded lease on the existing DB-native `DELIVERED` queue item.
3. Obtains a short-lived fixed-role read token from the backend.
4. Reads the existing authoritative `rona-ai-read-only/current-state` projection for that role.
5. Sends the queue envelope plus a bounded current-state projection to the model.
6. Requires strict structured output.
7. Treats model output as untrusted and validates it again in PostgreSQL.
8. Commits only a permitted append-only coordination record or `NO_ACTION`.
9. Stores response identifiers, request/output hashes, usage and execution state; chain-of-thought is neither requested nor stored.

## Autonomous action surface

The production V1.3.0 executor can emit only:

- `NO_ACTION`
- `FUNCTIONAL_CONCLUSION`
- `HANDOFF_REQUEST`
- `BUSINESS_CHANGE_PROPOSAL`

`TASK_PROGRESS`, `TASK_ACKNOWLEDGEMENT`, `OPERATIONS_INTERNAL_DECISION` and every authoritative business/IAM mutation remain outside the autonomous V1.3.0 model surface. They continue through existing human/interactively authorized Pilot/Admin workflows.

A handoff is a request, not an order. A functional conclusion is role-scoped analysis, not authority outside that role. A business-change proposal is not an applied change.

## Entity binding and provenance

The model cannot select an unrelated entity. The database derives the expected entity from the server-routed queue item and rejects output whose `entity_type` or `entity_id` does not match it.

Source references are inherited from the authoritative queue and augmented with executor/queue identifiers. The model does not control authoritative provenance fields.

## Authority rules preserved

- Finance: `PAID != Accounting CLOSED`; payment or accounting closure cannot be synthesized.
- Legal: canonical IDs, current-vs-history, signed-asset authority and conflicts are preserved; missing/conflicting authority remains HOLD/TO_VERIFY.
- Market: FACT/CALCULATION/FORECAST remain distinct; `PREPARED_INTERNAL` never becomes Client publication through the executor.
- Rail: tariff/document/readiness is not shipment/movement/monitoring; physical movement requires a trusted operational source.
- Operations: coordinates and escalates but cannot replace Finance, Legal, Accounting, Rail, Market, System Admin or IAM authority.
- LK: external role-safe publication remains a separate authoritative backend workflow. The executor never writes Client/Agent display data directly.

## Queue and backpressure

The existing DB-native queue remains the delivery layer.

- Production default batch: 1 item.
- Hard batch ceiling: 5 items.
- Production max attempts: 3.
- Lease: 90 seconds.
- `SYSTEM_ADMIN` and QA items are never autonomously claimed.
- Items created before the arm timestamp are excluded by `execute_after`; the old backlog is not automatically consumed.
- Provider/current-state failures use bounded retry; exhausted items become `DEAD_LETTER`.
- A successful permitted action or `NO_ACTION` settles the queue item as `PROCESSED`.

## Security

- The executor Edge Function uses Supabase REST/RPC and opens no new direct Edge-to-Postgres pool.
- Scheduler authentication uses a random secret stored in Supabase Vault and sent only in an HTTPS header to this project's executor endpoint.
- The health route exposes control/capability booleans only; it does not expose credentials.
- `OPENAI_API_KEY` must exist only as a server-side Edge secret.
- Strict structured model output is still untrusted until the database commit gate accepts it.
- Secrets, tokens, debug internals and QA identities are prohibited from LK-facing output.
- ChatGPT Scheduled Tasks are prohibited as heartbeat, dispatcher, worker or canonical execution thread for RONA AI employees.

## Activation gate

Installing V1.3 does not enable model execution.

Activation sequence:

1. Apply the V1.3 database foundation and commit gate.
2. Deploy `rona-ai-model-executor`.
3. Invoke the authenticated `/probe` route.
4. Probe must prove that `OPENAI_API_KEY` is present, the configured model is accessible, and strict structured output works.
5. Call `rona_ai_executor_arm(model)` only after a recent successful probe for the same model.
6. Arm sets the live protocol to V1.3, `model_execution_state=ENABLED`, worker version 1.3.0, and resets `execute_after` to the activation timestamp.

If credentials disappear or the executor is explicitly disarmed, `model_execution_state` returns to `BLOCKED` and active model leases are released without creating business authority.

## Scheduler

`pg_cron` + `pg_net` invoke the executor once per minute. While the executor is not armed, `/run` is a no-op and claims no queue item.

## Readiness classification

A deployed DB/Edge foundation with a failed or missing provider credential must be reported as:

`FOUNDATION DEPLOYED / AUTONOMOUS EXECUTION BLOCKED`

It must not be described as autonomous READY. Global business readiness remains independent and continues to respect all Legal, Finance/Accounting, Rail, Market, IAM and LK authority gates.
