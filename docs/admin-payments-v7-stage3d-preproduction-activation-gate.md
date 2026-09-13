# Admin Payments V7 — Stage 3D pre-production activation gate

Status: `PREPRODUCTION_ACTIVATION_PREP / NO_PRODUCTION_DDL / NO_PRODUCTION_DML / NO_DEPLOY / NO_UI`.

Production read-only snapshot was taken on 2026-09-13 from the same relations used by the canonical V7 source reader. At snapshot time all four optional V7 relations were absent: `payment_business_attributions_v7`, `payment_business_attribution_lines_v7`, `deal_finance_authority_v7`, `payment_resource_chains_v7`.

## Capability-flip activation rule

Provider relation existence is a capability signal, not an authoritative statement that every payment without a normalized row is genuinely unallocated. An empty newly-created provider therefore must not create Owner actions.

Canonical no-claim rule after Stage 3D:

- provider absent + no claim => `AUTHORITY_MATERIALIZATION_REQUIRED`;
- provider present but empty + no explicit authoritative unallocated state => `AUTHORITY_MATERIALIZATION_REQUIRED`;
- `GENUINELY_UNALLOCATED` requires an explicit authoritative unallocated state, not relation existence alone.

This rule makes the pre-DDL and empty-post-DDL reconciliation of the current 17 BANK_CONFIRMED payments identical. In particular PAYEV-2026-000008 and PAYEV-2026-000009 remain non-Owner-queue materialization gaps until their high-level Owner source rows are materialized.

## Current Owner high-level source

Exact source ref: `OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION`.

Repository source record: `docs/admin-payments-v7-stage3d-owner-source-record.md`, source-capture commit `84eb1d04f9a00145ce603ca1612cb3c35a935831`.

This source establishes only:

- PAYEV-2026-000008: business allocation fact known, exact Deal/amount binding `TO_VERIFY`;
- PAYEV-2026-000009: associated fee of PAYEV-2026-000008, exact Deal fee attribution `TO_VERIFY`.

It does not establish a Deal key, an exact amount split, a proportional split, or a resource chain.

## Final proposed high-level rows

### PAYEV-2026-000008

- payment key: `9fda9905-e782-42f3-8441-71ca866bee0d`
- classification: `OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED`
- attribution mode: `SCOPE_ONLY`
- decision type: `NULL`
- authority kind: `OWNER_CANON`
- authority source ref: `OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION`
- business scope refs: `[OWNER_ASSERTION:PAYEV-2026-000008:BUSINESS_ALLOCATION_KNOWN]`
- scope Deal keys: `[]`
- lines snapshot: `[]`
- principal payment key: `NULL`
- source locked: `true`
- exact Deal attribution: `TO_VERIFY`
- Owner generic queue: false

### PAYEV-2026-000009

- payment key: `7c6dba20-eb9f-47fe-a077-ec3bbf17bf29`
- classification: `ASSOCIATED_BANK_FEE`
- attribution mode: `SCOPE_ONLY`
- decision type: `NULL`
- authority kind: `OWNER_CANON`
- authority source ref: same Stage-3D Owner source ref
- business scope refs: associated-with PAYEV-2026-000008
- scope Deal keys: `[]`
- lines snapshot: `[]`
- principal payment key: `9fda9905-e782-42f3-8441-71ca866bee0d`
- source locked: `true`
- exact Deal fee attribution: `TO_VERIFY`
- Owner generic queue: false

## Finance rows for later authorized materialization

| Deal | Deal key | Total | Due now | Expected not due | Future conditional | Currency | Finance status | Documentary status |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| DEAL-2026-004 | `17503586-9909-58cc-99f6-92b2ba4d8797` | 236250 | 0 | 0 | 0 | USD | PAID | TO_VERIFY |
| DEAL-2026-005 | `51352e24-23f2-56c0-b56b-4290a11a4267` | 672500 | 0 | 470750 | 0 | USD | NOT_DUE | TO_VERIFY |
| DEAL-2026-006 | `68a82fae-ac16-5c3b-9a3a-4cd008e10b68` | 164400 | 0 | 115080 | 0 | USD | NOT_DUE | TO_VERIFY |
| DEAL-2026-009 | `6a2af55b-a945-43c0-8078-7385970c8dc3` | 31002300 | 0 | 9300690 | 21701610 | RUB | NOT_DUE | TO_VERIFY |

The detailed source-lock manifest remains in `docs/admin-payments-v7-stage3c-authority-materialization-plan.md`.

## Production DB identity and existing grant model

Read-only inspection on 2026-09-13 established:

- `portal_private` owner: `postgres`;
- schema ACL: `postgres=UC`, `service_role=U`;
- the V7 runtime uses `postgres.js` with `SUPABASE_DB_URL`;
- current production `postgres.js` sessions are connected as database user `postgres`;
- base source tables are owned by `postgres`; several expose `service_role=arw`, while `owner_deal_workflow`, `owner_outgoing_payment_facts` and `payment_allocation_authority_history_v1` do not expose equivalent service-role table ACLs.

Because the direct connection identity is the broad `postgres` role, Stage 3D introduces a NOLOGIN transaction role `rona_payments_v7_reader`. After DDL activation, every V7 snapshot transaction executes `SET LOCAL ROLE rona_payments_v7_reader` before any source read. This constrains the V7 read path without changing the production database secret.

## Proposed privilege matrix

| Principal | Schema usage | Existing V7 source relations | New V7 authority/finance relations | Owner audit | Owner persistence RPC |
| --- | --- | --- | --- | --- | --- |
| `postgres` | owner | owner | owner | owner | owner only |
| `rona_payments_v7_reader` | USAGE | SELECT only on exact source-reader set | SELECT only on attribution header/view + Finance authority; resource-chain SELECT only if relation exists | none | no EXECUTE |
| `service_role` | existing USAGE unchanged | existing ACL unchanged | none from Stage 3D | none | no EXECUTE |
| `authenticated` | none added | none added | none | none | no EXECUTE |
| `anon` | none added | none added | none | none | no EXECUTE |
| `PUBLIC` | none added | none added | none | none | no EXECUTE |

Exact policy is implemented in branch-only migration `20260913160000_admin_payments_v7_stage3d_activation_gate.sql` with explicit `REVOKE` / `GRANT` statements. No production migration has been applied.

## Future Owner mutation endpoint note

`persist_owner_payment_decision_v7` remains disconnected from all production endpoints and is explicitly not executable by `PUBLIC`, `anon`, `authenticated`, `service_role`, or `rona_payments_v7_reader`.

Before a future Owner mutation endpoint can be enabled, the server must re-read a fresh transaction snapshot and perform reconciliation/stale-write validation against **all current authority sources**: normalized V7 authority, current verified payment allocation authority, Owner outgoing facts and any other current source-lock. A normalized-table `supersedes_id` check alone is insufficient. This future mutation requirement does not block read-only V7 activation while the mutation RPC remains unreachable to application roles.

## Exact production activation order

1. Re-run CURRENT_STATE_FIRST and confirm the production raw snapshot, optional-relation absence/presence, DB identity and grants have not changed.
2. Freeze exact tested application SHA and migration SHA; require green A–AT and NO-HARDCODE on the same SHA.
3. Apply Stage-3C authority migration and Stage-3D activation-gate migration. Do not materialize business rows in the same step.
4. Verify schema/constraint/privilege post-DDL checks: application roles cannot execute Owner persistence; `rona_payments_v7_reader` has only required SELECT; no Owner queue is generated by an empty provider.
5. In a separately authorized business-data mutation, insert the four Finance authority rows and only the two source-locked high-level 000008/000009 rows. Do not insert exact 005/006 splits or resource chains.
6. Run canonical read-only post-materialization preview and require: Owner queue 0, authority conflict 0, exact Finance acceptance values, 000008/000009 non-queue gaps, 005/006 shared split `TO_VERIFY`, cross-currency spend `TO_VERIFY`.
7. Only after those checks deploy the tested V7 read-only runtime. The runtime must switch the snapshot transaction to `rona_payments_v7_reader`.
8. Run authenticated Admin read-only smoke. Do not enable any Owner mutation endpoint.
9. Keep merge/release gate separate until operational acceptance is recorded.

## Rollback plan

Pre-materialization rollback:

1. Do not deploy the V7 runtime, or roll it back to the previously deployed Edge Function version if it was already deployed in a later authorized stage.
2. Revoke `rona_payments_v7_reader` usage/select and remove its membership from `postgres` if the new read path must be disabled.
3. Because no business rows exist yet, Stage-3D schema objects can be removed by a dedicated rollback migration if required. Never issue ad-hoc production DDL.

Post-materialization rollback:

1. Roll back the application runtime first; do not delete authoritative/audit rows to simulate rollback.
2. Preserve normalized rows for audit. Any business correction must be append + supersession, never UPDATE/DELETE of sealed authority.
3. If V7 reads must be disabled, revoke the reader role grants while preserving data.
4. Drop V7 schema objects only under a separately approved data-retention/migration plan after confirming no downstream consumer depends on them.

Current gates remain: `PREPRODUCTION_ACTIVATION_PREP=ALLOW`, `PRODUCTION_DDL=HOLD`, `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`, `PRODUCTION_DEPLOY=HOLD`, `UI_IMPLEMENTATION=HOLD`, `MERGE=HOLD`.
