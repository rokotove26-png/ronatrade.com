# Admin Payments V7 — Stage 5C complete contract

Status: repository implementation and QA candidate only. No backend/frontend production deployment, production DDL/DML, or merge is authorized by this stage.

## Stage 4B-PROD lineage prerequisite

Production is source-locked to the actually registered Stage 4B migration version:

`20260913182849_admin_payments_v7_stage4b_owner_persistence_delta`

The repository now uses the same version. The earlier repository-only `20260913181100` filename is retired. The migration SQL body is unchanged and is not replayed in production.

Production already exposes the sealed primitive:

`portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)`

It remains `SECURITY INVOKER`, hardened to `search_path=pg_catalog, portal_private`, and directly non-executable by browser/app/read roles.

## Native Admin → Payments V7 renderer

Stage 5C keeps one Payments route owner: `admin-payments-v7-native`.

The actual release Admin shell is source-locked to `86133bfa66f044944434aeb0baed07af5d84621e`. Because the clean-rebuild branch does not carry that release frontend tree, `scripts/admin-payments-v7-stage5c-live-source.mjs` reconstructs the exact live source and performs a fail-closed build-time replacement of the legacy Payments renderer. It also patches the source-locked `/portal/owner-api` proxy so `/admin/payments-v7/owner-decision` reaches the authenticated `rona-owner-ai-sync` backend instead of the legacy Owner acceptance service.

The browser runtime:

- renders only `paymentsV7Projection` as Payments financial truth;
- does not add a second `Платежи` heading;
- uses fail-closed numeric formatting: null / undefined / empty / NaN => `TO_VERIFY`, never synthetic zero;
- keeps four KPI cards and one Deal board;
- keeps Deal data dynamic from the current V7 projection;
- shows Owner queue only from `owner_exception_queue`;
- exposes `Привязать к сделке` and `Авансовый платеж` only for queue rows;
- builds the Deal selector only from current `paymentsV7Projection.deals`;
- shows `candidate_deal_ids` only as `подсказка` labels and never preselects them;
- performs no automatic binding and no proportional split;
- refreshes `/admin/ai-sync` after a successful mutation, which is the same-origin proxy for authoritative backend `/admin/sync`.

Responsive layout is explicitly hardened for the active Payments page and its current content container. QA target layouts are desktop 1440×1100, medium 900×1100, and mobile 600×1300.

## Authenticated Owner-decision backend

Canonical route:

`POST /admin/payments-v7/owner-decision`

Authentication/session/ADMIN authorization is reused from the existing `rona-owner-ai-sync` runtime. The mutation wrapper does not trust the browser projection. Before every mutation it re-reads current V7 sources and recomputes the authoritative projection/reconciliation.

The browser may send only:

- `payment_key`;
- `action`;
- `expected_current_authority_id`;
- `idempotency_key`;
- `deal_key` only for `BIND_TO_DEAL`.

Browser-supplied amount, currency, attribution lines, scope, candidate list, business scope refs, or source refs are rejected.

For `BIND_TO_DEAL`, the target must exist in the current Payments contour. The backend derives the exact full-payment amount/currency from the fresh bank fact. Candidate hints are not used for authority. For `ASSIGN_ADVANCE_PAYMENT`, no Deal binding is accepted.

The only business mutation in the production candidate entrypoint is the sealed Stage 4B call:

`portal_private.persist_owner_payment_decision_v7(expected, authority, audit)`

No direct insert/update/delete of V7 authority tables exists in the endpoint.

## Owner decision cycle acceptance

The Stage 5C E2E contract proves:

1. genuinely unallocated event appears in Owner queue;
2. candidate Deal A is only a hint;
3. Owner may explicitly choose current-contour Deal B;
4. backend rechecks current Payment/reconciliation;
5. authoritative line uses server Payment amount/currency and selected B;
6. persistence passes through the sealed Stage 4B primitive boundary;
7. fresh authoritative `/admin/sync` returns the queue cleared;
8. advance-payment action creates no Deal binding;
9. client arithmetic injection and non-contour Deal selection fail closed.

## No-hardcode boundary

The NO-HARDCODE gate scans both changed Supabase production runtime and the actual Stage 5C browser integration source. Deal IDs, client/counterparty names, business UUIDs and current Owner amounts are prohibited from production runtime.

## Production gates

`PRODUCTION_DDL=HOLD`

`PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`

`BACKEND_PRODUCTION_DEPLOY=HOLD`

`FRONTEND_PRODUCTION_DEPLOY=HOLD`

`MERGE=HOLD`
