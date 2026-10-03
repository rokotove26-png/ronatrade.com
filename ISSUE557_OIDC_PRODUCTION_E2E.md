# Issue #557 — authenticated production E2E

Disposable QA checkpoint only. Do not merge.

Production release under test: `release/public-go-live-v1.1@92f8d5e381e34e84b7c14aa3f6d7480a60eae24c`.

The read-only OIDC harness is pinned to executor source `feat/admin-payments-final-owner-screen-passport-v1@a352d0fedfac9ab069727e04e7d772313c06dfd7`, file `scripts/qa-issue557-production-e2e-oidc.mjs`, because the existing GitHub OIDC issuer is intentionally ref-locked to that executor branch. The harness only reads production bootstrap/UI, captures evidence, and revokes its temporary QA Admin session.

Acceptance: DEAL-2026-011 received 225900 USD; due_now 0 USD; future_conditional 527100 USD; actual_spend 35574.47 USD; remaining_execution 190325.53 USD; DEAL-2026-010 actual_spend 6225.53 USD; Payments aggregates must match current V8 Finance authority. Finance authority, ledger and business data are not mutated.
