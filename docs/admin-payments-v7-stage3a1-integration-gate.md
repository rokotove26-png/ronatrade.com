# Admin Payments V7 — Stage 3B real Admin integration gate

Status: `REAL_ADMIN_ENTRYPOINT_INTEGRATION=COMPLETE_STAGE_3B`.

Stage 3B recovers the production-pinned `rona-owner-ai-sync` lineage from repository commit `32136088553ed99ab3426f743238cf17f4c26f7e` and integrates the single canonical Admin Payments V7 backend projection into the existing authenticated Owner/Admin runtime.

The recovered production `runtime.ts` remains unchanged and continues to own authentication, ADMIN authorization, method enforcement, `/admin/sync`, `/agent/sync`, and unrelated Admin/Agent business reads.

The authoritative Admin route is and remains:

`GET /admin/sync`

`POST /admin/sync` remains `405 METHOD_NOT_ALLOWED` under the recovered runtime. V7 does not change route semantics.

## Runtime pipeline

The Stage 3B wrapper captures the recovered production runtime handler and, only after a successful authenticated ADMIN `GET /admin/sync`, performs:

`existing runtime response -> direct authoritative V7 raw-source read -> buildAdminPaymentsV7FromRawSources(raw) -> payload.data.paymentsV7Projection`

The raw reader does not build V7 from `financeFragment` or another legacy projection. It preserves internal relational keys (`deal.id`, `payment.id`, `deal_key`, `payment_key`, allocation IDs) and reads current authoritative database relations directly.

## Optional normalized authority providers

Production DDL remains on HOLD. Stage 3B therefore capability-detects optional normalized providers before reading them:

- `payment_business_attributions_v7` + `payment_business_attribution_lines_v7`;
- `deal_finance_authority_v7`;
- exact payment resource-chain provider.

`relation absent` means capability `false` and the projection fails closed under the Stage 2/2.1 contract. An existing relation with zero current rows means capability `true` with an empty current provider. These states are intentionally distinct.

Active/current/source-locked VERIFIED `payment_allocations` remain field-specific payment-attribution authority under Stage 3A.2; optional V7 attribution persistence is not required merely to recognize those existing allocations.

## V6 retirement

The production-pinned V6 wrapper previously called `enrichOwnerPaymentsAccountingCurrencyProgressV6(...)` after `runtimeHandler`. Stage 3B retires that Payments-authority path. The final V7 `index.ts` neither imports nor calls that V6 enrichment and contains no hardcoded Finance canon UUID/version.

`financeFragment` remains untouched as existing Admin payload for unrelated compatibility, but it is not input financial truth for `paymentsV7Projection`.

Canonical Owner Payments backend truth after Stage 3B is exactly one field:

`payload.data.paymentsV7Projection`

## Canonical core

There is one implementation engine at:

`supabase/functions/_shared/admin-payments-v7/`

The old `rona-portal-api/admin-payments-v7/index.mjs` is only a compatibility re-export; no duplicate projection modules remain there.

## Verification gate

Stage 3B requires:

- Test U PASS against the production-shaped wrapper path, including 401/403/405/200 and one V7 projection;
- A–Y regression PASS;
- Z–AD source-reader/integration PASS;
- NO-HARDCODE PASS;
- read-only current-production source verification;
- no UI/CSS, production DDL, production data mutation, production deployment or merge.

Current holds remain:

- `UI_IMPLEMENTATION=HOLD`
- `PRODUCTION_DDL=HOLD`
- `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`
- `PRODUCTION_DEPLOY=HOLD`
- `MERGE=HOLD`
- `V7_VISUAL_ACCEPTANCE=NOT_READY`
