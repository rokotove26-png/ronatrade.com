# Admin → Payments V7 — manifest-bound Finance materializer

Status: **IMPLEMENTED CANDIDATE / EXACT-HEAD QA REQUIRED**  
Production gateway v28: **UNCHANGED**  
Production Finance business-data mutation: **PROHIBITED UNTIL SEPARATE OWNER AUTHORIZATION**  
Payments UI: **FROZEN / NO VISUAL SCOPE**

## Purpose

Remove both ChatGPT tool-registry dependency and caller-controlled business content from the authoritative Payments V7 write path.

The authority chain is now:

`FINANCE / AI-FINANCE source-lock → business_change_proposal_submit exact materialization manifest → functional_conclusion_submit confirms that exact manifest → server receives manifest_id + conclusion_id only → server loads immutable manifest payload → portal_private.persist_finance_event_v7 → Payments V7`

Finance remains read / prepare / source-lock. Proposal and conclusion semantics are not changed: both remain immutable coordination records and neither directly mutates Payments business data.

## Finance Pilot workflow

The existing Finance Pilot tools are used without changing their contracts.

### 1. Materialization manifest

Finance creates a `business_change_proposal_submit` record targeting the existing Finance task:

- `target_entity_type = TASK`;
- `target_entity_id = TASK-PAYMENTS-V7-FINANCE-20260915`;
- `proposed_action = PAYMENTS_V7_MATERIALIZE`;
- `proposed_field = payments_v7_materialization_manifest`;
- `proposed_state.schema = PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1`;
- `proposed_state.source_lock_task_id` equals the task ID;
- `proposed_state.source_lock_record_ids[]` carries the applicable Finance source-lock lineage;
- `proposed_state.events[]` contains the exact Payments V7 events.

Each event entry contains only two semantic layers:

- `confirmation_status = CONFIRMED | TO_VERIFY`;
- `event` = exact canonical event envelope accepted by `portal_private.persist_finance_event_v7`, including `event_type`, Deal/payment/current-authority identifiers, source provenance, idempotency key and exact payload.

The proposal's `evidence_refs` must contain the Finance task and every referenced source-lock record.

### 2. Manifest confirmation

Finance then creates `functional_conclusion_submit` on the same Finance task with `confirmed=true` and status `APPROVED` or `APPROVED_WITH_CONDITIONS`.

Its `source_refs` must explicitly bind the conclusion to the exact manifest record ID, for example:

`BUSINESS_CHANGE_PROPOSAL:<manifest UUID>`

The materializer accepts only a current conclusion that is not superseded and for which no later Finance conclusion exists on the same task.

## Execution request: IDs only

The private Edge endpoint accepts exactly:

```json
{
  "manifest_id": "<uuid>",
  "conclusion_id": "<uuid>"
}
```

No caller-supplied amount, currency, `deal_id`, `payment_id`, allocation, FX data, `event_type`, event payload or source provenance is accepted. Any extra field is rejected as `CALLER_PAYLOAD_OVERRIDE_FORBIDDEN`.

The Edge endpoint fixes the actor server-side to `FINANCE / AI-FINANCE` and calls:

`portal_private.materialize_finance_manifest_v7(actor, {manifest_id, conclusion_id})`

The DB function re-validates the actor and loads the exact business content directly from immutable `portal_private.ai_coordination_records`.

## Current/superseded binding

A manifest is rejected when:

- it is not a Finance / AI-FINANCE `BUSINESS_CHANGE_PROPOSAL` created through `business_change_proposal_submit`;
- it is not targeted to a Finance task;
- action/field/schema do not match the Payments V7 manifest contract;
- an explicit coordination record has `supersedes_id = manifest_id`;
- a later Finance Payments V7 materialization proposal exists for the same task.

The confirming conclusion is rejected when:

- it is not a Finance / AI-FINANCE `FUNCTIONAL_CONCLUSION` created through `functional_conclusion_submit`;
- it is not `confirmed=true` and approved;
- it does not reference the exact manifest;
- it predates the manifest;
- it is explicitly superseded;
- a later Finance conclusion exists for the same task.

This means a valid generic Finance conclusion cannot authorize arbitrary caller-supplied content.

## Exact content hashes

The server computes SHA-256 over the exact immutable JSONB content it reads from the proposal:

- `manifest_payload_sha256` — exact `proposed_state`;
- `event_payload_sha256` — exact canonical event passed to `persist_finance_event_v7`.

Both hashes are written to immutable `portal_private.finance_materializer_audit_v7`, together with the manifest/conclusion IDs, event index, exact event snapshot, result and whether canonical persistence was invoked.

The existing coordination record `payload_hash` is also captured as audit evidence, but the materializer's exact event authority is determined from the immutable stored manifest itself, not from caller data.

## Existing source-lock lineage

Production materialization, if separately authorized later, must be prepared under `TASK-PAYMENTS-V7-FINANCE-20260915` from the applicable current lineage, including:

- Finance v24 `b1efe7e7-ad4a-494a-afb7-36c07b820c87` — original pre-materialization matrix;
- Finance v25 `f9911be7-c8bd-4964-8c41-e0999d33dcdc` — Owner correction for executed Deal-verified payments;
- `c9d44eb5-c775-466b-87f9-864f095e482c` — Owner-approved KUZMASH fee allocation correction;
- `4e73e2c9-6748-44df-a025-592e50b00d58` — PAYEV-2026-000009 unresolved allocation correction;
- `2e9a8b1e-b020-4603-a0dd-e11ff7519132` and any later Owner-approved Payments rule correction applicable to the facts.

The manifest may preserve superseded records as lineage evidence where later records explicitly correct them; authority to execute comes from the current exact manifest plus its current confirming conclusion.

## Fail-closed semantics

- `TO_VERIFY` event → `SKIPPED`; canonical persistence is not called.
- A confirmed bank payment with unresolved Deal allocation may be materialized only with the existing `SCOPE_ONLY` semantics; no inferred split is created.
- `PAYMENT_RESOURCE_CHAIN_CONFIRMED` rejects CBR, market, contractual, approximate or synthetic FX bases before persistence.
- Missing provenance, malformed idempotency/timestamp, invalid source-lock lineage, wrong actor, invalid manifest binding, superseded manifest/conclusion or caller payload override fail closed.
- There is no direct DML from the materializer into `payments`, `payment_allocations`, `deal_finance_authority_v7`, `payment_business_attributions_v7` or `payment_resource_chains_v7`.
- There is no DML from the materializer into `ai_coordination_records`; proposal/conclusion records remain immutable source-lock evidence.
- The only authoritative Payments mutation primitive is `portal_private.persist_finance_event_v7(jsonb,jsonb)`.

## QA gate

`tests/admin-payments-v7/server-materializer.sql` must prove on PostgreSQL 17:

1. caller changes amount after source-lock → `DENIED`, no persistence;
2. caller changes Deal/payment IDs after source-lock → `DENIED`, no persistence;
3. manifest without confirmed conclusion → `DENIED`;
4. superseded manifest → `DENIED`;
5. exact current confirmed manifest → `MATERIALIZED` from server-loaded payload;
6. exact manifest/event SHA-256 values match the stored immutable payload;
7. `TO_VERIFY` event → `SKIPPED`, no payment/event;
8. unresolved confirmed allocation remains `SCOPE_ONLY / TO_VERIFY` without inferred split;
9. synthetic FX → `DENIED` before persistence;
10. non-Finance actor → `DENIED`;
11. audit and privilege boundaries remain intact.

`tests/admin-payments-v7/server-materializer.test.mjs` additionally enforces the static contract: ID-only endpoint, no old caller-fact function, no direct Payments DML, no coordination DML, one canonical `persist_finance_event_v7` call and no dependency on `finance_event_submit` or ChatGPT tool discovery.

No production materializer deployment, migration application, secret provisioning or business event is authorized by this implementation/QA work.
