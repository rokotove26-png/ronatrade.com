# Client Portal — системный сквозной аудит current state

Дата фиксации: 2026-09-21  
Production branch: `release/public-go-live-v1.1`  
Production HEAD at audit start: `8ac74e36bd78ba7ae4e470a945c9c536bb2149bf`

## 1. Цель

Довести Client Portal до модели:

- один авторитетный источник данных на домен;
- отсутствие фоновых циклов без фактического изменения данных;
- обновление при открытии раздела, смене Client Context, подтвержденной мутации или явной серверной invalidation;
- отсутствие параллельных владельцев одного и того же состояния;
- одинаковая работоспособность обычного Client login и Admin -> Client read-only impersonation;
- fail-closed tenant isolation;
- отсутствие мертвых/конкурирующих runtime-владельцев и шумных QA gate.

## 2. Concurrent work / границы

На момент аудита открыт draft PR #810 `Client current state: authoritative auto-refresh and payment semantics`. Он изменяет, среди прочего:

- `client-context-selection-authority-v1.js`;
- `client-deal-lifecycle-v1.js`;
- `client-payments-authoritative-v1.js`;
- `client-payments-canonical-layout-v1.js`;
- `functions/portal/api/v1/client/deal-documents/state.js`;
- materializers/QA этих контуров.

Поэтому исправления, затрагивающие эти файлы, должны координироваться с #810 и не вноситься параллельно без rebase/review.

Отдельные draft remediation PR:
- #811 — event-driven cleanup для Client shell / price conditions / logout visual;
- #812 — event-driven Client Rail без 30s polling.

## 3. Критические находки

### P0 — специализированные Client Pages routes обходят impersonation-aware gateway

Core routes `/v1/client/bootstrap` и `/v1/client/context` используют `_browser-impersonation.js`, прокидывают `x-rona-admin-impersonation-token` и `x-rona-impersonation-tab` в `rona-portal-api`.

Но более специфичные Pages Functions имеют собственную авторизацию и не наследуют это автоматически:

- `functions/portal/api/v1/client/market-intelligence.js`;
- `functions/portal/api/v1/client/deal-documents/state.js`;
- `functions/portal/api/v1/client/applications-projection.js`.

`market-intelligence.js` вызывает RPC `owner_client_market_intelligence_feed_v1`, который внутри требует реального `CLIENT` через `owner_r1_actor('CLIENT')`. При Admin -> Client impersonation браузерный access token остается Admin JWT, поэтому этот специализированный маршрут не эквивалентен core Client authority.

`deal-documents/state.js` также вызывает upstream только с Bearer access token и не передает browser impersonation authority. Этот файл уже изменяется в #810 и должен быть нормализован там.

`applications-projection.js` имеет тот же архитектурный дефект, но текущий canonical Applications build удаляет этот ghost endpoint и заменяет его на `RONA_CLIENT_CONTEXT.whenCurrentProjection(...)`; поэтому это прежде всего stale/dead route debt, а не текущий основной renderer path.

**Acceptance:** все Client routes, включая specialized Pages functions, должны проходить через один impersonation-aware authorization boundary.

### P0/P1 — несколько независимых 30s network refresh owners

В production source обнаружены независимые периодические владельцы:

1. `client-application-lifecycle-v1.js`  
   `REFRESH_MS=30000` + `setInterval(()=>loadWhenNeeded(false),REFRESH_MS)`.

2. `portal-client-applications-canonical-v1.js`  
   `REFRESH_MS=30000` + `state.timer=setInterval(()=>load(false),REFRESH_MS)`.  
   Materializer дополнительно требует наличие этого interval, то есть polling закреплен build-contract.

3. `client-payments-authoritative-v1.js`  
   `REFRESH_MS=30000` + `setInterval(()=>load(true),REFRESH_MS)`.  
   Этот файл меняется в #810.

4. Client Rail наследует Admin v8.1 30s poll.  
   Draft #812 удаляет polling только в Client adapter и оставляет Admin Rail без изменений.

5. Draft #810 добавлял еще один глобальный 30s refresh current projection с TTL 15s. Это создавало бы дополнительного owner поверх уже существующих Applications / Payments / Rail. На #810 оставлен coordination note: не merge polling в таком виде.

**Целевой контракт:** нет периодического GET только потому, что вкладка открыта. Обновление выполняется при:
- первом открытии нужного раздела;
- смене Client Context;
- подтвержденной клиентской мутации;
- явном invalidation event;
- pageshow только для реально активного раздела.

### P1 — частые DOM polling loops без сетевой необходимости

Найдены:

- `client-logout-visual-v1.js`: каждые 1500 ms;
- `client-payments-canonical-layout-v1.js`: каждые 1000 ms;
- `client-price-conditions-v1.js`: каждые 4000 ms;
- `client-shell-guard-v3.js`: каждые 5000 ms.

Это не обязательно создает network traffic, но постоянно будит main thread, повторно сканирует DOM и конкурирует с MutationObserver/event handlers.

Draft #811 уже переводит shell guard, price conditions и logout visual на event/mutation-driven model.

`client-payments-canonical-layout-v1.js` входит в scope #810 и должен быть исправлен там, а не параллельным PR.

### P1 — broad MutationObserver ownership

Несколько runtime наблюдают весь `document.body` или `document.documentElement`, иногда с `characterData` и attributes:

- Context authority;
- Payments;
- first-paint;
- logout visual;
- analytics spacing;
- deal passport/canonical visual;
- shell normalization.

Network fanout не должен запускаться непосредственно из MutationObserver. Observer должен только:
- локально выравнивать/рендерить DOM;
- быть scoped к root конкретного раздела;
- не реагировать на собственные записи без guard/signature.

### P1 — duplicate/current-state fetch ownership

Исторически несколько runtime отдельно запрашивают `/v1/client/context` вместо потребления `RONA_CLIENT_CONTEXT.current projection`.

Целевой принцип:
- `RONA_CLIENT_CONTEXT` — единственный owner current projection;
- Home / Deals / Payments / Operations consumers читают projection;
- отдельные endpoint нужны только для действительно независимых read-model (Rail, Market Intelligence и т.п.);
- invalidation после mutation обновляет authority один раз, consumers получают событие.

### P1 — QA noise masking real regressions

Часть workflows жестко привязана к старым base SHA (например Issue #430 gates), поэтому падает на любом современном PR до выполнения предметной проверки.

Также некоторые domain-specific workflows применяют DELTA_ONLY allowlist глобально к несвязанным PR и падают из-за файлов другого домена.

Пример current release: `home-inline-real-auth-browser` уже падает на production HEAD, поэтому его failure на Client cleanup PR не является регрессией данного PR.

Нужно разделить:
- authoritative required checks для текущего release;
- historical reconstruction checks;
- domain-scoped checks, которые должны skip, если PR не затрагивает домен.

## 4. Некритичные, но реальные слабые места

### P2 — stale / legacy runtime clutter

В дереве остаются несколько поколений runtime:
- `client-contract-download-v1/v2/v3.js`;
- `client-shell-guard-v1/v2/v3.js`;
- `client-applications-live-render-v1.js` при canonical single-owner runtime;
- legacy application layout/runtime артефакты.

Удаление допустимо только после emitted-manifest proof, что файл не попадает в `dist/portal/client.html` и не является QA/governance baseline dependency.

### P2 — stale integrity metadata

`attach-client-application-lifecycle.mjs` указывает `home_bridge.refresh_ms:30000`, хотя Home runtime уже работает через Context events/current projection и не содержит постоянного 30s timer. Метаданные должны отражать реальный runtime contract.

### P2 — bounded retry loops

Есть короткие bounded loops (например попытка открыть Deal после навигации, несколько post-submit retries). Они допустимы, если:
- имеют жесткий max-attempt/max-time;
- не работают вечно;
- не делают фоновые requests без пользовательского действия.

## 5. Что уже исправляется

### Draft #811
- убран 5s shell guard poll;
- убран 4s price conditions poll;
- убран 1.5s logout visual poll;
- price sync публикует `rona:client-prices-updated`;
- visual-freeze exact governance сохранен.

### Draft #812
- Client Rail 30s polling removed;
- Admin Rail unchanged;
- Client Rail triggers: initial open / section open / context change / explicit `rona:client-rail-invalidated`;
- Rail parity/browser QA переведен на idle-no-polling + exact-one-refresh invalidation.

### Coordination with #810
На PR оставлены обязательные замечания:
- не merge proposed 30s current projection polling;
- specialized `deal-documents/state` должен стать impersonation-aware;
- canonical Applications materializer не должен требовать 30s interval.

## 6. План мероприятий

### Phase A — убрать perpetual refresh owners
1. Merge-safe event-driven cleanup #811 после relevant CI.
2. Merge-safe Client Rail cleanup #812 после relevant CI.
3. В #810 убрать:
   - global Context 30s poll;
   - Payments 30s poll;
   - Payments canonical 1s DOM poll.
4. Убрать 30s polling из canonical Applications materializer/runtime.
5. Убрать 30s `client-application-lifecycle` fetch и перевести на shared current projection + events.

### Phase B — унифицировать specialized Client routes
1. Ввести единый helper/authority для browser impersonation.
2. Нормализовать:
   - market-intelligence;
   - deal-documents/state;
   - все будущие `functions/portal/api/v1/client/*`.
3. Retire `applications-projection` route, если emitted/current callers отсутствуют; иначе перевести через unified authority.
4. Добавить exact test: normal CLIENT и Admin->Client получают одинаковый read-only payload scope.

### Phase C — single current-state owner
1. `RONA_CLIENT_CONTEXT` — единственный owner `/v1/client/context`.
2. Consumers подписываются на `rona:client-current-projection`.
3. Mutations:
   - invalidate;
   - один force refresh;
   - publish event;
   - consumers rerender без дополнительного network fanout.

### Phase D — observer hygiene
1. Scope MutationObserver к section root.
2. Убрать observers с `documentElement` там, где достаточно section root.
3. Добавить self-write guard/signature.
4. DOM-only observer не должен вызывать network request.

### Phase E — stale source cleanup
После emitted-manifest proof:
- удалить/архивировать неиспользуемые v1/v2 runtime;
- удалить ghost specialized routes без caller;
- удалить stale tests/workflows, либо перевести их в historical/non-required status.

### Phase F — QA normalization
Required production gates:
1. build;
2. tenant isolation;
3. Client auth;
4. Admin->Client impersonation;
5. multi-context switch;
6. section-open refresh;
7. mutation -> exactly one authoritative refresh;
8. idle 120s -> zero Client API requests для неактивных доменов;
9. no cross-context stale DOM;
10. no duplicate active renderer/refresh owner.

## 7. Финальные acceptance criteria

Client Portal считается доведенным до целевого состояния, когда:

- 120 секунд без действий пользователя не создают 30s Client API loops;
- открытие раздела создает максимум один authoritative refresh chain;
- mutation создает максимум один invalidation/refresh chain;
- hidden sections не poll network;
- normal Client и Admin->Client read-only preview используют одинаковые Client scope rules;
- все specialized routes понимают impersonation;
- смена компании/договора не оставляет данные прошлого context;
- no duplicate renderer owner;
- no perpetual DOM timer для визуального выравнивания;
- CI failures отражают текущий PR, а не исторические base-SHA guards;
- production release проходит real-client + impersonation E2E.


## 8. Current-state recheck after parallel remediation

Recheck against the current draft branches confirmed:

- #810 no longer contains the proposed global 30-second `RONA_CLIENT_CONTEXT` interval. The Context owner now uses lifecycle/open/online triggers with TTL and single-flight.
- #810 still contains the 30-second Payments network interval, the 1-second Payments layout interval, the canonical Applications 30-second interval requirement, and a deal-documents exact route without browser impersonation authority.
- #811 owns non-business DOM timer cleanup: shell guard, logout visual and price conditions.
- #812 owns Client-only Rail polling removal; Admin Rail remains unchanged.
- #813 owns Market Intelligence / Market News refresh scheduling and removes the hourly timers.
- #815 owns the independent Market Intelligence impersonation defect; it keeps the normal real-Client RPC path unchanged and routes Admin->Client preview through effective Client authority.

This split is deliberate: overlapping changes are not to be merged independently without rebase and current-state review.

## 9. Remote data change semantics after polling removal

Eliminating periodic polling creates one architectural requirement that must be explicit: a Client tab that remains open cannot know about a staff-side or server-side change unless one of the following happens:

1. the user opens/reopens the affected section;
2. the browser receives a server-side invalidation signal;
3. a Client mutation already known to the browser invalidates the local projection.

The target architecture should therefore use **invalidation, not data streaming**, for live remote changes:

- one authenticated Client invalidation channel per session/current context;
- event payload contains only domain/context/version metadata, not business payload;
- browser validates that the invalidation belongs to the currently authorized Client + Contract;
- invalidation is coalesced/single-flight;
- only the visible affected section refetches its authoritative projection;
- hidden sections remain idle;
- page/section open remains a safe fallback if the push channel is unavailable.

A generic timer must not be reintroduced as a fallback. Fallback is section-open/pageshow revalidation.

### Suggested invalidation domains

- `CURRENT_CONTEXT` — deal/resource/payment summary changed;
- `APPLICATIONS` — application status/counter-offer changed;
- `PAYMENTS` — Finance/bank-confirmed state changed;
- `DEAL_DOCUMENTS` — authoritative document/workflow state changed;
- `RAIL` — canonical rail read-model changed;
- `MARKET_INTELLIGENCE` — a new eligible publication was published;
- `MESSAGES` — Client/Admin mediated message state changed.

The invalidation layer should be added only after the current duplicate polling owners are removed, otherwise it would create a second refresh path rather than replace the first one.
