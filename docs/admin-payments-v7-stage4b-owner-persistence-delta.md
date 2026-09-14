# Admin Payments V7 — Stage 4B Owner-persistence delta

Status: `PRODUCTION_APPLIED / REPOSITORY_LINEAGE_SYNCED`. Stage 4B production DDL was executed separately under Owner authorization before Stage 5C work. No Stage 5C backend/frontend deployment is implied by this document.

## Production source lock after Stage 4B-PROD

Read-only production verification on 2026-09-13 confirms:

- `payment_business_attributions_v7`: exists, 2 rows;
- `payment_business_attribution_lines_v7`: exists;
- `owner_payment_decision_audit_v7`: exists, 0 rows;
- `deal_finance_authority_v7`: exists, 4 rows;
- `admin_payments_v7_provider_readiness`: exists; `PAYMENT_BUSINESS_AUTHORITY.is_ready=true`;
- role `rona_payments_v7_reader`: exists;
- `persist_owner_payment_decision_v7(uuid,jsonb,jsonb)`: exists;
- exact return type: `portal_private.payment_business_attributions_v7`;
- `SECURITY INVOKER`;
- `search_path=pg_catalog, portal_private`;
- EXECUTE=false for `anon`, `authenticated`, `service_role`, and `rona_payments_v7_reader`.

Actual `supabase_migrations.schema_migrations` contains the split lineage through Stage 4A plus the production Stage 4B version:

`20260913160703, 20260913160742, 20260913160902, 20260913160927, 20260913161026, 20260913161057, 20260913161140, 20260913161204, 20260913161257, 20260913161623, 20260913161909, 20260913182849`.

Production version `20260913160703` remains only the original authority-core fragment. The repository file carrying that historical version is a combined fresh-environment migration and must never be replayed as a production activation shortcut. Activation logic must compare actual `schema_migrations` plus `pg_catalog`, not repository filenames alone.

## Canonical Stage 4B migration lineage

The repository migration filename is synchronized to the version actually registered by Supabase in production:

`supabase/migrations/20260913182849_admin_payments_v7_stage4b_owner_persistence_delta.sql`

Its SQL body is unchanged from the previously prepared Stage 4B delta. The repository-only filename `20260913181100_admin_payments_v7_stage4b_owner_persistence_delta.sql` is retired and must not be used.

The migration contains only:

- `portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)`;
- `ALTER FUNCTION ... SET search_path = pg_catalog, portal_private`;
- EXECUTE revokes from browser/app/read roles.

It does not create tables/views/roles/readiness/Finance authority and contains no top-level business DML.

## Persistence contract

The sealed primitive provides:

- advisory transaction lock per Payment;
- idempotent replay;
- exact current-leaf resolution;
- optimistic locking and supersession validation;
- append-only authority plus immutable audit insert in one transaction;
- no UPDATE/DELETE of prior authority;
- direct execution denied to browser/app roles.

Trusted backend DB context is the only intended caller.

## PG17 regression

`tests/admin-payments-v7/stage4b-production-substrate.sql` models the pre-delta split substrate.

`tests/admin-payments-v7/stage4b-owner-persistence-delta.sql` applies the canonical `20260913182849` migration in PG17 and verifies exact signature/return/security/search_path/ACL, zero business-row change, trusted server invocation, idempotent replay, stale rejection, atomic rollback on audit failure and audit immutability.

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

## Current gates after Stage 4B-PROD

`PRODUCTION_DDL=HOLD`
`PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`
`BACKEND_PRODUCTION_DEPLOY=HOLD`
`FRONTEND_PRODUCTION_DEPLOY=HOLD`
`MERGE=HOLD`

Stage 5C may now build the authenticated Owner mutation endpoint against this existing production primitive, but nothing is deployed by repository implementation or CI.
