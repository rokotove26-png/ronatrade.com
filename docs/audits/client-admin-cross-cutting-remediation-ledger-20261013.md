# RONA Trade — сквозной аудит и безопасное устранение дефектов Client LK / Admin LK

**Дата источников:** 2026-10-13. **Роль:** AI-SYSTEM-ADMIN (технические решения; Owner и профильные роли утверждают доступы и бизнес-операции).  
**Задача владельца:** проверить всю взаимосвязанную работу **обоих личных кабинетов** и исправить всё технически подтверждённое без нарушения действующей функциональности, данных и разграничения прав. **Релиз или отдельная правка типографики — не подмена этой задачи.**  
**Состояние:** `ACTIVE AUDIT / PARTIAL VERIFIED / PRODUCTION UNCHANGED / ACCEPTANCE HOLD`.

**SOURCE LOCK:** текущий действующий релиз `release/public-go-live-v1.1` @ `f8f0233a33b321e8fc54a7e404cd85e3eff21718`. Общий аудит [PR #1172](https://github.com/rokotove26-png/ronatrade.com/pull/1172) (DRAFT, HEAD `0e72544b1162a6bb66a83924c8839a23c1f61786`), изолированное визуальное исправление [PR #1173](https://github.com/rokotove26-png/ronatrade.com/pull/1173) (DRAFT, HEAD `16c3942f85b9e6889699f7f5e4ba156a000e9c43`). Без их авторизованного прохождения через контрольные gate **не объединять, не деплоить, не выполнять SQL**.

## 1. Текущая карта проблем — статус каждого вывода

Статусы: `CONFIRMED` — подтверждено проверяемыми источниками; `FIXED_NONPROD` — исходник/тест исправлен только в черновой ветке и профильный gate пройден, **не production**; `PARTIAL` — подтверждена лишь часть проверки; `PENDING_AUTH_E2E` — нужны реальные авторизованные браузерные сессии и отрицательные сценарии; `HOLD` — изменение запрещено до зависимостей/приёмки; `SOURCE_UNVERIFIED` — нельзя делать окончательный вывод.

| ID | Приоритет | Аудиторское наблюдение | Состояние и доказательство | Что требуется до закрытия |
|---|---|---|---|---|
| CI-01 | P0 gate | Начальные 6 failure на production; исторические source-assertion ошибки | **PARTIAL.** PR #1172: 43/48 PASS, остаются 5 failure (Rail #670, old Owner QA, Admin Prices narrow-only, visual-freeze approval, Multi-client #430). PR #1173: 35/48 PASS, 13 failure: часть тестовых несовпадений, часть подлежит проверке на действительную регрессию. | Атомарная классификация всех failure по источникам, auth и поведению; отдельные узкие PR по владельцам. Не отключать проверки ради зелёного статуса |
| CI-02 | P1 | Старые `v13/v16` вместо `v14/v17` в Client Deals; Admin sidebar hardcode 14 SVG при 13 DOM-кнопках | **FIXED_NONPROD** в PR #1172: Client sidebar и Admin sidebar QA — PASS, Admin Shell Resilience — PASS. PR #1173 на чистом release подтверждает исходные устаревшие тесты; это не является доказательством ошибки самой навигации. | Source-lock исправленные тесты, независимый runtime smoke Client/Admin, точная версия следующего защищённого тестового контракта |
| AUTH-01 | P1 auth | Read-only Client documents state идёт через legacy `rona-temp-upload-order-20260816` под Client JWT, не через verified Admin effective-client адаптер | **PARTIAL:** добавлен безопасный read-only unit-level негативный контракт в PR #1172, focused QA PASS; Client-only текущий сервис сохранён. | Реальные нормальный Client / Admin impersonation / чужой договор / replay/expiry тесты, canonical read-only адаптер и domain signoff; никогда не расширять legacy write/upload права |
| DEPLOY-01 | P0 source reproducibility | 103 Edge deployments, часть JWT-off, 77 без одноимённой release-папки | **CONFIRMED inventory / HOLD removal.** Наличие JWT-off без проверки custom auth не доказывает открытую авторизацию. | Таблица фактических caller/cron/webhook/source/last-use/deploy SHA и тест доступа для каждой функции; без массового удаления |
| DEPLOY-02 | P1 legacy | Legacy temp upload Edge v13 остаётся действующей зависимостью документов | **CONFIRMED KEEP** до переноса read-only и доказанной совместимости. | Теневой parity test, обратимое переключение маршрута, Client write/upload regression, fail-closed denial cross-tenant |
| SQL-01 | P0 lineage | В production значительно больше миграций, чем в текущей release-папке; разные version IDs | **HOLD / PARTIAL.** Отсутствие ID в одной папке не доказывает дефект DB. | Полная история источников схемы, catalog hashes, обратимый backup, SQL read-only доказательства перед изменениями |
| SEC-01 | P1 | Два Admin Rail `SECURITY DEFINER` RPC имеют лишний публичный EXECUTE по advisor | **HOLD ACL.** Внутри есть Admin+session guard; публичная привилегия сама по себе не доказывает утечку. | Отрицательные anon/foreign-session тесты, поиск существующих caller, ревью точечного REVOKE и отката; proposal SQL не применён |
| SEC-02 | P2 | RLS/no-policy/grant hygiene и search_path предупреждения | **PARTIAL.** RLS без политики — не доказательство публичного чтения. | Разбор конкретных GRANT, RLS и SECURITY DEFINER, тесты реальных ролей; без массовых REVOKE |
| PERF-01 | P2 | FK/index/PK advisory debt | **TO_VERIFY.** Advisory counts не равны производственной деградации. | Реальные slow query, планы, p95 timings, кэш/проекция; никаких DROP/REINDEX без source + rollback |
| GIT-01 | P1/2 | Незащищённая release-ветка, исторические PR/ветки, расхождение main/release | **CONFIRMED / HOLD cleanup.** PR #1173 имеет узкий 3-file delta; исходный аудит PR #1172 более широкий и не годится для автоматического общего merge. | Protection/required checks, документированный release provenance, независимые scope-safe PR и immutable rollback, без удаления истории |
| UI-01 | P2 | Hidden Admin Documents, старые совместимые Operations и Claims visual writers | **PARTIAL / HOLD.** Admin Shell и current Access проходят проверки в PR #1172; это не доказывает отсутствие старых writers во всех live-вкладках. | Проверка emitted JS, единого владельца DOM, реальная Chrome навигация; сохранить Analytics R4/V20 и Operations V11 |
| CLIENT-01 | P1 | Исторические refresh loops/MutationObserver и source-authority конфликты | **PENDING_AUTH_E2E.** Отдельные QA пройдены, но source `CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE` и `HOME_REENTRY_CONTEXT_OWNER` в старом Owner browser QA остаются неразрешёнными. | Подтвердить на canonical fixture и реальной auth, 120 s idle trace, A→B→A при inflight GET и re-entry, ноль cross-tenant flash |
| UI-02 | P2 | Broad Claims retirement MutationObserver и DOM pruning | **CONFIRMED code pattern / HOLD replacement.** Не удалять Claims скрипт пока есть route/import. | Edges/deep-links, emitted-callers, MutationObserver CPU/DOM traces, safe route retirement then visual regression |
| APP-01 | P1 QA | В историческом Owner QA синтетические `APP-B-*` не соответствовали `RONA_APPLICATION_BUSINESS_V2` | **CONFIRMED fixture issue, not confirmed product bug.** Изолированная V6 с каноническими заявками проходит Client B, opened row after refresh, A/B/A; оригинальная frozen V4/V5 не изменялась. | Source-locked successor для protected Owner QA; тест реальной сессии, не подменять ошибкой fixture ошибку бизнес-функции |
| DEAL-01 | P1 QA | Историческая проверка Passport `visible:null`; отсутствует корректный mock `/v1/client/deal-state` | **CONFIRMED QA deficiency / production not proven broken.** V6 при корректном каноническом mock отображает USD 113500 и связывает паспорт со сделкой. | Authenticated Client passport and Admin read-only impersonation tests, full amount provenance and no data mixing |
| TYPO-01 | P2 visual | Двойной 1.10×1.10 масштаб разделов и ложный clip навигации из `::after` | **FIXED_NONPROD** в узком PR #1173 (точно 3 файла; visual freeze PASS; canonical build PASS). V6 в PR #1172 проходила 1366/1440/1920 text bounds и 19 сценариев; PR1173 не означает завершённый Owner UAT. | Тест на сам checked-in PR1173 source с real Client/Admin auth, управляемый Owner visual accept и rollback |
| ADMIN-01 | P1 pending | Admin owner-auth wrapper, sidebar/Access, agent permissions и current routing | **PARTIAL.** В PR #1172 Admin Shell, Access, sidebar, authenticated interactivity PASS; на чистом release PR #1173 остаются старые SHA/source assertions и один owner-auth источник требует отдельного review. | Верифицировать JWT gateway + session, owner fallback, не меняя имена/права; authenticated Admin tab E2E и Client forbidden views |
| DEPLOY-03 | P1 | Supabase deployed `rona-portal-api` v106 | **PARTIAL provenance.** Payments V8 deployed entrypoint source pin сверялся с точным release blob; этот факт НЕ доказывает source parity всех 103 Edge функций. | Дальнейшая поштучная source ↔ version ↔ caller таблица и typed auth tests |
| ACCEPT-01 | P0 exit | Полная acceptance Client + Admin и безопасный rollout | **NOT ACCEPTED.** Нет общей подтверждённой authenticated UAT, ролескопа и требуемого воспроизводимого deployment trace. | Полное прохождение настоящих кабинетов, вход/выход, роли, документы, бизнес-разделы, 360/768/1440, нулевые critical console, rollback proof |

## 2. Обязательные сценарии сквозной проверки

| Область | Positive-path | Negative-path / защита | Где фиксировать результат |
|---|---|---|---|
| Client login / first paint | Login, refresh, logout, page navigation | Expired/forged token, stale section render | Browser trace/CI |
| Client company context | A/B/A + смена договора, карточки, заявки, паспорт | Old A data in B, inflight stale response, unseen owner state | Browser network, DOM, current projection |
| Applications | Create/view/status/filter, current KPI and Business V2 | Noncanonical ID, foreign company/contract, stale DOM | Canonical read-only fixture + authenticated E2E |
| Deals / Passport | Deal stage, amount source, open/refresh, closing docs | Foreign deal, stale contract, missing canonical deal-state | Source provenance + real Client UAT |
| Documents | Read/download and signed state | Non-Client role, Admin impersonation replay, foreign contract, POST via read endpoint | HTTP 401/403/405/409 + SQL/RLS source |
| Payments / finance | Client payment projection and Admin finance controls | Agent/Client private P&L, mutation without approval | Role matrix + API trace |
| Rail / prices / analytics | Canonical current source, no duplicated writer | Cross-tenant data, historical source fallback, legacy owner overwrite | Module specific CI and Owner/role E2E |
| Admin Access | Users, Agents, permissions, company binding | Role escalation, unpublished contract, fallback JWT, restricted Client route | Verified Admin session + negative auth |
| Stability | 120 s idle, navigation, slow network, offline recovery | Hidden-section polling, uncontrolled observer, stale-response repaint, repeated errors | Chromium CPU/network traces |
| Visual | 360/768/1366/1440/1920 plus contrast/keyboard | Text clipped, navigation hidden, double scale, broken first paint | Screenshot diff and source SHA |

## 3. Rules for safe repair

1. **CURRENT_STATE_FIRST / SOURCE_LOCK:** pin live release, deployed Edge versions, SQL catalog and exact file SHA before touching code.
2. **ATOMIC DELTA:** one owned module/defect per patch. Separate QA fixture from production runtime; no broad PR deploy.
3. **REAL ERROR FIRST:** failed CI is not automatically stale, and PASS with synthetic fixture is not authenticated production proof.
4. **FAIL CLOSED:** preserve role/tenant checks, historical approvals and legitimate existing Client/Admin behavior; never manufacture business facts or widen auth.
5. **NONDESTRUCTIVE:** no mass-deletion of Edge functions/branches/history; no SQL/role/caller mutations without explicit domain gate.
6. **ROLLBACK:** exact prior SHA, reproducible build, previous live deployment source and reversible switch for each behavioral change.
7. **RELEASE ONLY AFTER VERIFIED ACCEPTANCE:** no unresolved P0/P1 impacting real users; signed real Owner UAT/required role conclusions; all **applicable** gates green; postdeploy live smoke.

**Next atomic work:** (i) isolate `HOME_REENTRY_CONTEXT_OWNER` and stale response under real authority vs synthetic fixture, (ii) review Admin Owner JWT fallback and dynamic sidebar counts without relaxing auth, (iii) produce deployment/SQL lineage and negative-role traces, (iv) only then stage scoped source fix and run full regressions.

**Do not confuse an isolated typography PR with closure of the cross-cutting audit.**

## 4. 2026-10-13 — documents workflow availability / Admin impersonation QA (incremental evidence)

**Observed code mismatch (CONFIRMED SOURCE, not live exploit):** Pages route `functions/portal/api/v1/client/deal-documents/state.js` calls the active legacy Edge document-state endpoint and the canonical Client context, but does **not** apply `_browser-impersonation.js` to either upstream. The deployed legacy document Edge v13 and its release-source equivalent `rona-client-deal-documents/index.ts` both require the `CLIENT` role, and `workflowState` scopes by both Client/contract and `client_user_has_deal_access`. Existing `scripts/qa-client-impersonation-tab-binding-browser-v1.mjs` previously returned synthetic 200 for the document-state route and therefore could not prove Admin document compatibility.

**Test-only fix (FIXED_NONPROD):** fixture now returns an explicit synthetic `401 PORTAL_ACCESS_DENIED` and verifies that the impersonation tab is still attached to the request. Independent Chromium gate `Client Owner Business V2 Fixture V6`, run `38345024722`, confirms `CLIENT_IMPERSONATION_DOCUMENTS_CLIENT_ONLY_DENIAL_QA=PASS`, preserves `CLIENT_IMPERSONATION_BROWSER_QA=PASS`, and revalidates `QA_V6_CANONICAL_BROWSER_E2E=PASS` on the audit candidate. This test does **not** certify a real logged-in Admin session or backend permission change.

**UI fail-safe discrepancy (PARTIAL):** protected `assets/portal-runtime/client-deal-documents-v5.js` currently uses a `.catch(()=>({deals:[]}))` fallback for workflow-state failures, equating unavailable status with an empty state projection. Thus already-published canonical documents may still be loaded, but the reason for workflow-state unavailability is not shown. A source-locked **disposable-dist-only** preview (`scripts/qa-client-document-workflow-unavailable-preview-v1.mjs`) prepares a warning for unavailability, preserves existing canonical-document rendering and upload-authority conditions in source, and adds availability to the DOM signature for recovery. Chromium workflow `38345256900` executed this preview's four exact substitutions and syntax check successfully. **Actual warning rendering and recovery were NOT browser-tested** because expansion of the authenticated-denial fixture was blocked; no protected runtime file was changed.

**Safe closure gates:** obtain explicit Owner approval for any protected visual-file delta; verify actual warning visibility, published document link integrity and no forged upload under both normal Client and verified read-only Admin impersonation; develop separate effective-client, strict read-only Admin route with domain acceptance rather than weakening legacy Client-only guard. Test foreign contract, expired session, stale impersonation tab, recovery on 401→200 and no cross-tenant state flash. Before those checks: `DOCUMENT_UI_GOVERNANCE_HOLD` / `ADMIN_DOCUMENT_READ_PATH_PENDING`.


## 5. 2026-10-13 — independently verified continuation (SYSTEM_ADMIN)

**Visual authority:** only Owner may perform visual acceptance of Client/Admin/Agent LK; synthetic Chromium proof is not Owner acceptance.

### Client document workflow candidate
- Isolated DRAFT [PR #1174](https://github.com/rokotove26-png/ronatrade.com/pull/1174) starts from frozen release `f8f0233a33b321e8fc54a7e404cd85e3eff21718`; baseline protected document source blob `a1b724867218de56a168372dd33fc8d16a4f6266`.
- Strict Issue432 materializer compatibility fixed; canonical Client build and context coherence CI PASS on commit `fd6e2f7f14eb1b6f271de4a117ed55e0d655eb5d`.
- Isolated Chromium [run 38365721951](https://github.com/rokotove26-png/ronatrade.com/actions/runs/38365721951) SUCCESS: synthetic workflow 401 shows unavailable status; separately published Invoice/Addendum remain visible; upload disabled with unavailable workflow; synthetic 401→200 recovery restores a proven workflow-controlled upload. Source contract and exact canonical build also PASS.
- No real signed-in Client/Admin impersonation UAT, foreign-contract denial, revoked-session proof, Owner visual approval, production mutation or release. Existing mandatory and specialist gates remain HOLD.

### Rail RPC least-privilege check
- Live catalog shows `anon EXECUTE = true` on SECURITY DEFINER functions `public.rona_admin_rail_monitoring_lifecycle_v1()` and `public.rona_admin_rail_monitoring_complete_v1(text)`. Both call `portal_private.application_owner_admin_actor_v2()` which checks current auth user, JWT session ID, session validity, ADMIN role and revocation semantics.
- Each distinct `BEGIN READ ONLY; SET LOCAL ROLE anon; SELECT function(...); ROLLBACK;` negative-path test failed with PostgreSQL `P0001 APPLICATION_OWNER_ADMIN_REQUIRED`; completion used nonexistent deal `DEAL-2099-999`. These prove DB anonymous/no-session denial only, not external PostgREST denial.
- Proposed REVOKE SQL in this audit branch remains UNAPPLIED; require externally witnessed negative auth test, caller compatibility, security approval and rollback.

**Current status:** ACTIVE AUDIT / PRODUCTION UNCHANGED / ACCEPTANCE HOLD. No visual approval marker or gate suppression.
