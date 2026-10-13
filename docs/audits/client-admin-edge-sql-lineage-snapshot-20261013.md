# RONA Trade — Live Supabase Edge/DB source lineage snapshot (READ-ONLY)

**Captured:** 2026-10-13; **Project:** `sxawrwzeobaqwwmlkzws`; **Git source-lock:** `release/public-go-live-v1.1` @ `f8f0233a33b321e8fc54a7e404cd85e3eff21718`. Deployed Edge metadata and migration list were returned by Supabase API; source directories/files were returned by GitHub release tree. No SQL, Edge deploy, delete or role changes were performed.

## Inventory summary

| Category | Observed | Interpretation |
|---|---:|---|
| Deployed Edge functions | 103 | Supabase reported ACTIVE entries; a listed function does not prove active traffic |
| Deployed JWT-on / JWT-off | 77 / 26 | JWT-off does **not** establish that custom authentication is absent |
| Release Edge source directories (excluding `_shared`) | 27 | A release directory does not independently prove deployed source parity |
| Deployed functions with same-name release directory | 26 | **Name matched only**; verify source blob, import graph, and deployment version before claiming parity |
| Deployed functions without same-name release directory | 77 | **SOURCE_PROVENANCE_PENDING** — not necessarily orphaned or removable |
| Release directories without same-name deployed function | 1 | Do not deploy by guessing |
| Applied DB migrations | 562 | Version IDs from live Supabase migration registry |
| SQL migration files in release tree | 215 | Local names only, may differ from applied history/source location |
| Version IDs common to both | 40 | Name/version matching only, not SQL content hash proof |
| Applied version IDs absent from release folder | 522 | Recover historical migration lineage; **not proof of broken DB** |
| Release version IDs absent from applied list | 174 | Verify historical portability and supersession; do not apply automatically |

**Source-only Edge directories:** `rona-client-deal-documents`.

### Function categories and mandatory tests

1. `ACTIVE_CURRENT`: confirm each route is live, source pin/SHA, caller role, JWT and custom authorization before considering accepted.
2. `ACTIVE_LEGACY_DEPENDENCY`: explicitly retain `rona-temp-upload-order-20260816` (active v13, JWT-on), currently used by Client document-state route. Do not withdraw read/upload/write while there are callers.
3. `QA_WITH_AUTH` and `CANDIDATE`: classify by network/router/CI references and deny unauthorized production roles. JWT-off probes need custom-auth/source review.
4. `ORPHAN_UNVERIFIED`: only after proving no internal fetch, cron, webhook, secrets, required audit retention, deployment dependency and safe rollback; never bulk-delete based on directory mismatch.
5. `RETIRED`: requires independent signed evidence for each artifact. **Nothing in this report classifies an active function as retired.**

## Matched name inventory (26; name match ≠ exact source parity)

| Deployed name | Version | JWT | Status |
|---|---:|---|---|
| `rona-accounting-mail-bridge` | 6 | JWT off | ACTIVE |
| `rona-accounting-statement-intake` | 6 | JWT off | ACTIVE |
| `rona-admin-agent-access` | 3 | JWT on | ACTIVE |
| `rona-admin-authority` | 5 | JWT on | ACTIVE |
| `rona-admin-client-authority` | 7 | JWT on | ACTIVE |
| `rona-admin-contract-activation` | 9 | JWT on | ACTIVE |
| `rona-admin-control-plane` | 23 | JWT on | ACTIVE |
| `rona-ai-coordination-runtime` | 5 | JWT off | ACTIVE |
| `rona-ai-model-executor` | 14 | JWT off | ACTIVE |
| `rona-ai-read-extras` | 21 | JWT off | ACTIVE |
| `rona-ai-read-only` | 12 | JWT off | ACTIVE |
| `rona-ci-admin-session-broker` | 10 | JWT off | ACTIVE |
| `rona-env-capability-probe-20260817` | 7 | JWT off | ACTIVE |
| `rona-g82-github-oidc-browser-qa-20260816` | 126 | JWT off | ACTIVE |
| `rona-mail-auth-test` | 9 | JWT off | ACTIVE |
| `rona-mcp-consent-bridge` | 9 | JWT off | ACTIVE |
| `rona-mcp-gateway` | 87 | JWT off | ACTIVE |
| `rona-mcp-oauth-token` | 14 | JWT off | ACTIVE |
| `rona-owner-acceptance` | 40 | JWT on | ACTIVE |
| `rona-owner-ai-sync` | 36 | JWT on | ACTIVE |
| `rona-portal-api` | 106 | JWT on | ACTIVE |
| `rona-portal-api-candidate-20260817` | 22 | JWT off | ACTIVE |
| `rona-role-mail-bridge` | 12 | JWT off | ACTIVE |
| `rona-voice-gateway` | 4 | JWT off | ACTIVE |
| `rona-voice-twilio-adapter` | 3 | JWT off | ACTIVE |
| `rona-voice-zadarma-adapter` | 3 | JWT off | ACTIVE |

## Deployed functions without same-name release folder (77)

| Deployed name | Version | JWT | Status |
|---|---:|---|---|
| `rona-accounting-attachment-mail-bridge` | 5 | JWT off | ACTIVE |
| `rona-accounting-payment-task-generator` | 7 | JWT on | ACTIVE |
| `rona-admin-bootstrap-diagnostic-20260817` | 8 | JWT on | ACTIVE |
| `rona-admin-exact-module-candidate-20260817` | 6 | JWT on | ACTIVE |
| `rona-admin-source-eval-candidate-20260817` | 28 | JWT on | ACTIVE |
| `rona-analyst-mail-bridge` | 5 | JWT off | ACTIVE |
| `rona-auth-config-env-probe-20260816` | 7 | JWT on | ACTIVE |
| `rona-auth-config-management-attempt-20260816` | 5 | JWT on | ACTIVE |
| `rona-canonical-transfer-20260817` | 5 | JWT on | ACTIVE |
| `rona-g5c-autonomous-preflight` | 5 | JWT on | ACTIVE |
| `rona-g5c-autonomous-runtime` | 6 | JWT on | ACTIVE |
| `rona-g5c-qa-admin-normalize` | 5 | JWT on | ACTIVE |
| `rona-g5c7-qa` | 7 | JWT on | ACTIVE |
| `rona-g5d-pr12-2792969-qa` | 6 | JWT on | ACTIVE |
| `rona-g5d-qa` | 5 | JWT on | ACTIVE |
| `rona-g6-auth-bootstrap-probe-20260814` | 6 | JWT on | ACTIVE |
| `rona-g6-runtime-runner-20260814` | 7 | JWT on | ACTIVE |
| `rona-g6-tx-runner-20260814` | 5 | JWT on | ACTIVE |
| `rona-g8-1-preview-uat-runner` | 12 | JWT on | ACTIVE |
| `rona-g8-2-online-uat-invoker` | 4 | JWT on | ACTIVE |
| `rona-g8-2-online-uat-runner` | 4 | JWT on | ACTIVE |
| `rona-g8-postdeploy-smoke` | 8 | JWT on | ACTIVE |
| `rona-g82-inline-auth-qa-credential-20260816` | 5 | JWT on | ACTIVE |
| `rona-g82-owner-credential-hygiene-20260816` | 9 | JWT on | ACTIVE |
| `rona-g82-owner-recovery-link-20260816` | 5 | JWT on | ACTIVE |
| `rona-g82-owner-uat-recovery-issuer-20260816` | 5 | JWT on | ACTIVE |
| `rona-g82-production-smoke-20260815` | 5 | JWT on | ACTIVE |
| `rona-g82-production-smoke-invoker-20260815` | 5 | JWT on | ACTIVE |
| `rona-g82-uat-4e7d0f6c` | 6 | JWT on | ACTIVE |
| `rona-g82-uat-final-5df0` | 6 | JWT on | ACTIVE |
| `rona-g82-uat-final-v2` | 4 | JWT on | ACTIVE |
| `rona-g82-uat-final-v3` | 4 | JWT on | ACTIVE |
| `rona-mail-bridge` | 14 | JWT off | ACTIVE |
| `rona-mail-mcp` | 6 | JWT off | ACTIVE |
| `rona-mail-sent-folder-repair` | 14 | JWT off | ACTIVE |
| `rona-mail-visible-sent-sync` | 3 | JWT off | ACTIVE |
| `rona-mcp-all-role-e2e-invoker-20260818` | 5 | JWT on | ACTIVE |
| `rona-mcp-all-role-e2e-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-canonical-coordinate-debug-20260819` | 4 | JWT on | ACTIVE |
| `rona-mcp-canonical-coordinate-fullqa2-20260819` | 4 | JWT on | ACTIVE |
| `rona-mcp-canonical-coordinate-qa-20260819` | 4 | JWT on | ACTIVE |
| `rona-mcp-chatgpt-token-e2e-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-oauth-consent-qa-20260818` | 5 | JWT on | ACTIVE |
| `rona-mcp-operations-pilot-full-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-origin-e2e-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-phase2b2-decision-debug-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-phase2b2-e2e-invoker-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-phase2b2-e2e-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-phase2b2-write-suite-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-public-interop-probe-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-rail-e2e-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-refresh-e2e-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-mcp-single-click-e2e-invoker-qa-20260818` | 5 | JWT on | ACTIVE |
| `rona-mcp-single-click-e2e-qa-20260818` | 4 | JWT on | ACTIVE |
| `rona-movizor-rail-bridge` | 6 | JWT on | ACTIVE |
| `rona-oauth-xhtml-probe-20261002` | 1 | JWT off | ACTIVE |
| `rona-owner-admin-identity-bootstrap-20260815` | 5 | JWT on | ACTIVE |
| `rona-owner-bootstrap-9f31c6d0c2b14a27` | 6 | JWT on | ACTIVE |
| `rona-owner-bootstrap-control-20260816` | 5 | JWT on | ACTIVE |
| `rona-owner-otp-recovery-issuer-20260816` | 9 | JWT on | ACTIVE |
| `rona-owner-password-retire-20260816` | 7 | JWT on | ACTIVE |
| `rona-owner-price-publication-write-fallback` | 1 | JWT on | ACTIVE |
| `rona-owner-recovery-6f84c2e9a1d7` | 8 | JWT on | ACTIVE |
| `rona-owner-recovery-generator-20260816` | 5 | JWT on | ACTIVE |
| `rona-owner-recovery-once-20260816-1656` | 5 | JWT on | ACTIVE |
| `rona-owner-recovery-otp-hotfix-4f8a17b2` | 5 | JWT on | ACTIVE |
| `rona-owner-recovery-otp-once-20260816-1312` | 5 | JWT on | ACTIVE |
| `rona-owner-rpc-read-fallback` | 2 | JWT on | ACTIVE |
| `rona-owner-uat-staging-runner-20260817` | 20 | JWT on | ACTIVE |
| `rona-phase5c2-qa-harness` | 11 | JWT on | ACTIVE |
| `rona-phase5c2-runner` | 11 | JWT on | ACTIVE |
| `rona-portal-api-phase5c2-qa` | 7 | JWT on | ACTIVE |
| `rona-r1-c9d05f85510ffc5facae79f63e5f7460` | 5 | JWT on | ACTIVE |
| `rona-remote-import-probe-20260818` | 6 | JWT on | ACTIVE |
| `rona-staff-workspace` | 5 | JWT off | ACTIVE |
| `rona-temp-deal004-pnl-xls-20260815` | 7 | JWT on | ACTIVE |
| `rona-temp-upload-order-20260816` | 13 | JWT on | ACTIVE |

## Security adviser live snapshot

| Supabase advisor check | Severity | Findings | Correct response |
|---|---|---:|---|
| `rls_enabled_no_policy` | INFO | 148 | RLS/no-policy means deny by default for normal direct roles, not public leak |
| `function_search_path_mutable` | WARN | 1 | Source-scope and search_path pin review with precise reversible migration |
| `extension_in_public` | WARN | 1 | Extension dependency/owner approval before move |
| `anon_security_definer_function_executable` | WARN | 2 | Two rail Admin RPCs require concrete non-Admin negative test and caller/source proof, NOT a guessed anonymous data leak |
| `authenticated_security_definer_function_executable` | WARN | 66 | Review role/session checks and caller contracts individually, no bulk REVOKE |
| `auth_leaked_password_protection` | WARN | 1 | Auth configuration owner review |

**Two flagged anonymous-executable rail RPCs:** `public.rona_admin_rail_monitoring_complete_v1(p_deal_id text)`, `public.rona_admin_rail_monitoring_lifecycle_v1()`. `EXECUTE` grant plus `SECURITY DEFINER` is an attack surface, not yet evidence of a successful permission bypass. Source prior audit notes an internal verified ADMIN-session guard. Require source exact verification, negative unauthenticated and foreign-session calls, and downstream caller inventory prior to a scoped `REVOKE` migration.

**Additional guardrails:** A deployment's `verify_jwt=false` does not prove unauthenticated access; test custom auth and intended service-to-service access. Never reveal keys, JWTs or caller-specific user data in this inventory. No destructive SQL, deployment retirement, storage deletion, blanket revocation or permission expansion is authorized by these counts.

## Immediate safe action queue

- `DEPLOY-01`: for 77 functions, collect actual source hash/deployed import pin, entrypoint, caller/cron/webhook/last-use, custom auth and rollback; flag unknown as `SOURCE_UNVERIFIED`.
- `DEPLOY-02`: preserve `rona-temp-upload-order-20260816` and its Client-only role while staging an isolated read-only Admin effective-client adapter; test deny for foreign Client/contract and replay.
- `SQL-01`: reconcile 522 applied version IDs against previous archived releases and known backup schemas. Compute exact SQL hash parity; never run missing local scripts as blanket migrations.
- `SEC-01`: test the two Admin rail RPCs under `anon` and invalid session with no mutations, then review precise ACL hardening if compatible.
- `RELEASE`: keep Draft PRs separate, commit atomic corrections only with source checks and previous deployed SHA as rollback; require authenticated Owner UAT.

**Status:** `READ_ONLY_INVENTORY_VERIFIED / FUNCTION_SOURCE_PARITY_PENDING / DB_MIGRATION_LINEAGE_PENDING`.
