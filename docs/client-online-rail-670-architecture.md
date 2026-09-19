# #670 — Client Online Rail production parity with Admin

Status: repository candidate only. System Administrator owns production QA, merge and deploy.

## Current-state baseline

Architecture was derived from production release `release/public-go-live-v1.1@34d0f30ee5dd27ce17e13b804199a9715b2eb0e8`.

The Client UI already reuses the Admin Online Rail operational body, but its data adapter still composed the page from legacy `/v1/client/shipments` plus the disabled MOVIZOR client endpoint. The current Admin UI rejects that payload because it has no authoritative `railReadModel` marker. This is the direct cause of the persistent Client loading shell.

Production `rona-portal-api` is not the repository branch `index.ts`; deployed v55 is the wrapper rooted at commit `1c356872f3640f35c40158d01ae363521272ce3d`. The #670 server candidate therefore wraps that exact deployed source and intercepts only the new Client Rail canonical read endpoint.

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

## Admin read-model reuse

For each server-authorized Deal the endpoint calls the canonical production product:

`portal_private.rona_admin_rail_deal_map_read_model_v4(deal_id)`.

The result is accepted only when it contains exactly one deal and its canonical `dealId/dealKey` equal the server-derived Deal. A missing, ambiguous or degraded model fails with HTTP 503 rather than silently returning a zero projection.

No parallel route engine, wagon registry, MOVIZOR path or client publication table is introduced.

The Client projection carries the Admin-compatible products:

- `deals[]`;
- `rail[]` with current trusted positions;
- `plannedRouteByDeal`;
- `actualRouteByDeal`;
- `remainingRouteByDeal`;
- `routeProgressByDeal`;
- `routeStationsByDeal`;
- `routeAssignmentByDeal`;
- `railReadModel`.

The Client authority marker is `AUTHENTICATED_CLIENT_CONTRACT`; Admin authority is not exposed.

## Refresh and context isolation

The Client adapter now consumes only `/portal/api/v1/client/rail-canonical`.

It inherits the Admin 30-second/data-change-only Rail runtime and its last-good behavior. A failed or degraded canonical refresh cannot replace an existing good snapshot.

A change of authenticated Client context is different: the previous snapshot, selected Deal and map data are cleared before the new context is requested. This prevents a failed or unauthorized context switch from leaving another client/contract's Rail state visible.

## Production-v55 preservation

`client-rail-admin-parity-v1.ts` captures and delegates to the exact deployed v55 source:

`1c356872.../payments-v8-production-hardening.ts`.

Every route except `/v1/client/rail-canonical` is passed unchanged to that live handler. The #670 candidate therefore does not replace or reconstruct Finance, Payments, Access, Prices or other existing portal behavior.

No authoritative business write is performed by the new endpoint.

## Frozen surfaces

#670 intentionally does not change:

- Admin Rail Stage A/A.1/current UI;
- #644 Rail read-model semantics;
- B1.5 XLSX evidence/current-position architecture;
- Rail resolution authority;
- Finance / Payments / Access / Prices business semantics;
- authoritative Deal, Rail-document, wagon or route data.

## QA gate

The dedicated `issue670 client online rail parity` workflow proves:

- exact #670 DELTA_ONLY scope;
- server-side contract/deal authorization substrate;
- automatic active Deal discovery;
- canonical Admin V4 read-model reuse;
- hard-load readiness;
- per-Deal selector isolation;
- recurring refresh;
- degraded-refresh preservation;
- authenticated-context switch without inherited state;
- tampered-context fail closed;
- tariff-matrix absence;
- production Client build integrity;
- unchanged Admin Rail sources and unrelated business domains.

System Administrator must independently verify the candidate against production authentication and neighboring Client sections before merge/deploy.
