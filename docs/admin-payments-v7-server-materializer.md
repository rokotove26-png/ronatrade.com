# Admin → Payments V7 — automatic manifest-bound Finance materialization

Status: **IMPLEMENTED CANDIDATE / EXACT-HEAD QA REQUIRED**  
Production gateway v28: **UNCHANGED**  
Production Finance business-data mutation: **PROHIBITED UNTIL SEPARATE OWNER AUTHORIZATION**  
Payments UI: **FROZEN / NO VISUAL SCOPE**

## Purpose

Payments V7 materialization must not depend on ChatGPT tool discovery or on a separate action by the Finance AI after source-lock.

The authoritative flow is:

`FINANCE / AI-FINANCE source-lock → business_change_proposal_submit exact PAYMENTS_V7_MATERIALIZE manifest → functional_conclusion_submit confirms that exact manifest → server-side AFTER INSERT automation → materialize_finance_manifest_v7 → persist_finance_event_v7 → Payments V7`

Finance remains a read / prepare / source-lock contour. Its ChatGPT surface remains the existing eight tools. There is no ninth Payments write tool and no manual Finance materialization call after the conclusion.

## Finance Pilot surface

The candidate Finance Pilot surface is exactly the existing eight tools, unchanged:

1. `current_state`
2. `history`
3. `document_read`
4. `task_acknowledge`
5. `task_progress_submit`
6. `functional_conclusion_submit`
7. `handoff_request_submit`
8. `business_change_proposal_submit`

The Payments V7 flow uses only `business_change_proposal_submit` and `functional_conclusion_submit`. Tool discovery is not part of the write authority path.

## Exact materialization manifest

Finance creates a `BUSINESS_CHANGE_PROPOSAL` on the Finance task with:

- `proposed_action = PAYMENTS_V7_MATERIALIZE`;
- `proposed_field = payments_v7_materialization_manifest`;
- `proposed_state.schema = PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1`;
- `proposed_state.source_lock_task_id` equal to the target Finance task;
- `proposed_state.source_lock_record_ids[]` containing the applicable immutable Finance source-lock lineage;
- `proposed_state.events[]` containing the exact canonical Payments V7 event payloads.

Each event has `confirmation_status = CONFIRMED | TO_VERIFY` and an exact event envelope accepted by `portal_private.persist_finance_event_v7`, including source provenance, source version/timestamp and idempotency key.

The proposal is only preparation/source-lock. It does not itself mutate Payments.

## Confirming conclusion and automatic start

Finance then saves a `FUNCTIONAL_CONCLUSION` through `functional_conclusion_submit` on the same task. Automatic materialization is eligible only when all of the following are true:

- `functional_role = FINANCE`;
- `identity_id = AI-FINANCE`;
- `tool_name = functional_conclusion_submit`;
- status is `APPROVED` or `APPROVED_WITH_CONDITIONS`;
- `confirmed = true`;
- target type is `TASK`;
- `source_refs` explicitly bind the conclusion to the exact Payments V7 manifest;
- the manifest is a current Finance / AI-FINANCE `BUSINESS_CHANGE_PROPOSAL` created through `business_change_proposal_submit`;
- action/field/schema match the Payments V7 materialization contract;
- the manifest is not superseded and no later matching manifest exists.

`portal_private.finance_auto_materialize_after_conclusion_v7` is an `AFTER INSERT` trigger on immutable coordination records. Unrelated conclusions are ignored.

## Fail-isolated execution

The trigger creates or resolves one internal job in `portal_private.finance_materialization_jobs_v7`, keyed uniquely by `manifest_record_id`, then calls `portal_private.attempt_finance_materialization_job_v7`.

That server-side function supplies only the stored `manifest_id` and `conclusion_id` to `portal_private.materialize_finance_manifest_v7`. Business content is never copied from the caller/conclusion into the execution request. The materializer reloads the exact immutable manifest and revalidates Finance role, source-lock lineage, exact conclusion binding and current/superseded state before any canonical persistence.

Materialization errors are isolated from the Finance conclusion transaction. Trigger-side errors are caught, the conclusion remains saved, and the internal job is moved to `RETRY` with audit evidence. Finance does not need to resubmit or perform another action.

## Idempotency and repeated conclusions

Idempotency exists at two layers:

- the automatic job table has one job per exact `manifest_record_id`;
- every canonical Finance event keeps its existing Finance event `idempotency_key` enforcement in `persist_finance_event_v7`.

Once a manifest job reaches a terminal state (`MATERIALIZED`, `SKIPPED`, `DENIED`, `PARTIAL`), a repeated confirming conclusion for the same manifest does not call canonical persistence again. It records an `IDEMPOTENT_REPLAY` attempt only.

If a transient attempt fails before a terminal outcome, a later confirming conclusion may update the current conclusion reference for the pending job, but it cannot create a second job for the same manifest.

## Retry / recovery

`portal_private.recover_finance_materialization_jobs_v7(limit)` is the separate internal recovery path. It processes only `QUEUED`/`RETRY` jobs whose retry time has arrived, using `FOR UPDATE SKIP LOCKED` and the same `attempt_finance_materialization_job_v7` function.

Recovery is not a ChatGPT tool and requires no Finance AI action. Replays remain safe because the manifest job is unique and canonical Finance events are idempotent.

## Audit trail

Two audit layers are retained:

- `portal_private.finance_materializer_audit_v7` — immutable per-event materializer audit, including manifest/conclusion IDs, exact SHA-256 hashes, snapshots, outcome and actual `persist_invoked`;
- `portal_private.finance_materialization_attempts_v7` — immutable automation/recovery attempt audit with invocation source, attempt number, manifest SHA, result/error and actual persistence observation.

`portal_private.finance_materialization_jobs_v7` stores current operational job/retry state. It is not a Payments authority table.

Top-level and attempt `persist_invoked` are true only when at least one event actually entered the canonical `persist_finance_event_v7` call path.

## Fail-closed business semantics

- `TO_VERIFY` → `SKIPPED`; canonical persistence is not called.
- Wrong role/identity or unconfirmed/unbound conclusion → no automatic launch or materializer denial.
- Superseded/not-current manifest or conclusion → denied.
- Caller-supplied business overrides remain forbidden by the manifest-bound materializer.
- Unresolved confirmed allocation stays unresolved (`SCOPE_ONLY / TO_VERIFY`); no inferred split is created.
- Synthetic/CBR/market/contractual/approximate FX is denied before persistence.
- No automatic layer performs direct DML into `payments`, `payment_allocations`, `finance_events_v7`, `deal_finance_authority_v7`, `payment_business_attributions_v7` or `payment_resource_chains_v7`.
- The authoritative mutation primitive remains `portal_private.persist_finance_event_v7(jsonb,jsonb)` through `materialize_finance_manifest_v7`.
- Proposal/conclusion semantics remain unchanged; automation only reacts after a valid conclusion has been saved.

## Existing source-lock lineage

Production manifests, if separately authorized later, must be prepared under `TASK-PAYMENTS-V7-FINANCE-20260915` from the applicable current lineage, including Finance v24 `b1efe7e7-ad4a-494a-afb7-36c07b820c87`, Finance v25 `f9911be7-c8bd-4964-8c41-e0999d33dcdc`, Owner-approved KUZMASH correction `c9d44eb5-c775-466b-87f9-864f095e482c`, unresolved allocation correction `4e73e2c9-6748-44df-a025-592e50b00d58`, current Payments rule `2e9a8b1e-b020-4603-a0dd-e11ff7519132`, and every later Owner-approved correction applicable to the fact.

## QA gate

Exact-head PostgreSQL 17 and static QA must prove:

1. Finance Pilot surface = existing eight tools; no Payments write tool;
2. manifest proposal alone does not write Payments;
3. exact confirmed Finance conclusion automatically materializes the manifest into Payments V7;
4. `TO_VERIFY` automatically skips with no canonical event/payment;
5. non-Finance conclusion cannot create an automatic job;
6. repeated conclusion creates no duplicate Finance event/payment and records idempotent replay;
7. forced materialization failure does not roll back the saved Finance conclusion;
8. failed job enters `RETRY` and separate recovery subsequently materializes it;
9. source-lock/content-binding, superseded/current, SHA-256, no synthetic FX, unresolved allocation and aggregate `persist_invoked` regressions remain green;
10. no direct Payments DML exists in the automation layer and all legacy Payments V7 regressions remain green.

No production migration, Edge deployment, secret change, Finance manifest creation or business-data materialization is authorized by this candidate work.