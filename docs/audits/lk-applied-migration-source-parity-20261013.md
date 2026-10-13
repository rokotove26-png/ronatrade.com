# RONA Trade LK: restore canonical source history of four already-applied SQL migrations

Audit time: 2026-10-13. Authority: SYSTEM_ADMIN, technical IAM/INFRA.
Release base: `release/public-go-live-v1.1@f8f0233a33b321e8fc54a7e404cd85e3eff21718`.
User's currently live Client/Admin visuals and functionality are accepted. No visual, deployed business or Auth privilege mutation is part of this source reconciliation.

## Source lock: verified directly against LIVE Supabase

On the same turn, read all four original GitHub SQL source blobs and compared each entire text under read-only SQL against `supabase_migrations.schema_migrations.statements[1]` for the exact `version` and `name` of the LIVE row. Each comparison returned `exact_source_match=true`. New release-source files have **exactly the same Git blob SHA** as the original applied SQL, with only file path/version prefix changed:

| Supabase applied version | Migration name | SQL length | SQL MD5 | Immutable Git blob |
|---|---|---:|---|---|
| 20261013093143 | lk_rail_anon_execute_and_parser_path_v1 | 2465 | `5c99d0beee7ce0cfff675e11ff1fd680` | `c08bf41baebcf7a4391a15c7f24ea724466cf363` |
| 20261013104046 | quarantine_stale_pr462_qa_admin_v1 | 6507 | `c58459191891cb5e99d95ea3f3edd466` | `8a4515fdb8f9d0812078644aea09d1ecc0cdcbf7` |
| 20261013110724 | radio_qa_orphan_admin_and_suspended_oidc_session_closure_v1 | 8671 | `06ab0896148867026dfb3f0ccdcb226e` | `b5a3e3bbc3941a44869770bb352b0f1753a1423a` |
| 20261013112823 | expire_single_suspended_phase5c_qa_session_v1 | 3480 | `32672e237d8dc70900383bea2da41572` | `1131c93eb6f87850a1b79df981096e45649608f1` |

**All four are already applied to production.** The source-code filename versions in old Draft PRs #1180-#1182 used different prefixes. Those Draft files must not be included in any merge or future SQL auto-apply workflow.

This recovery PR contains only these four accurately named applied SQL files, the source parity test, a focused CI workflow, and this audit record. It does not run `supabase db push`, mutate `supabase_migrations`, call `apply_migration` or deploy any service. A system-aware Supabase CLI should recognize these four exact versions as already applied and not plan them for execution; a real linked CLI `migration list` / `db push --dry-run` (where supported) is the final authorization gate before any production DB synchronization. If that tool reports drift, fail closed and investigate: **never edit the history table manually, reapply already-applied SQL, or mark the release accepted without verifying the remote's version plan.**

## Security state and limitations

- Rail two Admin SECURITY DEFINER RPC direct `anon EXECUTE` revocations and private parser fixed search_path are applied; public `SECURITY DEFINER` effective anonymous execute is 0/131 (at last verified live read).
- 33 PR462 QA ADMIN accounts/roles/sessions quarantined, 3 orphan QA ADMIN + 3 qa_only staff grants revoked, seven suspended Issue430/PR462 QA sessions and one Phase5C session expired. Later PG read-only broad QA scan: 0 ACTIVE QA users, 0 ACTIVE QA ADMIN grants, 0 unexpired QA-linked sessions.
- Edge OIDC currently v127 includes Legacy signed-route 410 but still retains unreachable 1,556-byte issuer implementation in live source; a later GitHub source-only deletion is NOT deployed because the deployment tool blocked it. Do not conflate source and live versions.
- PR #1179 Admin session failover hardening is source-only, Draft. Real production 302 deny for absent/forged cookies verified, yet credential-backed revoked **signed** JWT and cross-tenant A/B/A tests remain unverified. No security-check waiver is claimed.
- PR #1183 4-byte news debug endpoint 410 candidate is source-only, DRAFT and not deployed. It has no database migration. Its Owner-approved live visual sources are untouched.
- Old 26 HTTP410 QA Edge registrations are retained pending supported deletion and longer-lived consumer observations.

## Operational sequence

1. Get exact-head focused migration-parity CI PASS, verify release diff contains no endpoint/runtime/UI changes.
2. Confirm live server migration version/name/checksum and all four same SQL bodies before release PR merge.
3. Preserve a snapshot of live migration history and original source blob IDs as rollback points; **SQL already ran**; this is only recording canonical source.
4. Merge documentation/source parity to release only if branch protection and applicable checks permit it, then verify the release commit and absence of DB replay.
5. Resolve other PRs separately, without silently merging their mismatched migration filenames. After source parity confirmed, close/rebase superseded Draft sources only when all needed content is otherwise preserved.
