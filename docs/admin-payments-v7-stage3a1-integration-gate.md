# Admin Payments V7 — Stage 3A.1 real Admin integration gate

Status: `REAL_ADMIN_ENTRYPOINT_INTEGRATION=BLOCKED_SOURCE_ABSENT`.

`CURRENT_STATE_FIRST` on clean branch `feat/admin-payments-v7-clean-rebuild` at pre-write HEAD `860966c0cf6d972d3cb78a029622d8f5a89f976a` proves that `supabase/functions/rona-portal-api/` contains only `admin-payments-v7/`. There is no production `bootstrap.ts`, `index.ts`, `/admin/sync` handler, or Owner sync runtime in this branch. The standalone Stage-3A `attachAdminPaymentsV7Projection()` helper was therefore not a real integration and is removed in Stage 3A.1.

Read-only production function inspection identifies the ordinary authenticated Owner Admin route as `rona-owner-ai-sync`, whose deployed wrapper imports repository commit `32136088553ed99ab3426f743238cf17f4c26f7e`, file `supabase/functions/rona-owner-ai-sync/index.ts`. That wrapper normalizes `/admin/sync`, delegates to the captured authenticated runtime handler from `runtime.ts`, then applies the current V6 Payments enrichment.

Stage 3A.1 does not copy or recreate that handler into the clean V7 branch, because doing so without its canonical runtime lineage would fabricate a second Admin path. No QA-only endpoint is created.

## Correct integration prerequisite

Before UI work or production deployment, reconcile the canonical `rona-owner-ai-sync` runtime source into the V7 clean branch from its authoritative runtime lineage (including `index.ts`, `runtime.ts` and relative dependencies). Then modify the existing `/admin/sync` response path in that real entrypoint so that one authenticated request performs:

`ordinary authenticated /admin/sync -> authoritative raw source reads -> buildAdminPaymentsV7FromRawSources(...) -> payload.data.paymentsV7Projection`

The integration must replace/retire the V6 Payments enrichment on that route rather than adding a second financial path. The real-entrypoint test must invoke the production-shaped handler and assert exactly one `ADMIN_PAYMENTS_V7` projection. Until the canonical runtime source is present in this branch, test U is intentionally blocked/skipped and `UI_IMPLEMENTATION=HOLD` remains mandatory.
