# Admin Payments V7 — Stage 3B.1 production runtime source-recovery and controlled-refactor manifest

Status: `STAGE_3B_1_RUNTIME_PROOF=VERIFIED_IN_REPOSITORY`.

Production-pinned runtime lineage:

- deployed function lineage recovered from repository commit: `32136088553ed99ab3426f743238cf17f4c26f7e`;
- exact recovery commit: `13c24cda74f8c32b105a4d4fd07cbcfd780d1fd0`;
- Stage 3B integration parent: `4ebbe7f3796fde19f6e035f74fdcde20a9590117`;
- target branch: `feat/admin-payments-v7-clean-rebuild`.

The production-pinned runtime was first restored byte-for-byte in the recovery commit. Stage 3B.1 then performs one controlled refactor: route/method/role handler construction moves from the final inline `Deno.serve(...)` callback in `runtime.ts` to the exported `createRonaOwnerAiSyncRuntimeHandler(...)` factory in `runtime-handler.mjs`. Production `runtime.ts` and Test U use that same factory. Authentication and business-data dependencies remain injected into the factory; route, HTTP method and role enforcement are not reimplemented in the test.

## Recovered source lineage

| Path | Production-pinned source commit | Original blob SHA | Stage 3B.1 final state |
| --- | --- | --- | --- |
| `supabase/functions/rona-owner-ai-sync/deno.json` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `cb7c37c9612365d4631ab1933947ce6817a4ef62` | retained exact |
| `supabase/functions/rona-owner-ai-sync/payment-owner-screen.ts` | same | `ded4404b4af08f98eba99b9a4915433b929681e7` | retained exact runtime dependency |
| `supabase/functions/rona-owner-ai-sync/payment-schedule-authority.ts` | same | `4a62ec035fa5de64d5acf41adedda3242be0ac65` | retained exact runtime dependency |
| `supabase/functions/rona-owner-ai-sync/runtime.ts` | same | `7c27dd5844e6e5fcf3c4e8d31818b3d3a2d1be09` | recovered exact first, then controlled Stage 3B.1 handler-factory refactor; final blob `fc8c92498466ae779b9dc339a52828e9be94eb95` |
| `supabase/functions/rona-owner-ai-sync/runtime-handler.mjs` | Stage 3B.1 | n/a | new shared production/Test-U route-method-role factory; blob `50d19d9a058e505c90e5a45a8357e16ddd856d75` |
| original `supabase/functions/rona-owner-ai-sync/index.ts` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `b7b0ef587a7373d26a34745c0ba5f2bc4b40b9f6` | recovered exact, then Stage 3B V7 integration wrapper retained |
| `supabase/functions/rona-owner-ai-sync/owner-payments-accounting-currency-progress-v6.ts` | same | `a34ac07b049efcd10467c19362bbc9431228e412` | recovered for provenance, retired from final tree |
| `supabase/functions/rona-owner-ai-sync/owner-payments-owner-final-v5.ts` | same | `7ef187ce9d699b1604afbdc36b6dbb8cbb2a8c29` | recovered as V6 dependency, retired from final tree |

## Runtime handler proof

Production runtime now terminates with:

`Deno.serve(createRonaOwnerAiSyncRuntimeHandler({ authContext, adminSync, agentSync, logger: console }))`

Test U imports and invokes the same `createRonaOwnerAiSyncRuntimeHandler(...)`. Its test-only dependency injection supplies authentication and sync external dependencies, but does not duplicate `/admin/sync`, GET-only, ADMIN-role or error-routing logic.

## Consistent V7 financial snapshot

The production V7 source reader now opens exactly one Postgres transaction per V7 read:

`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`

Inside that transaction-scoped SQL port it performs:

- transaction timestamp read used for `sourceAsOf`;
- optional relation capability probes;
- Deals/workflow/client/contract reads;
- Payments;
- payment allocations and supersession history;
- outgoing facts;
- optional normalized payment-attribution authority;
- optional normalized Finance authority;
- optional exact resource-chain authority.

No authoritative V7 source read is intentionally executed on the root SQL connection outside that transaction. `sourceAsOf` and `generatedAt` for the raw V7 source bundle are derived from `transaction_timestamp()` of that snapshot, not from a post-read application clock.

## V7 failure contract

After the ordinary authenticated Admin runtime succeeds, V7-specific source/projection failures are caught by the integration wrapper and return a structured fail-closed response:

- `ADMIN_PAYMENTS_V7_SOURCE_FAILURE`; or
- `ADMIN_PAYMENTS_V7_PROJECTION_FAILURE`.

Both carry `component=ADMIN_PAYMENTS_V7`, return no fabricated V7 projection, and do not fall back to V6 Payments truth.

## Canonical V7 core

The single deployable projection engine remains:

`supabase/functions/_shared/admin-payments-v7/`

The old `supabase/functions/rona-portal-api/admin-payments-v7/index.mjs` remains only a zero-logic compatibility re-export.

## Real-reader dry-run tool

Stage 3B.1 adds `scripts/admin-payments-v7-real-reader-dry-run.mjs`. It imports the same `createAdminPaymentsV7SourceReader(...)` and `buildAdminPaymentsV7FromRawSources(...)` used by production. Running it against production requires a direct transaction-capable Postgres SQL connection; manual SQL reproduction is supplementary evidence only and is not equivalent to executing the committed reader.

## Holds

This stage is repository/runtime QA only. It performs no UI/CSS work, production DDL, production business-data mutation, production deployment or merge.
