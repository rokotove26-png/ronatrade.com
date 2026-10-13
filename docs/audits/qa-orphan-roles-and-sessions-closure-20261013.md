# RONA Trade LK — radio QA orphan roles and suspended OIDC sessions

2026-10-13. Actor: SYSTEM_ADMIN. This is a narrow technical identity and session hygiene change, not an Operations Director business-domain action. Current Owner-accepted Client/Admin visual source and production business data are out of scope.

## Verified live catalog before action

1. **Three** `portal_private.portal_users` with source `QA_GITHUB_OIDC_RADIO_STAGE2A`, technical `qa_radio_stage2a_*` login, `RUN_*` version, source timestamp Sep 23, and `REVOKED/ARCHIVED` state still had **3 ACTIVE ADMIN portal grants** and **3 ACTIVE staff OPERATIONS_DIRECTOR grants** with `qa_only=true`, all `revoked_at=NULL`. Each had `auth_user_id=NULL`. No active Client/Agent bindings, deal grants, other roles or linked Auth session. Both sets of role grants are stale and internally inconsistent with the archived user state. No operational staff role or user is addressed unless it exactly belongs to this three-user QA cohort.
2. **Seven** `auth.sessions` (6 `QA_GITHUB_OIDC_ISSUE430` + 1 `QA_GITHUB_OIDC_PR462`) with `not_after=NULL` belong to seven `SUSPENDED/SUSPENDED` users whose logins start with `qa_issue430_` or `qa_pr462_`, source version starts `RUN_`, and corresponding Auth emails are `@example.invalid`. They have no current portal or staff grants, business bindings, deal grants or shared Auth identities.
3. One `QA_PHASE5C` suspended session with email outside `example.invalid` remains **HOLD** for separate lineage confirmation. 53 older unexpired sessions attached to `ADMIN_PORTAL` suspended records remain **HOLD**, without a verified non-business domain or full role lineage. No mass expiry.

## Exact proposed migration

`supabase/migrations/20261013113500_radio_qa_orphan_admin_and_suspended_oidc_session_closure_v1.sql`

One transaction with failure-aborting source gates: exactly 3 Radio QA accounts, 3 ACTIVE ADMIN grants, 3 ACTIVE `qa_only` OPERATIONS_DIRECTOR staff grants and no other active roles/bindings; exactly 7 suspended OIDC QA sessions (6 Issue430 + 1 PR462), exact emails/logins/source versions and no legitimate active permissions/auth sharing.

Only update: 3 `portal_user_roles` status/reason/timestamps to REVOKED; 3 `staff_user_roles` status/reason/timestamps to REVOKED; 7 `auth.sessions.not_after` to elapsed. All data and audit records stay; `auth.users`, `portal_users`, `ADMIN_PORTAL`, `QA_PHASE5C`, Client/Agent/Finance/Operations business tables and live UI untouched.

**Rollback/compensation:** never re-grant the stale QA roles or make expired sessions valid. Restore QA coverage only by authorizing a new ephemeral, source-locked GitHub OIDC test account with scoped role, enforced revocation, and QA-only audit. The original source hashes/SQL, prior status, and database audit rows are retained for incident review.

## Required proof

- A code-verified focused CI must pass the source-lock and release-delta tests (3 PASS, 0 FAIL). Other PR release CI are not waived.
- Read-only PostgreSQL after application must show **0 ACTIVE Radio QA ADMIN/staff grants for the 3 archived unlinked users** and **0 unexpired sessions among the seven selected QA users**.
- The counts and source status of `ADMIN_PORTAL`, `QA_PHASE5C` and real Owner, Client and Agent roles must not change.
- Supabase-generated migration history version may differ from the source filename. Record both and exact SQL hash; never replay by blindly applying a duplicate migration.

**Initial status:** SQL and source-contract prepared. Database write only after exact focused checks.
