# #670 — Client Online Rail production parity with Admin

Status: **REWORK CANDIDATE / MERGE HOLD / DEPLOY HOLD**. Repository and CI only. No production mutation. System Administrator must independently re-review before any merge or deploy.

## Current-state baseline

CURRENT_STATE_FIRST on 2026-09-19 confirmed production `release/public-go-live-v1.1@53a3266f64bdf4e44d5daf09507a6fd46c0678ad` and production `rona-portal-api` ACTIVE v56 importing that exact source.

The Client UI already reuses the Admin Online Rail operational body, but its data adapter still composed the page from legacy `/v1/client/shipments` plus the disabled MOVIZOR client endpoint. The current Admin UI rejects that payload because it has no authoritative `railReadModel` marker. This is the direct cause of the persistent Client loading shell.

Production `rona-portal-api` is not the repository branch `index.ts`; the #670 server candidate wraps the exact deployed v56 source and intercepts only the new Client Rail canonical read endpoint.

System Administrator review comment `5743709266` rejected the first backend candidate because it called the Admin-only V4 read-model function through the raw PostgreSQL connection. The Admin function requires `owner_r1_actor('ADMIN')`, while the raw server connection does not propagate the Client request JWT into Postgres auth GUCs. This rework removes that dependency without weakening Admin authority.

## Authority model

Endpoint:

`GET /v1/client/rail-canonical?clientId=<current-context>&contractId=<current-context>`

The query values are context selectors only. They are never accepted as authorization.

The server authenticates the portal session, requires role `CLIENT`, then resolves the requested context through:

- active `client_user_bindings`;
- `client_user_has_contract_access(user, contract, now())`.

Deals are then discovered on every request from active authoritative `deals` rows for the resolved client/contract and independently checked through:

- `client_user_has_deal_access(user, deal, now())`.

An unauthorized or tampered client/contract pair returns the same fail-closed `CONTEXT_NOT_FOUND` response as a nonexistent context.

The endpoint does not accept a browser-supplied Deal ID. Deal discovery is entirely server-derived. A new active Deal therefore appears automatically without code, publication records or redeploy. An application by itself does not appear until an active Deal exists.

## Shared canonical Rail generation core

Migration:

`supabase/migrations/20260919182000_client_rail_internal_read_model_core_v1.sql`

introduces the internal server-only generation function:

`portal_private.rona_rail_deal_map_read_model_core_v1(deal_key, deal_id)`.

The core contains the canonical V2 generation logic plus the current V4 route overlay and emits the existing V4-compatible contract:

- Rail documents and trusted current wagon positions;
- station coordinates and provenance;
- planned, actual and remaining routes;
- route progress, stations and assignment;
- unresolved/conflict count;
- `modelVersion = RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4`;
- `sourcePolicy = PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1`.

The core makes no user/role authorization decision. It is `SECURITY INVOKER`, lives in `portal_private`, and execution is revoked from `public`, `anon`, and `authenticated`. It is not exposed as a Client/browser RPC. A trusted server caller must authorize scope first and then supply the exact server-derived `deal_key + deal_id`.

## Admin authority remains unchanged

Both canonical Admin V4 entry points retain:

`owner_r1_actor('ADMIN')`

and only then delegate generation to the shared internal core. The rework does not weaken `owner_r1_actor`, loosen Admin RLS/authority, grant Client execution of Admin V4, or change Admin Rail selection/route/wagon semantics.

## Client read path after authorization

After the authenticated CLIENT contract/deal checks succeed, the Edge handler calls:

`portal_private.rona_rail_deal_map_read_model_core_v1(server_deal_key, server_deal_id)`

through the trusted server database connection. It never invokes the Admin-only V4 wrapper.

The returned model is rejected unless it has exactly `RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4`, exactly one Deal, and exact equality of returned `dealId/dealKey` with the server-derived Deal. Missing, ambiguous, mismatched, or degraded generation returns HTTP 503 `CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE`.

No parallel route engine, wagon registry, MOVIZOR path or Client publication table is introduced.

The Client projection still carries `deals[]`, `rail[]`, `plannedRouteByDeal`, `actualRouteByDeal`, `remainingRouteByDeal`, `routeProgressByDeal`, `routeStationsByDeal`, `routeAssignmentByDeal`, and `railReadModel`. The Client authority marker remains `AUTHENTICATED_CLIENT_CONTRACT`; Admin authority is never exposed.
## Refresh and context isolation

The Client adapter now consumes only `/portal/api/v1/client/rail-canonical`.

It inherits the Admin 30-second/data-change-only Rail runtime and its last-good behavior. A failed or degraded canonical refresh cannot replace an existing good snapshot.

A change of authenticated Client context is different: the previous snapshot, selected Deal and map data are cleared before the new context is requested. This prevents a failed or unauthorized context switch from leaving another client/contract's Rail state visible.

## Production-v56 preservation

`client-rail-admin-parity-v1.ts` captures and delegates to the exact deployed v56 source:

`53a3266f64bdf4e44d5daf09507a6fd46c0678ad/.../payments-v8-production-hardening.ts`.

Every route except `/v1/client/rail-canonical` is passed unchanged to that live handler. The #670 candidate therefore does not replace or reconstruct Finance, Payments, Access, Prices or other existing portal behavior. This v56 lock supersedes the stale v55 assumption that existed in the first draft of PR #672.

No authoritative business write is performed by the new endpoint.

## Visual-freeze authority

Owner marker: `OWNER_VISUAL_APPROVAL: CLIENT_ONLINE_RAIL_PRODUCTION_PARITY_WITH_ADMIN_20260919`.

Issue #670 is an explicit owner requirement to make Client Online Rail visually and functionally equivalent to the current Admin Online Rail while preserving client isolation. The Client visual freeze remains active. A dedicated exact-blob governance record authorizes only the two already-protected Client Rail presentation/build files changed by #670; wildcard exceptions and unrelated Client visual changes remain prohibited.

## Frozen surfaces

#670 intentionally does not change:

- Admin Rail Stage A/A.1/current UI;
- #644 Rail read-model semantics;
- B1.5 XLSX evidence/current-position architecture;
- Rail resolution authority;
- Finance / Payments / Access / Prices business semantics;
- authoritative Deal, Rail-document, wagon or route data.

## Real integration acceptance gate

Mocked `/v1/client/rail-canonical` responses are **not** backend acceptance evidence.

Dedicated workflow `.github/workflows/issue670-client-rail-real-integration.yml` starts an isolated local Supabase stack, applies only an ephemeral #670 integration substrate plus the candidate migration, and runs the real candidate Edge handler against real local Supabase Auth and PostgreSQL.

The real gate proves:

- a real Supabase Auth CLIENT JWT/session;
- the actual candidate Edge handler is invoked;
- real PostgreSQL contract/deal authority checks;
- authorized Deal -> HTTP 200 + V4-compatible canonical `railReadModel`;
- foreign client/contract -> fail closed with no data leak;
- browser Deal query tampering cannot change authority;
- CLIENT cannot directly execute Admin V4 or the internal core;
- a newly inserted active Deal is automatically discovered on the next request;
- induced backend read-model degradation -> HTTP 503;
- frontend refresh after 503 preserves the last-good Rail view;
- Client context change clears prior Rail state;
- tariff matrix remains absent.

The existing fixture browser test remains only a frontend regression harness. The main #670 workflow records `MOCK_BROWSER_BACKEND_ACCEPTANCE=NOT_CLAIMED`; backend acceptance is owned by the real integration workflow.

## Review gate

Before #672 can advance:

1. all #670 source/build/visual/tenant gates must be green;
2. the real authenticated Edge/PostgreSQL integration gate must be green with exact run/artifact evidence;
3. `CURRENT_STATE_FIRST` must be repeated after the final candidate commit;
4. exact candidate HEAD must be reported;
5. System Administrator must independently re-review the corrected authority path;
6. owner visual acceptance remains a subsequent gate.

Until then: **NO MERGE / NO DEPLOY.**
