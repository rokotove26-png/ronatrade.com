# RONA Trade — P0 stale PR462 OIDC QA Admin closure

Date: 2026-10-13. Authority: SYSTEM_ADMIN technical IAM/security, Owner-authorized post-acceptance cleanup. Visual/Client/Admin current production UI is unchanged.

## Live source evidence, before quarantine

- `portal_private.portal_users.source_system='QA_GITHUB_OIDC_PR462'`: 33 `ACTIVE/ACTIVE` technical test accounts, each with one `ACTIVE ADMIN` role, one `auth.sessions` row having `not_after IS NULL`.
- All 33 have technical `qa_pr462_*` login names, `qa-pr462-*@example.invalid` email addresses and `RUN_*` source versions dated 2026-09-12 to 2026-09-17; no sign-in in the last 14 days.
- No active other role, staff role, Client or Agent binding; no shared `auth_user_id` with other portal users. Source-lock gate demands these properties and the exact 33/33/33 totals.
- One additional `SUSPENDED/SUSPENDED` PR462 test account already had a `REVOKED` Admin grant; **not targeted**, retained for separate audit.
- The historical GitHub branch `feat/admin-payments-final-owner-screen-passport-v1` and `pr462-live-preview-finance-qa.yml` still exist; OIDC Edge `rona-g82-github-oidc-browser-qa-20260816` version 126 included a legacy issuance path that could mint new temporary production QA Admin users when called with valid scoped GitHub OIDC. This is an authorized QA design but no longer needed after Owner acceptance. It is not evidence of attacker exploitation.

## Production containment already executed

Migration name `quarantine_stale_pr462_qa_admin_v1`, Supabase server-assigned migration version `20261013104046`. Checked-in full SQL:
`supabase/migrations/20261013133500_quarantine_stale_pr462_qa_admin_v1.sql`.

The transaction locks and checks the exact historical cohort before any update. It atomically expires only the 33 matching `auth.sessions.not_after`, revokes only those 33 `ADMIN` role grants and archives exactly those 33 QA portal users. It leaves `auth.users` intact for audit and changes no production business or human accounts.

Read-only postflight: 33 `REVOKED/ARCHIVED` QA users, 33 revoked Admin roles, 33 expired sessions, 0 active QA PR462 Admin users. The separate historical suspended account remained unchanged, with a previously revoked role.

**One-way security compensation / rollback:** Do NOT reactivate old QA Admin grants or restore old session expirations. If a QA environment genuinely needs Admin credentials, issue **new** time-limited QA identities only through a newly owner-authorized, source-locked GitHub OIDC workflow; verify scope, cleanup, expiry and no business privileges. The previous rows remain as the audit/rollback evidence point. Source-control branch reversal or an old test rerun must never re-grant production Admin rights.

## Prevention of re-issuance

The current live OIDC version 126 differs from the release-source index.ts only by three Radio Stage2C.1 support edits. The candidate copies the verified live v126 source exactly and **only replaces the legacy PR462 request handler** with JSON `410`, `PR462_LEGACY_QA_ADMIN_ISSUANCE_RETIRED`. It preserves GitHub JWT RS256/JWKS verification, strict repository/ref/audience checks, Issue430 and Radio Stage2A/2B/2C1 issuance/revoke paths and the exact `deno.json` import map. The historical PR462 GitHub workflow will no longer be permitted to issue fresh production QA Admin identities after deployment.

The OIDC change is a separate Edge Function deployment and is **NOT implied by applying the database migration or merging this GitHub PR**. Its live version, source and authentication scope must be checked after the permitted deploy. No `verify_jwt=true` override: this one existing endpoint uses independently verified signed GitHub OIDC tokens and previously had `verify_jwt=false`.

## Required technical gates

- Focused source-contract QA must PASS with zero test failures.
- Live postflight must remain 0 active PR462 Admin grants and 0 unexpired sessions for the quarantined 33.
- Edge deploy must preserve Issue430/Radio routes and exact OIDC verifier; unauthorized POST without GitHub token must still be denied.
- Confirm new OIDC legacy path responds 410 **only after legitimate signed GitHub PR462 identity verification**; no owner/admin credential token is embedded in repository, logs or artifact.
- All project UI byte-for-byte intact; no Owner visual revisit needed.
- Source migration filename differs from the Supabase server-assigned version. Before automated `supabase db push`, reconcile with supported migration-repair tooling; do not blindly reapply or rewrite migration history.

## Status

Database quarantine **APPLIED / VERIFIED**. Legacy PR462 OIDC Edge prevention **DEPLOYED / VERIFIED** as version 127, preserving independent Issue430/Radio OIDC checks. Source PR #1181 remains DRAFT because unrelated release CI is still red. Existing P0 Admin session-fallback PR #1179 and LK cleanup PR #1180 remain independently gated.

## Production OIDC Edge postflight

- Exact connected Supabase deployment: `rona-g82-github-oidc-browser-qa-20260816` **version 127**, `status=ACTIVE`, `verify_jwt=false` (unchanged verified GitHub-signed OIDC design). Server deployment reported import map from `deno.json`.
- Re-read deployed `index.ts` and compared with GitHub PR #1181 candidate: **identical**. `LEGACY` branch returns `410 PR462_LEGACY_QA_ADMIN_ISSUANCE_RETIRED`, and no caller invokes `issueLegacy(claims)`.
- `ISSUE430`, `RADIO_STAGE2A`, including 2B and 2C1, JWT RS256/JWKS, repository/ref/audience guard and revoke handlers are present.
- [Focused CI run 38385583626](https://github.com/rokotove26-png/ronatrade.com/actions/runs/38385583626) **SUCCESS**, 3 source/security tests; [Client visual-freeze run 38385583634](https://github.com/rokotove26-png/ronatrade.com/actions/runs/38385583634) **SUCCESS**. Other full PR checks remain incomplete/red and are not waived.
- Network sandbox did not resolve the Supabase public hostname, so unauthenticated live HTTP POST 401 and signed OIDC 410 **were not externally exercised**. Code-level and deployment-source verification are confirmed; no fake external E2E acceptance.
- Subsequent read-only QA-cohort scan identified 3 lingering **ACTIVE ADMIN role rows attached to REVOKED Radio Stage2A QA users with no linked auth_user_id or live session**. This is a low-exposure stale-permission inconsistency, **not** a valid active Admin login. Other historical suspended QA identities retain some non-expired auth sessions but their portal roles are REVOKED. Treat as a separate narrowly-scoped IAM hygiene item; do not bulk mutate the real ADMIN_PORTAL population without proven fixture lineage.
- Do not restore old PR462 Admin creation as a fallback; compensate any QA test need with a new, properly authorized short-lived QA identity and mandatory teardown.
