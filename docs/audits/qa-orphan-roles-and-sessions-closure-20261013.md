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

**Postflight status:** exact SQL APPLIED in production and independently verified; source PR remains DRAFT, with no release branch merge or visual change.

## Production application, source equality and verification

- Dedicated [focused CI run 38387944832](https://github.com/rokotove26-png/ronatrade.com/actions/runs/38387944832): SUCCESS (3 source-contract tests / 0 failures). [Client Portal visual freeze run 38387944843](https://github.com/rokotove26-png/ronatrade.com/actions/runs/38387944843): SUCCESS.
- Supported Supabase apply_migration returned `success:true`; live migration history `version=20261013110724`, `name=radio_qa_orphan_admin_and_suspended_oidc_session_closure_v1`.
- Read-only PostgreSQL equality test compared full source SQL to `supabase_migrations.schema_migrations.statements[1]`: `exact_source_match=true`; both **8671 characters**, MD5 `06ab0896148867026dfb3f0ccdcb226e`. Dedicated security test now hash-locks this SQL; never change it after deployment.
- Postflight found precisely 3 Radio QA ADMIN role rows with `reason='POST_ACCEPTANCE_RADIO_QA_ORPHAN_ADMIN_ROLE_RETIREMENT'` and `status='REVOKED'` plus 3 QA-only OPERATIONS_DIRECTOR staff rows with the corresponding retirement reason and `status='REVOKED'`.
- Suspended Issue430 QA: 6/6 sessions expired, zero unexpired; suspended PR462 QA: 1/1 expired, zero unexpired.
- **Global orphan check** over all current portal roles and staff roles found **zero ACTIVE grants attached to non-ACTIVE/non-ACTIVE lifecycle users or accounts without Auth links**. This is broader than the targeted 3+3 records.
- Unverified groups were not altered: `QA_PHASE5C` one non-expiring session remains; `ADMIN_PORTAL` suspended cohort has 130 users/116 non-expired session records (the earlier 53 count was a narrower QA-name subset). No role grants ACTIVE in these two suspended populations.
- Live migration history version `20261013110724` differs from source filename prefix `20261013113500`. This is only a version-lineage mismatch, not a SQL content mismatch. An authorized supported Supabase migration repair is required before automatic replay / `db push`. Database migration must not be executed again.
- Source PR #1182 remains DRAFT due other unrelated full-suite release failures; the IAM-only changes were applied separately through authorized migration tooling. Accepted UI and active business data remain unchanged.

## QA_PHASE5C single-session follow-up (2026-10-13)

A separate **not-yet-applied** source migration `supabase/migrations/20261013115000_expire_single_suspended_phase5c_qa_session_v1.sql` expires **only one** NULL-expiry Auth session from `QA_PHASE5C`. Original cohort has five SUSPENDED users; exactly one Auth session without expiry created on Aug 13, with login `qa_*`, no sign-in since Aug 14, no active portal/staff roles, deal grants, Client/Agent bindings or shared Auth user. The Auth email domain is NOT `example.invalid`; for that reason, even though this is an explicitly suspended QA identity, the migration limits changes to that one session and never changes the user's email, Auth user record, portal status or grants.

Preflight inside one transaction checks source_system/status/lifecycle/QA login, source timestamp before Aug 20, last sign-in before Sep 1, exactly one session and unshared Auth user with no active permissions. It updates only `auth.sessions.not_after`, demands exactly one row, and aborts on conflict. No token creation, account deletion or business fact changes. The workflow now requires four tests (rather than three), with one independently scoped QA_PHASE5C test and allowlisted file. Record actual production migration version and postflight only after supported CI PASS and authorized apply; avoid a statement of completion until then.
