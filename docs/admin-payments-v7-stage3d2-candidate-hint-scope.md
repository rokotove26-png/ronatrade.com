# Admin Payments V7 — Stage 3D.2 candidate hint != authoritative scope

Status: `PREPRODUCTION_ACTIVATION_PREP / NO_PRODUCTION_DDL / NO_PRODUCTION_DML / NO_DEPLOY / NO_UI`.

Stage 3D.2 restores the Stage-2 invariant that `payments.candidate_deal_ids` is presentation/reconciliation-hint data only. It is not attribution authority and cannot independently establish known business scope.

## CURRENT_STATE_FIRST

Exact pre-write PR head: `40675f94e52c6c3ec222e32893acf6ecd109e820`.

Fresh read-only production inspection on 2026-09-13 confirmed:

- PostgreSQL 17.6 (`server_version_num=170006`);
- `allocation_review_state_enum = NOT_APPLICABLE | TO_VERIFY | VERIFIED`;
- 17 current BANK_CONFIRMED Payments;
- 13 current BANK_CONFIRMED + DEAL_ALLOCATABLE Payments;
- V7 payment-authority, readiness, Finance-authority and resource-chain relations remain absent in production.

No production DDL, business-data write or deploy was performed.

## Candidate-vs-scope contract

The reconciliation contract now carries two different fields:

- `candidate_deal_ids`: copied from the immutable Payment fact and exposed only as a hint;
- `scope_deal_keys`: derived only from current/source-locked attribution authority.

Candidate IDs never populate `scope_deal_keys` by themselves and never suppress a genuine Owner decision.

Authoritative scope may be established by allowed source-locked reconciliation claims such as:

- normalized V7 attribution;
- current VERIFIED allocation authority;
- authoritative `owner_outgoing_payment_facts`;
- explicit Owner authority;
- another accepted current/source-locked attribution source.

`paymentException(...)` exposes candidate hints and authoritative scope separately. `known_scope_refs` is populated from authoritative business-scope provenance rather than candidate hints.

## Genuine-unallocated with candidates

After the provider is READY, a current/source-locked:

`BANK_CONFIRMED + DEAL_ALLOCATABLE + allocation_review_status=TO_VERIFY`

with no current attribution authority is `GENUINELY_UNALLOCATED` even when one or several candidate Deal IDs are present.

The Owner queue item may include those candidates as hints, while authoritative `scope_deal_keys` remains empty.

When an accepted source-locked scope claim later appears, the same Payment becomes the corresponding scope reconciliation state and disappears from the Owner queue without application-code change.

## Preserved Stage 3D.1 contracts

Unchanged:

- provider presence/readiness architecture;
- upstream Payment enum;
- PAYEV-2026-000008 Owner assertion canon;
- PAYEV-2026-000009 associated-fee canon;
- Finance materialization plan;
- unresolved 005/006 KUZMASH exact split;
- resource-chain rules;
- upstream lifecycle.

The existing current-17 simulation remains required to produce Owner queue 0 after bootstrap seed: 000008/000009 remain non-queue, 005/006 shared authoritative scope remains non-queue, VERIFIED allocation authority remains authoritative, and FX remains NOT_APPLICABLE.

## QA gates

Stage 3D.2 adds:

- BA — candidate hint does not suppress Owner queue;
- BB — multiple candidate hints do not become shared scope;
- BC — candidates are exposed as hints while authoritative scope stays empty;
- BD — a source-locked authoritative scope removes the queue item and populates authoritative scope.

All prior A–AZ gates remain mandatory. PostgreSQL 17 parity, Deno target import checking and NO-HARDCODE remain mandatory.

Current gates: `PREPRODUCTION_ACTIVATION_PREP=ALLOW`, `PRODUCTION_DDL=HOLD`, `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`, `PRODUCTION_DEPLOY=HOLD`, `UI_IMPLEMENTATION=HOLD`, `MERGE=HOLD`.
