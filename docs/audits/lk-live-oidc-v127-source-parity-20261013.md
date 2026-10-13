# RONA Trade: reconcile GitHub OIDC source with already deployed Supabase Edge v127

Date: 2026-10-13. Canonical role: SYSTEM_ADMIN. Accepted Client/Admin LK UI visually and functionally unchanged.

## Live facts / exact source parity

Live Supabase `rona-g82-github-oidc-browser-qa-20260816`: `status=ACTIVE`, `version=127`, `verify_jwt=false` because the code requires and cryptographically verifies GitHub-signed OIDC RS256/JWKS claims with restricted repository/ref/audience. Re-read source via connected Supabase and compared to GitHub historical PR #1181 commit `73b9f033c9a4d79749634864db9d31bded422150`: **entire `index.ts` matches byte-for-byte**, source length 30043, Git blob `45a44bc3c07c63caf23f2240c663157e34700da3`. `deno.json` matches current release and live source exactly (105 bytes).

Previous release GitHub source `dd077e54c722eb7a35e6a5f05db75d58570f3f1d` was **older than actual deployed v127** and lacked the fully current production OIDC source. This source-only PR replaces that one outdated `index.ts` with the **already deployed** v127 text, and adds a source parity test, CI workflow, and this audit. It does not call Supabase deploy, change current Auth grants or users, or touch Client/Admin/Analytics/Payments visuals.

Security properties preserved byte-for-byte from active v127:
- For verified GitHub OIDC tokens with `profile=LEGACY`, return HTTP `410 PR462_LEGACY_QA_ADMIN_ISSUANCE_RETIRED` without calling historical `issueLegacy`.
- `Issue430`, `RADIO_STAGE2A`, Stage2B and Stage2C1 OIDC flows and their revoke/teardown helpers retain their current live verified source and claims guard.
- Existing v127 source still includes an **unreachable historical** function `issueLegacy`; it has no caller after the Legacy 410 handler. A later attempted **1,556-byte** source-only deletion in original PR #1181 passed focused tests, but the tool **blocked deploying the edited Edge**. That unpublished deletion is explicitly NOT part of this source parity PR. Do not introduce source/live drift by merging the blocked v128 source as if it were deployed.

## Verification and release boundaries

1. Exact checksum test of the 30043-character Git OIDC blob and the no-LEGACY caller; references only known official live/source values.
2. Source-only allowlist + exact release baseline SHA `193db1e476675157bd51887d52f39092a4ed3e8b`. No SQL migration filenames or visual runtime files.
3. Client Portal visual freeze and canonical build must remain green.
4. Publishing Git source parity does **not** change the deployed Supabase function, which already runs this code. Immediately post-merge re-read the live Edge and compare the exact bytes again.
5. For rollback of this Git-only correction, restore original release Git blob `dd077e54c722eb7a35e6a5f05db75d58570f3f1d`; do not automatically redeploy that obsolete source into production because it contains the historical PR462 Admin issuer.
6. Live HTTP negative tests for missing/malformed GitHub OIDC were passed earlier in [run 38390857506](https://github.com/rokotove26-png/ronatrade.com/actions/runs/38390857506), returning 401. Real valid signed `LEGACY` 410 HTTP test remains unverified and is not claimed as green.
