# Admin → Payments V7 — server-side Finance materializer

Status: **IMPLEMENTED CANDIDATE / QA REQUIRED**  
Production gateway v28: **UNCHANGED**  
Production Finance business-data mutation: **PROHIBITED UNTIL SEPARATE OWNER AUTHORIZATION**  
Payments UI: **FROZEN / NO VISUAL SCOPE**

## Purpose

Remove ChatGPT MCP tool-registry availability from the authoritative Payments V7 write path without changing Finance authority semantics.

The execution model is:

`FINANCE / AI-FINANCE read + prepare + source-lock → structured confirmed Finance fact → private server materializer → portal_private.materialize_finance_fact_v7 → portal_private.persist_finance_event_v7 → canonical Payments V7 projection`

The materializer does not call `finance_event_submit`, does not expose SQL to Finance AI, and does not write `payments`, `payment_allocations`, `deal_finance_authority_v7`, `payment_business_attributions_v7` or `payment_resource_chains_v7` directly. The only authoritative business mutation primitive is `portal_private.persist_finance_event_v7(jsonb,jsonb)`.

## Authority and source-lock

Every fact must include:

- `confirmation_status`;
- `source_lock_task_id`;
- `source_lock_record_ids[]`;
- `source_refs[]`;
- `source_version`;
- `source_timestamp`;
- `idempotency_key`;
- the existing Finance event envelope (`event_type`, `effective_at`, event payload and applicable Deal/payment/current-authority IDs).

The DB materializer accepts only actor `FINANCE / AI-FINANCE`. It validates that the source-lock task is a Finance task and every supplied source-lock record is an approved, `confirmed=true` Finance functional conclusion created by `AI-FINANCE` and linked to that task. Each source-lock record must also be explicitly present in `source_refs`.

The server endpoint is a separate internal execution contour protected by `RONA_FINANCE_MATERIALIZER_TOKEN`. It fixes the business actor server-side to `FINANCE / AI-FINANCE`; the request cannot select or override the actor.

## TASK-PAYMENTS-V7-FINANCE-20260915 current source-lock lineage

The implementation does not hardcode business amounts. When production materialization is separately authorized, structured facts must be prepared from the applicable current source-lock lineage, including:

- Finance v24 `b1efe7e7-ad4a-494a-afb7-36c07b820c87` — original pre-materialization matrix;
- Finance v25 `f9911be7-c8bd-4964-8c41-e0999d33dcdc` — Owner correction superseding the v24 classification of already executed Deal-verified payments;
- `c9d44eb5-c775-466b-87f9-864f095e482c` — Owner-approved 80/20 allocation basis for the 3,000 RUB KUZMASH fee linked to the confirmed principal allocation;
- `4e73e2c9-6748-44df-a025-592e50b00d58` — PAYEV-2026-000009 bank fact remains confirmed while Deal attribution remains `TO_VERIFY` and therefore excluded from confirmed Deal totals;
- `2e9a8b1e-b020-4603-a0dd-e11ff7519132` — current canonical Payments rule: actual executed facts only, actual settlement/resource-chain evidence only, unresolved attribution stays unresolved, no arbitrary split;
- later Owner-approved corrections relevant to a fact must be included in its source-lock refs before execution.

Finance conclusion `c896e336-e07d-4470-ba3f-bfe61786aae1` was superseded in Agent FX presentation scope by `e04f2d16-fae9-482d-89b0-0f2e7a48de1a`. That Agent presentation correction does not authorize synthetic FX or alter Payments V7 bank facts. Proposal/conclusion records remain source/evidence records only; the materializer does not mutate or reinterpret their workflow semantics.

## Fail-closed semantics

- `confirmation_status=TO_VERIFY` is audited and skipped; `persist_finance_event_v7` is not called.
- An explicit `TO_VERIFY` business value in the submitted payload is skipped.
- A **confirmed bank payment with unresolved Deal allocation** is allowed only through the existing `SCOPE_ONLY` attribution mode. The payment fact is materialized; the allocation remains unresolved/`TO_VERIFY` and no synthetic split is created.
- `PAYMENT_RESOURCE_CHAIN_CONFIRMED` rejects CBR, market, contractual, approximate or synthetic FX bases before canonical persistence.
- Missing Finance task/source-lock records, missing provenance, wrong actor, or malformed idempotency/source timestamps fail closed.

## Audit

`portal_private.finance_materializer_audit_v7` is immutable and records every structured materializer attempt that reaches the DB wrapper, including actor, correlation ID, source-lock lineage, provenance, request snapshot/hash, whether canonical persistence was invoked, outcome, reason code and persistence result.

The audit table is not a Payments authority table. It is revoked from `public`, `anon`, `authenticated` and `service_role` in the same manner as the controlled Finance write primitive.

## QA gate

`tests/admin-payments-v7/server-materializer.sql` must prove on PostgreSQL 17 that:

1. a source-locked `CONFIRMED` fact reaches `persist_finance_event_v7` and appears in canonical Payments V7 input;
2. the same structured fact marked `TO_VERIFY` does not create a payment/event;
3. a confirmed payment with unresolved allocation remains `SCOPE_ONLY` without inferred split;
4. synthetic FX is rejected before persistence;
5. non-Finance actor is rejected;
6. accepted/skipped/denied attempts have immutable audit evidence.

`tests/admin-payments-v7/server-materializer.test.mjs` additionally proves there is no direct DML to Payments authority tables and no dependency on `finance_event_submit` or ChatGPT MCP registry.

No production business fact is part of this QA.
