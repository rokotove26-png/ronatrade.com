# Admin Payments V7 — Stage 3B.1 real Admin runtime proof gate

Status: `REAL_ADMIN_ENTRYPOINT_INTEGRATION=COMPLETE_STAGE_3B_1`.

Stage 3B recovered the production-pinned `rona-owner-ai-sync` lineage from repository commit `32136088553ed99ab3426f743238cf17f4c26f7e` and integrated the single canonical Admin Payments V7 backend projection into the existing authenticated Owner/Admin runtime.

Stage 3B.1 strengthens that proof without changing route semantics or authorizing deployment. The recovered `runtime.ts` was restored byte-for-byte first, then receives a controlled refactor: route/method/role construction is moved into the exported `createRonaOwnerAiSyncRuntimeHandler(...)` factory. Production `Deno.serve(...)` and Test U now instantiate that same factory. Authentication and sync data dependencies are injected; route, method and role logic are not duplicated in the test.

The authoritative Admin route remains:

`GET /admin/sync`

`POST /admin/sync` remains `405 METHOD_NOT_ALLOWED` after successful authentication. Non-ADMIN access remains `403`; unauthenticated access remains `401`.

## Runtime pipeline

The existing runtime handler remains authoritative for authentication, role enforcement, method enforcement and unrelated Admin/Agent payload construction. After a successful authenticated ADMIN `GET /admin/sync`, the V7 integration performs:

`existing runtime response -> one REPEATABLE READ READ ONLY V7 source snapshot -> buildAdminPaymentsV7FromRawSources(raw) -> payload.data.paymentsV7Projection`

The raw reader does not build V7 from `financeFragment` or another legacy projection. It preserves internal relational keys (`deal.id`, `payment.id`, `deal_key`, `payment_key`, allocation IDs) and reads current authoritative database relations directly.

## Consistent financial snapshot

One V7 source read uses one Postgres transaction:

`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`

The same transaction-scoped SQL port performs capability probes, Deals/workflow/client/contract reads, Payments, payment allocations/history, outgoing facts, optional V7 attribution authority, optional Finance authority and optional exact resource-chain authority.

`sourceAsOf` is taken from `transaction_timestamp()` within that transaction. The reader does not use an application `new Date()` after a series of authoritative reads to represent source snapshot time.

## Optional normalized authority providers

Production DDL remains on HOLD. The V7 reader capability-detects optional normalized providers before querying them:

- `payment_business_attributions_v7` + `payment_business_attribution_lines_v7`;
- `deal_finance_authority_v7`;
- `payment_resource_chains_v7`.

`relation absent` means capability `false` and the projection fails closed under the Stage 2/2.1 contract. An existing relation with zero current rows means capability `true` with an empty current provider. These states remain intentionally distinct.

Active/current/source-locked VERIFIED `payment_allocations` remain field-specific payment-attribution authority; optional V7 attribution persistence is not required merely to recognize those existing allocations.

## Failure contract

V7 source-read and projection-build failures after a successful Admin runtime response are handled as structured Payments-specific failures:

- `ADMIN_PAYMENTS_V7_SOURCE_FAILURE`;
- `ADMIN_PAYMENTS_V7_PROJECTION_FAILURE`.

No uncaught rejection is allowed from these stages. No legacy V6 Payments fallback is permitted and no fabricated `paymentsV7Projection` is returned.

## V6 retirement

The production-pinned V6 wrapper previously called `enrichOwnerPaymentsAccountingCurrencyProgressV6(...)` after `runtimeHandler`. That Payments-authority path remains retired. The V7 `index.ts` neither imports nor calls V6 enrichment and contains no hardcoded Finance canon UUID/version.

`financeFragment` remains untouched as existing Admin payload for unrelated compatibility, but it is not input financial truth for `paymentsV7Projection`.

Canonical Owner Payments backend truth remains exactly one field:

`payload.data.paymentsV7Projection`

## Canonical core

There is one implementation engine at:

`supabase/functions/_shared/admin-payments-v7/`

The old `rona-portal-api/admin-payments-v7/index.mjs` is only a compatibility re-export; no duplicate projection modules remain there.

## Verification gate

Stage 3B.1 requires:

- Test U PASS through the same exported runtime-handler factory used by production, including 401/403/405/200 and exactly one V7 projection;
- A–AD regression PASS;
- AE consistent read snapshot contract PASS;
- AF controlled V7 source/projection failure PASS;
- NO-HARDCODE PASS;
- CI checkout and test of the exact PR branch HEAD, not a synthetic merge commit;
- committed real-reader dry-run tool importing the production source reader and projection builder;
- any production dry-run claim to distinguish direct committed-reader execution from supplementary manual SQL verification;
- no UI/CSS, production DDL, production data mutation, production deployment or merge.

Current holds remain:

- `UI_IMPLEMENTATION=HOLD`
- `PRODUCTION_DDL=HOLD`
- `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`
- `PRODUCTION_DEPLOY=HOLD`
- `MERGE=HOLD`
- `V7_VISUAL_ACCEPTANCE=NOT_READY`
