# RONA Trade — LK post-acceptance cleanup and security closure

Date: 2026-10-13. Actor: SYSTEM_ADMIN / AI-SYSTEM-ADMIN.
Owner states the **currently visible and functioning Client/Admin LK is accepted**. Do not treat this as retroactive approval of unpublished PR #1172–#1179.
Protected production source baseline: `release/public-go-live-v1.1@f8f0233a33b321e8fc54a7e404cd85e3eff21718`.
Scope: **technical source/route cleanup only**; no new visual author, business-data updates, AI-role privilege expansion, wholesale historical-data deletion, or deploy without gates.

## Current repository and runtime evidence

- Exact baseline `git/trees?recursive=1`: 1,465 entries (1,323 tracked blobs), about 164.6 MB. Large bilingual public pages, archival canonical Admin/Agent source, authorized V20 Client runtime and stored reconciliation evidence account for most bytes; file size or an old version suffix alone is **not** proof of dead code.
- Supabase live `sxawrwzeobaqwwmlkzws`: 103 ACTIVE Edge Functions, 26 configured `verify_jwt=false` (custom auth must be separately assessed). Do **not** blanket remove JWT-off functions; `rona-env-capability-probe-20260817` is invoked by the market-source processor, and `rona-temp-upload-order-20260816` is a signed-document flow dependency.
- Prior 2026-10-11 Analytics V6 retirement already removed competing Admin V455 Analytics script endpoint and LPG V13 SVG repainter. V6 source strips `renderAnalytics` from served Admin historical owner chunks and preserves current R4 chart; the historical source chunks are still transformation inputs. No further deletion of this chain is safe without a source-graph rewrite.
- Current `admin-operations-command-center-v10-clean.js` imports the patch chain through V9.1; older V4/V7/V9 fragments are **live input dependencies**, not independent dead overlays. `admin-approved-shell-v455-ui.js` remains the current sidebar visual owner.
- Preserve frozen baseline Git blobs of nine critical Client/Admin/R4/market-news sources, checked in `tests/security/lk-postacceptance-cleanup-v1.test.mjs`.

## Verified unused route: soft retirement, not hard deletion

`functions/portal/news-current-ui.js` was a standalone four-byte literal `test` (source Git blob `30d74d258442c7c65512eafab474568dd706c430`). The current Market News page loads `assets/portal-market-news-current-v1.js` via `functions/portal/remaining-sections-ui.js`, and the active source scan checks for legacy-route references.

- Attempted source-locked hard deletion through GitHub was blocked by the tool's security restrictions. Do not bypass the restriction.
- Safe source state: replace the invalid stub with explicit JSON HTTP `410 Gone`, `cache-control:no-store`, without adding a visual writer.
- Real hard deletion requires authorized deletion-capable tooling **plus** actual traffic/consumer proof; it is **not claimed as completed**.

## Live database red zones (catalog-verified)

**P0 least privilege, exact two functions:** `public.rona_admin_rail_monitoring_complete_v1(text)`, `public.rona_admin_rail_monitoring_lifecycle_v1()`. Both are SECURITY DEFINER. Live `proacl` shows direct `anon=X/postgres` in addition to `authenticated=X/postgres`, `service_role=X/postgres`, and postgres. Both first require `portal_private.application_owner_admin_actor_v2()` (JWT-backed user + session_id, non-revoked session in `auth.sessions`, portal AUTH ADMIN role). Read-only negative anonymous role calls returned `P0001 APPLICATION_OWNER_ADMIN_REQUIRED` for both functions. Therefore explicit `anon EXECUTE` is redundant for the tested caller and should be revoked while preserving authenticated and service-role grants.

**P1 parser search path:** `portal_private.mi_curve_code_value_v1(text,text)` is `SECURITY INVOKER`, immutable, uses only pg_catalog builtins `regexp_match` and `upper`, current `proconfig = NULL`. Pin `search_path = pg_catalog, pg_temp`; preserve function body and invoker status.

Prepared exact migration:
`supabase/migrations/20261013093500_lk_rail_anon_execute_and_parser_path_v1.sql`.
Exact prior-state rollback:
`supabase/rollbacks/20261013093500_lk_rail_anon_execute_and_parser_path_v1_rollback.sql`.
Only two explicit `anon` revocations and one function config change; preflight/postflight require authenticated Rail access remains granted. **A source commit alone does not apply this migration to production.**

### Other Supabase advisors: classify, do not bulk mutate

- Security: 148 `RLS enabled without policies` INFO, overwhelmingly private deny-by-default tables, not proof of external exposure. 66 authenticated SECURITY DEFINER RPC WARN require per-function auth check, **not** blanket revocation. `pg_net` extension in public WARN: moving could break dependencies, separate change. Compromised-password protection WARN: Auth configuration, separate security operations.
- Performance: 240 unindexed foreign keys INFO, 448 no-PK objects INFO (includes emergency backup schemas), 136 allegedly unused indexes INFO. Advisor counts alone do **not** justify creating hundreds of indexes, dropping backup objects or removing indexes without live workload and rollback.
- Official lint references: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable .

## Edge function retirement: maintain a HOLD ledger

Prior `docs/track-a-edge-retirement-db-workload-audit-20260920.md` classified 26 historical QA/G82 functions as `410/RUNTIME_RETIRED_PRE_OWNER_UAT` retirement candidates. Live 2026-10-13 catalog still lists the historical QA slugs as ACTIVE; spot source reads reconfirm 410 for `rona-portal-api-phase5c2-qa`, `rona-g5c7-qa`, and `rona-g82-uat-final-v2`.
**Do not confuse ACTIVE registration with active business use, or 410 stub source with zero external callers.** Retention until supported time-window request logs, DB invoker/ref search, consumer tracing, exact backup/export and deletion-capable access. Keep market source, staff workspace, session broker and signed upload intact.

## Required verification and rollback

1. PR CI: exact release merge-base, only allowlisted edits, Node source-contract tests and hash locks (nine protected blobs), canonical build, Client visual freeze QA.
2. SQL preflight on live catalogue; after authorized migration, verify `anon` denied, `authenticated` still EXECUTE, function parser sample unchanged and search_path fixed; no modifications to records.
3. Negative HTTP-level and credential-backed Rail and Admin/Client session UAT where feasible; DB-role simulation is not a substitute.
4. Owner alone governs visual changes; this patch must not change any protected visual source. Rollback the PR to the exact baseline or execute recorded SQL rollback by authorized migration process; no silent data cleanup.

**Status:** candidate prepared; production and legacy archive preserved pending passing source and migration gates. No general deletion of `portal-src/canonical`, `owner-ui-chunks`, `remaining-sections-r2-base`, old Cloudflare compatibility URLs, Supabase backup tables or used Edge bridges.

## Exact applied SQL equality (reverified)

2026-10-13 `supabase_migrations.schema_migrations` shows `version=20261013093143`, `name=lk_rail_anon_execute_and_parser_path_v1`, `statement_count=1`. A read-only PostgreSQL equality comparison of `statements[1]` against the full current GitHub migration content returned `exact_git_sql_match=true`; both are 2465 characters and MD5 `5c99d0beee7ce0cfff675e11ff1fd680`. The cleanup source test now hash-locks those SQL bytes. **Production application is complete; no repeat migration is needed.** The original source filename starts `20261013093500` instead of the recorded `20261013093143`. No migration registry rows were rewritten or deleted. Before invoking `supabase db push`/other auto-apply against production, reconcile the version mapping through an authorized migration-repair workflow; NEVER infer that two different timestamps mean two different intended database changes.
