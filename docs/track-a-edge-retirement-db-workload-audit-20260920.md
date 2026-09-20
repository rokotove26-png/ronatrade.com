# TRACK A — Edge retirement / dependency audit + workload-driven DB audit

Date: 2026-09-20  
CURRENT_STATE_FIRST production base: `89628c19cc37f873f8b32ad37401344a59790ccf`  
Supabase project: `sxawrwzeobaqwwmlkzws`

## Scope and safety boundary

This TRACK A change does **not** merge or deploy Stage 2 / PR #692. Stage 2 remains a separate draft candidate.

This change also does not delete Edge Functions in production. The Edge work below is a dependency/retirement classification so deletion can be performed only after an explicit deletion-capable gate. The DB change in this PR is a single read-path index migration; it is not applied by this audit branch itself.

## Live Edge dependency findings

Direct database function dependencies discovered from live `pg_proc` definitions:

- `portal_private.invoke_market_intelligence_source_processor_v1` -> `rona-env-capability-probe-20260817`
- `portal_private.invoke_commercial_director_market_news_v1` -> `rona-ai-read-extras`
- `portal_private.invoke_ai_model_executor` -> `rona-ai-model-executor`
- private mail/accounting invokers -> the corresponding RONA mail/accounting Edge bridges.

Therefore `rona-env-capability-probe-20260817` is **KEEP** despite its historical/probe-style name. Removing it would break the live Market Intelligence source processor.

### Confirmed retirement candidates

The following functions are still listed as ACTIVE by Supabase, but their live bodies return HTTP 410 / `GONE` / `RUNTIME_RETIRED_PRE_OWNER_UAT`. They are safe **retirement candidates**, not automatic deletion targets:

- `rona-portal-api-phase5c2-qa`
- `rona-phase5c2-qa-harness`
- `rona-phase5c2-runner`
- `rona-g5c7-qa`
- `rona-g5c-qa-admin-normalize`
- `rona-g5d-qa`
- `rona-g5d-pr12-2792969-qa`
- `rona-g6-auth-bootstrap-probe-20260814`
- `rona-g6-runtime-runner-20260814`
- `rona-g6-tx-runner-20260814`
- `rona-g8-postdeploy-smoke`
- `rona-g8-1-preview-uat-runner`
- `rona-g8-2-online-uat-runner`
- `rona-g8-2-online-uat-invoker`
- `rona-g82-uat-4e7d0f6c`
- `rona-g82-uat-final-5df0`
- `rona-g82-uat-final-v2`
- `rona-g82-uat-final-v3`
- `rona-g82-production-smoke-20260815`
- `rona-g82-production-smoke-invoker-20260815`
- `rona-temp-deal004-pnl-xls-20260815`
- `rona-g82-inline-auth-qa-credential-20260816`
- `rona-g82-owner-uat-recovery-issuer-20260816`
- `rona-auth-config-env-probe-20260816`
- `rona-auth-config-management-attempt-20260816`
- `rona-owner-uat-staging-runner-20260817`

### HOLD / KEEP / HARDEN

- **KEEP** `rona-env-capability-probe-20260817`: direct live DB dependency.
- **KEEP / HARDEN** `rona-staff-workspace`: live staff shell; raw Edge endpoint is unauthenticated and should be handled as a separate security-hardening task, not retirement.
- **HOLD** `rona-g82-github-oidc-browser-qa-20260816`: still contains active code and is pinned to `refs/heads/feat/admin-payments-final-owner-screen-passport-v1`.
- **HOLD** `rona-ci-admin-session-broker`: active implementation pinned to `refs/heads/release/public-go-live-v1.1`.
- **HOLD** `rona-temp-upload-order-20260816`: active signed-document upload implementation, not a 410 stub.
- **HOLD** `rona-admin-source-eval-candidate-20260817`, `rona-admin-exact-module-candidate-20260817`, `rona-portal-api-candidate-20260817`: active code; retirement requires a separate consumer/deployment reconciliation.

## Workload-driven DB evidence

### 1. Market Intelligence source candidate selector — change proposed

Live `pg_stat_statements` at audit time:

- calls: **2,150**
- total execution time: **1,516,052.8 ms**
- mean execution time: **705.141 ms**
- returned rows: **8**

The query scans `portal_private.telegram_market_documents` for a 45-day window, two extracted states, and the existing five exact Market Intelligence text markers, then anti-joins `market_intelligence_processed_sources`.

Live table state at audit time:

- `telegram_market_documents`: about **10.45 MB** total, **3,176** live rows
- cumulative updates: **174,220**
- sequential scans: **146,974**
- existing general time index: `telegram_market_documents_message_time_idx`

A temporary copy of the live table with the proposed exact-predicate partial index produced an `Index Scan` on the new candidate index with **0.095 ms** execution for the same selector shape. This is planner evidence only; it is not represented as a guaranteed production latency.

This PR therefore adds only:

`telegram_market_documents_mi_candidate_time_idx`

on `message_timestamp desc`, restricted to the exact existing source-candidate predicate.

### 2. AI coordination latest-conclusion query — no change

Historical `pg_stat_statements` shows high cumulative usage, but a fresh live `EXPLAIN (ANALYZE, BUFFERS)` completed in **5.062 ms** and used the existing `uq_ai_coordination_conclusion_version` index. A new index is not justified by current evidence.

### 3. Commercial Director unprocessed-source count — observe, no change

A fresh live `EXPLAIN (ANALYZE, BUFFERS)` completed in **109.699 ms**. The plan already uses:

- `telegram_market_documents_message_time_idx`
- `commercial_director_market_news_processed_sources_pkey`

This query remains a workload candidate for future redesign/caching if cumulative cost continues to dominate, but no index is added in this PR because the existing access paths are already selected.

## Acceptance criteria for this PR

1. Source-contract test confirms the migration is index-only and preserves the exact five existing source markers.
2. PostgreSQL 17 isolated planner proof creates a synthetic high-noise corpus and proves the existing query shape selects `telegram_market_documents_mi_candidate_time_idx`.
3. No Stage 2 files, Admin shell/runtime files, Finance logic, Client LK, documents, GO/HOLD, or production Edge deployment are changed.
4. Production application of the migration remains a separate controlled decision after PR review.
