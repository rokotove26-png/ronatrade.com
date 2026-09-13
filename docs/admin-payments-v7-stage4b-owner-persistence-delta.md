# Admin Payments V7 — Stage 4B Owner-persistence delta

Status: preparation only. Production DDL, business DML, backend/frontend deploy and merge remain HOLD.

## Read-only production source lock

CURRENT_STATE_FIRST on 2026-09-13 confirmed the physical production state:

- `payment_business_attributions_v7`: exists, 2 rows.
- `payment_business_attribution_lines_v7`: exists.
- `owner_payment_decision_audit_v7`: exists, 0 rows.
- `deal_finance_authority_v7`: exists, 4 rows.
- `admin_payments_v7_provider_readiness`: exists; `PAYMENT_BUSINESS_AUTHORITY.is_ready=true`.
- role `rona_payments_v7_reader`: exists.
- `persist_owner_payment_decision_v7(uuid,jsonb,jsonb)`: absent.

Actual `supabase_migrations.schema_migrations` contains the split lineage:

`20260913160703, 20260913160742, 20260913160902, 20260913160927, 20260913161026, 20260913161057, 20260913161140, 20260913161204, 20260913161257, 20260913161623, 20260913161909`.

Production version `20260913160703` is only the authority-core fragment. The repository file with that version is now a combined fresh-environment migration and also contains validation, audit, persistence and Finance objects. Therefore the repository `20260913160703...sql` is not a replay candidate for production. Future activation logic must compare actual `schema_migrations` plus `pg_catalog`, not filenames alone.

## Minimal delta

New migration:

`supabase/migrations/20260913181100_admin_payments_v7_stage4b_owner_persistence_delta.sql`

It contains only the sealed `persist_owner_payment_decision_v7(uuid,jsonb,jsonb)` function, `search_path` hardening, and EXECUTE revokes. It creates no tables/views/roles/readiness/Finance authority and contains no business DML.

Contract after delta:

- exact return type: `portal_private.payment_business_attributions_v7`;
- `SECURITY INVOKER`;
- advisory transaction lock per Payment;
- idempotent replay;
- exact current-leaf resolution;
- optimistic lock and supersession validation;
- append-only authority + immutable audit in one transaction;
- no UPDATE/DELETE of prior authority;
- `search_path=pg_catalog, portal_private`;
- EXECUTE=false for PUBLIC, anon, authenticated, service_role and `rona_payments_v7_reader`;
- trusted function-owner/server DB context remains callable.

## PG17 production-parity QA

`tests/admin-payments-v7/stage4b-production-substrate.sql` models an already-existing split production substrate with function absent and current seed present.

`tests/admin-payments-v7/stage4b-owner-persistence-delta.sql` checks the split-lineage + pg_catalog precondition, exact signature/return/security/search_path/ACL, zero business-row change, trusted server invocation, idempotent replay, stale rejection, atomic rollback on audit failure and audit immutability. Synthetic mutations are transaction-rolled-back.

Expected marker: `business_rows_changed=0`.

## Privilege matrix

| Principal | EXECUTE |
|---|---:|
| PUBLIC | false |
| anon | false |
| authenticated | false |
| service_role | false |
| rona_payments_v7_reader | false |
| trusted function-owner/server DB context | true |

## Production execution checklist — requires separate Owner authorization

1. Repeat the read-only physical-state and migration-lineage preflight immediately before any future execution.
2. Require the function to still be absent and readiness/counts to match the approved preflight.
3. Verify the approved Stage-4B migration filename and blob/SHA; no full-migration replay.
4. Capture before counts for Deals, Payments, Payment Allocations, V7 attributions, Finance authority, Owner audit and readiness.
5. If separately authorized, execute only the single Stage-4B delta through the controlled migration mechanism.
6. Re-check exact identity arguments, return type, `SECURITY INVOKER`, hardened search_path and ACL.
7. Re-check business counts/readiness unchanged and Owner audit still zero.
8. Confirm the new version is recorded by the normal migration mechanism.
9. Stop: no Owner endpoint or frontend/backend deploy until Stage 5C receives separate authorization.

## Gates

`PRODUCTION_DDL=HOLD`
`PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`
`BACKEND_PRODUCTION_DEPLOY=HOLD`
`FRONTEND_PRODUCTION_DEPLOY=HOLD`
`MERGE=HOLD`
