# Admin Payments V7 — Stage 3B production runtime source-recovery manifest

Status: `STAGE_3B_SOURCE_RECOVERY=VERIFIED`.

Production-pinned runtime lineage:

- deployed function: `rona-owner-ai-sync` version 14;
- authoritative repository source commit: `32136088553ed99ab3426f743238cf17f4c26f7e`;
- V7 recovery commit: `13c24cda74f8c32b105a4d4fd07cbcfd780d1fd0`;
- target branch: `feat/admin-payments-v7-clean-rebuild`.

The recovery commit restores the production-pinned source files byte-for-byte before Stage 3B integration changes are applied. The final Stage 3B tree retains only the relative dependencies needed by the recovered `runtime.ts` and retires the V6 Payments post-enrichment chain.

| Path | Source commit | Original blob SHA | Stage 3B final state |
| --- | --- | --- | --- |
| `supabase/functions/rona-owner-ai-sync/deno.json` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `cb7c37c9612365d4631ab1933947ce6817a4ef62` | retained exact |
| `supabase/functions/rona-owner-ai-sync/runtime.ts` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `7c27dd5844e6e5fcf3c4e8d31818b3d3a2d1be09` | retained exact |
| `supabase/functions/rona-owner-ai-sync/payment-owner-screen.ts` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `ded4404b4af08f98eba99b9a4915433b929681e7` | retained exact runtime dependency |
| `supabase/functions/rona-owner-ai-sync/payment-schedule-authority.ts` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `4a62ec035fa5de64d5acf41adedda3242be0ac65` | retained exact runtime dependency |
| `supabase/functions/rona-owner-ai-sync/index.ts` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `b7b0ef587a7373d26a34745c0ba5f2bc4b40b9f6` | recovered exact, then modified only as the V7 integration wrapper |
| `supabase/functions/rona-owner-ai-sync/owner-payments-accounting-currency-progress-v6.ts` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `a34ac07b049efcd10467c19362bbc9431228e412` | recovered for provenance, then retired/deleted from final tree |
| `supabase/functions/rona-owner-ai-sync/owner-payments-owner-final-v5.ts` | `32136088553ed99ab3426f743238cf17f4c26f7e` | `7ef187ce9d699b1604afbdc36b6dbb8cbb2a8c29` | recovered as V6 dependency, then retired/deleted from final tree |

## Canonical V7 core

The single deployable projection engine is moved to:

`supabase/functions/_shared/admin-payments-v7/`

The former path `supabase/functions/rona-portal-api/admin-payments-v7/` no longer contains a second engine. Its `index.mjs` is retained only as a zero-logic compatibility re-export for existing tests/importers; all implementation modules at the old location are deleted.

The real `rona-owner-ai-sync` integration imports the `_shared` implementation directly.

## Runtime integration boundary

The recovered `runtime.ts` remains the authority for authentication, ADMIN authorization, HTTP method and all unrelated Admin/Agent data. Its production contract remains `GET /admin/sync`.

The Stage 3B `index.ts` captures that exact runtime handler as before, but replaces the V6 post-enrichment with:

`authenticated successful GET /admin/sync -> direct V7 raw-source reader -> buildAdminPaymentsV7FromRawSources(raw) -> payload.data.paymentsV7Projection`

No V6 projection is an input to V7 and no V6 Payments post-enrichment runs after V7.

## Holds

This recovery/integration is repository code only. It performs no production deploy, no production DDL, no production business-data mutation, no Owner mutation endpoint and no UI/CSS work.
