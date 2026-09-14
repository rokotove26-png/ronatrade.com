# Admin Payments V7 — Stage 3D.1 genuine-unallocated semantics and PostgreSQL 17 parity

Status: `PREPRODUCTION_ACTIVATION_PREP / NO_PRODUCTION_DDL / NO_PRODUCTION_DML / NO_DEPLOY / NO_UI`.

Stage 3D.1 supersedes the Stage 3D provider-capability rule where they conflict. Relation presence is not provider readiness, and genuine Owner actionability must not depend on an upstream Payment enum value that production cannot produce.

## CURRENT_STATE_FIRST production proof

Read-only production inspection on 2026-09-13 established:

- PostgreSQL server: 17.6 (`server_version_num=170006`), session identity `postgres`;
- `portal_private.allocation_review_state_enum` is exactly `NOT_APPLICABLE | TO_VERIFY | VERIFIED`;
- current authoritative `BANK_CONFIRMED` Payments: 17;
- current `BANK_CONFIRMED + DEAL_ALLOCATABLE` Payments: 13;
- optional V7 authority/Finance/resource relations are still absent before production activation.

No Stage 3D.1 migration, business row or runtime deployment was applied to production.

## Genuine-unallocated contract

A no-claim Payment becomes `GENUINELY_UNALLOCATED` only after full reconciliation when all of these are true:

1. provider is present and `paymentBusinessAuthorityReady=true`;
2. Payment is current/source-locked `BANK_CONFIRMED`;
3. Deal allocation is applicable;
4. production-valid `allocation_review_status=TO_VERIFY`;
5. no exact attribution exists;
6. no known Deal/business scope exists;
7. no Owner assertion exists;
8. no associated-principal authority exists;
9. Payment is not FX / NOT_APPLICABLE;
10. the state is not a known authority/materialization/source-reconstruction gap.

Result: `owner_action_required=true` and allowed actions are `BIND_TO_DEAL` and `ASSIGN_ADVANCE_PAYMENT`.

`allocation_review_status=VERIFIED` without current backing allocation/authority is not Owner ambiguity. It fails closed as `AUTHORITY_MATERIALIZATION_REQUIRED` with reason `VERIFIED_WITHOUT_BACKING_AUTHORITY`.

`NOT_APPLICABLE` is never queueable.

## Provider presence versus readiness

Runtime capabilities are split into:

- `paymentBusinessAuthorityPresent`: both normalized attribution header and line relations exist;
- `paymentBusinessAuthorityReady`: the provider is present and the generic DB readiness record has been activated after bootstrap validation.

Infrastructure relation: `portal_private.admin_payments_v7_provider_readiness`.

The relation stores generic provider activation state only. It contains no Deal ID, Payment ID or business lifecycle state. `PAYMENT_BUSINESS_AUTHORITY` is the provider key for the normalized payment-authority provider.

No readiness row means NOT READY. A READY row requires `ready_at` and a non-empty `validation_ref`.

## Preserved 000008 / 000009 canon

Stage 3D high-level Owner truth remains unchanged:

- `PAYEV-2026-000008` → `OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED`, exact Deal attribution `TO_VERIFY`, no fake Deal, no exact line, no Owner queue;
- `PAYEV-2026-000009` → `ASSOCIATED_BANK_FEE` linked to principal 000008, exact Deal fee attribution `TO_VERIFY`, no proportional split, no Owner queue.

Provider readiness must not be activated until these source-locked high-level rows are present and bootstrap validation has passed.

## Readiness privileges

`rona_payments_v7_reader` receives `SELECT` only on the readiness relation.

`PUBLIC`, `anon`, `authenticated` and `service_role` receive no readiness mutation privilege. No frontend or mutation endpoint can change readiness. The controlled activation path remains direct production migration/activation administration under the database owner role.

## Four-state activation simulation

Expected data-driven behavior:

1. pre-DDL: provider absent / not ready → current Owner queue 0; 000008/000009 are materialization gaps;
2. post-DDL: provider present / not ready → current Owner queue 0; no false queue from empty provider;
3. post-seed: provider present / ready and 000008/000009 high-level rows present → current Owner queue 0; both remain non-queue;
4. future real unresolved Payment after readiness: `BANK_CONFIRMED + DEAL_ALLOCATABLE + TO_VERIFY` with no attribution/scope/association → exactly one `GENUINELY_UNALLOCATED` Owner queue item; adding source-locked scope/Owner authority removes it without code change.

## PostgreSQL 17 target parity

CI persistence/privilege integration uses `postgres:17` and asserts major version 17 before migrations/tests. The Stage 3C, Stage 3D and Stage 3D.1 migrations are executed in sequence on PostgreSQL 17.

## Final production activation order

1. Fresh `CURRENT_STATE_FIRST`: production enum/domain, optional relations, DB identity/grants and current 17-payment snapshot.
2. Freeze exact tested application SHA and migration SHAs; require green A–AZ and NO-HARDCODE on that SHA.
3. Apply Stage 3C authority DDL, Stage 3D shape/least-privilege DDL, then Stage 3D.1 readiness DDL. Do not mark the provider READY yet.
4. Verify provider present / not ready, privilege boundary and current Owner queue 0.
5. In a separately authorized business-data mutation, materialize the four Finance authority rows and only source-locked high-level 000008/000009 authority rows. Do not invent exact 005/006 split or resource chains.
6. Validate initial authority bootstrap: required seed rows current/source-locked, no authority conflict, no false Owner queue, canonical current projection acceptance passes.
7. Controlled DB-owner activation: create/update readiness row `provider_key='PAYMENT_BUSINESS_AUTHORITY'`, `is_ready=true`, `ready_at=<transaction timestamp>`, `validation_ref=<approved bootstrap-validation reference>`.
8. Re-run canonical current projection. Require current Owner queue 0 and 000008/000009 non-queue.
9. Only then deploy the exact tested read-only V7 runtime and run authenticated Admin read-only smoke. Owner mutation endpoint remains disabled.
10. Merge/release remains a separate gate.

Current gates: `PREPRODUCTION_ACTIVATION_PREP=ALLOW`, `PRODUCTION_DDL=HOLD`, `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`, `PRODUCTION_DEPLOY=HOLD`, `UI_IMPLEMENTATION=HOLD`, `MERGE=HOLD`.
