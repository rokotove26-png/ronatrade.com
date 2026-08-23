# AI STAFF COMMUNICATION PROTOCOL V1.3

Status: staged production protocol; autonomous execution remains fail-closed until provider probe and explicit backend arm gate succeed.

Protocol ID: `AI_STAFF_COMMUNICATION_PROTOCOL_V1_3`
Runtime worker: DB-native delivery `1.2.2` + bounded model executor `1.3.0`

## 1. Purpose

V1.3 adds a server-side model executor to the audited RONA Trade AI staff runtime without using ChatGPT Scheduled Tasks, Work tasks, conversation creation, conversation renaming or chat-history manipulation as a worker mechanism.

The executor consumes only already-routed backend queue items and may create only controlled coordination records. It never receives direct authority to mutate contracts, payments, accounting, shipments, publications, IAM, client bindings or other authoritative business records.

## 2. Fixed roles

Autonomous model execution is allowed only for these business roles:

- `OPERATIONS_DIRECTOR`
- `FINANCE`
- `LEGAL`
- `MARKET_ANALYST`
- `RAIL_LOGISTICS`

`SYSTEM_ADMIN` remains excluded from autonomous write execution. Its current ChatGPT connector remains read-only; technical mutation requires a separate authorized admin workflow.

## 3. Current-state-first execution

For each claimed item the executor:

1. Uses the queue's server-fixed `target_role`; the model cannot inject or change its own role.
2. Obtains a short-lived role-scoped read token from the backend.
3. Reads the existing authoritative `rona-ai-read-only/current-state` projection for that role.
4. Sends the queue envelope plus a bounded current-state projection to the model.
5. Requires strict structured output with exactly one allowed coordination action.
6. Validates the proposed action again in the database before any record is committed.
7. Stores only hashes, response identifiers, token usage, action type and operational result in executor audit. Chain-of-thought is neither requested nor stored.

## 4. Allowed autonomous actions

The executor may produce only:

- `NO_ACTION`
- `FUNCTIONAL_CONCLUSION`
- `HANDOFF_REQUEST`
- `TASK_PROGRESS`
- `BUSINESS_CHANGE_PROPOSAL`
- `OPERATIONS_DECISION` — only when the fixed role is `OPERATIONS_DIRECTOR`

All non-`NO_ACTION` outputs are append-only coordination records. A proposal is not an applied business change. A handoff is not an order. A conclusion is not authority outside the role's domain.

## 5. Authority rules preserved from V1.2

- Finance: `PAID != Accounting CLOSED`; payment/accounting closure cannot be synthesized.
- Legal: canonical IDs, current-vs-history and signed-asset authority are preserved; conflict or missing authority stays HOLD/TO_VERIFY.
- Market: FACT/CALCULATION/FORECAST remain distinct; `PREPARED_INTERNAL` never becomes client publication through the executor.
- Rail: tariff/document/readiness is not shipment/movement/monitoring; a trusted operational source is mandatory for physical movement.
- Operations: coordinates, escalates and records internal decisions but cannot replace Finance, Legal, Accounting, Rail, Market or IAM authority.
- LK/Portal: external role-safe publication remains a separate authoritative backend workflow. The executor never writes client/agent display data directly.

## 6. Queue and backpressure

The DB-native V1.2.2 queue remains the delivery layer. The executor leases only `DELIVERED` non-QA items created after its activation time. Old backlog is not automatically consumed at activation.

- Maximum batch size: 5; production default: 1.
- Maximum attempts: production default 3.
- Leases are bounded and reclaimable after expiry.
- `SYSTEM_ADMIN` items are never autonomously claimed.
- QA items are never autonomously claimed.
- Provider/model failures retry with bounded backoff; exhausted items become `DEAD_LETTER`.
- Successful coordination commits settle the claimed queue item as `PROCESSED`.

## 7. Security

- The executor Edge Function uses Supabase REST/RPC with service-role authorization; it opens no direct Edge-to-Postgres pool.
- Scheduler authentication uses a random secret held in Supabase Vault and sent only as an HTTPS request header to the project's own executor endpoint.
- The public health route exposes capability booleans and control state only; it never returns credentials.
- The model API key remains a server-side Edge secret (`OPENAI_API_KEY`) and is never stored in coordination records, logs or LK data.
- Model output is untrusted until database validation succeeds.
- The model cannot select an out-of-scope entity, impersonate another role, perform direct business/IAM mutation, or autonomously write as System Admin.

## 8. Activation gate

Installing V1.3 does not by itself enable model execution.

Activation sequence:

1. Deploy DB foundation and `rona-ai-model-executor`.
2. Run `/probe` using the Vault-authenticated internal scheduler path.
3. Probe must confirm a real `OPENAI_API_KEY`, model access and strict structured output.
4. Backend `rona_ai_executor_arm(model)` must be called using service-role authority after a recent successful probe.
5. Only then does `model_execution_state` become `ENABLED`, protocol control switch to V1.3, and `execute_after` move to the activation timestamp.

If the model credential disappears or the executor is disarmed, `model_execution_state` returns to `BLOCKED` and active model leases are released without creating business authority.

## 9. Scheduler

The scheduler is database-native (`pg_cron` + `pg_net`) and calls the executor once per minute. While the executor is not armed, `/run` returns a no-op and claims no queue items.

ChatGPT Scheduled Tasks are prohibited as AI employee heartbeat, dispatcher, worker or canonical execution thread.

## 10. Production classification

V1.3 may be source-controlled and deployed in fail-closed foundation state before the model credential is available. That state must be reported as `FOUNDATION DEPLOYED / AUTONOMOUS EXECUTION BLOCKED`, not as autonomous READY.

Global business readiness remains independent from this technical executor and continues to respect all Legal, Finance/Accounting, Rail, Market, IAM and LK authority gates.
