# Admin Payments V7 — Stage 3A.1/3A.2 real Admin integration gate

Status: `REAL_ADMIN_ENTRYPOINT_INTEGRATION=BLOCKED_SOURCE_NOT_RECOVERED_IN_V7_BRANCH`.

`CURRENT_STATE_FIRST` on clean branch `feat/admin-payments-v7-clean-rebuild` confirms that the V7 branch still does not contain the production `supabase/functions/rona-owner-ai-sync/` runtime subtree. Stage 3A.2 does not copy that subtree and does not create a replacement Admin handler, QA-only endpoint, or second financial path.

The source lineage is no longer unknown. Read-only production inspection identifies the deployed function as `rona-owner-ai-sync` version 14. Its deployed wrapper imports repository commit `32136088553ed99ab3426f743238cf17f4c26f7e`, file `supabase/functions/rona-owner-ai-sync/index.ts`, which delegates to `runtime.ts` and then applies the current V6 Payments enrichment.

The production-pinned `runtime.ts` enforces `req.method === "GET"` before routing and serves the ordinary authenticated Admin sync at:

`GET /admin/sync`

Stage 3A.1 documentation that described this route as `POST /admin/sync` was incorrect. V7 must not change the production route semantics.

## Stage 3A.2 authority correction

Active/current/source-locked VERIFIED `payment_allocations` are field-specific attribution authority for their exact allocation facts, while remaining physical materialization rows as well. They participate in current authority resolution as typed `PAYMENT_ALLOCATION:<id>` identities. They do not receive unconditional priority: current/effective filtering, explicit typed supersession, source-lock and compatibility resolution still run before the winning truth is compared back to physical materialization.

A later current Owner/business authority may explicitly supersede a PAYMENT_ALLOCATION using `supersedes_authority_refs`. In that case the later authority is business truth and the still-present allocation row is reported as `STALE_SUPERSEDED_MATERIALIZATION`, without double counting or `AUTHORITY_CONFLICT` merely because the row exists.

No duplicate V7 authority row is required merely to make an existing authoritative VERIFIED payment allocation visible to V7.

## Correct integration prerequisite / Stage 3B

The next backend integration stage is **Stage 3B — recover production-pinned runtime lineage into the V7 branch and integrate V7 into the existing authenticated GET `/admin/sync`**.

Recover the canonical repository runtime source from commit `32136088553ed99ab3426f743238cf17f4c26f7e`, including `supabase/functions/rona-owner-ai-sync/index.ts`, `runtime.ts`, and the relative dependencies required by that production-pinned runtime. Then modify that existing authenticated GET response path so that one ordinary Admin request performs:

`authenticated GET /admin/sync -> authoritative raw source reads -> buildAdminPaymentsV7FromRawSources(...) -> payload.data.paymentsV7Projection`

The integration must replace/retire the V6 Payments enrichment on that same route rather than adding a second financial path. The real-entrypoint Test U must invoke the production-shaped authenticated GET handler and assert exactly one `ADMIN_PAYMENTS_V7` projection.

Until Stage 3B recovers that pinned runtime subtree into this branch, Test U remains intentionally blocked/skipped and `UI_IMPLEMENTATION=HOLD` remains mandatory.
