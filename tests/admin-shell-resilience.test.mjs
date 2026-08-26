import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const admin=read('functions/portal/admin.js');
const middleware=read('functions/portal/_middleware.js');
const runtime=read('assets/portal-admin-shell-fast-v1.js');
const watchdog=read('assets/portal-admin-runtime-watchdog-v1.js');
const build=read('scripts/build-pages-direct-canonical.mjs');
const shell=read('portal-src/current/admin.html');
const access=read('functions/portal/clients-agents-current-ui.js');
const analytics=read('functions/portal/analytics-v2-ui.js');
const railSafe=read('functions/portal/rail-safe-fallback-ui.js');
const remaining=read('functions/portal/remaining-sections-ui.js');

assert(admin.includes('ASSETS?.fetch'),'Admin route must serve the static current shell through the asset binding');
assert(admin.includes("u.pathname='/portal/admin';"),'Cloudflare Static Assets must receive the Admin pretty pathname');
assert(!admin.includes("u.pathname='/portal/admin.html';"),'Direct .html Static Assets path must not return to Admin route');
for(const marker of ["'x-rona-admin-shell','current-only-v2'","'x-rona-admin-auth','server-verified-v1'","'x-rona-admin-current-only','main-v2-shell-v2'",'async function sessionProbe(accessToken)','async function ensureSession(request)'])assert(admin.includes(marker),`Admin route marker missing: ${marker}`);
assert(!admin.includes('HTMLRewriter')&&!admin.includes('adminLoginGate')&&!admin.includes('rona-admin-auth-v3413'),'Legacy Admin route behavior returned');
assert(admin.includes("if(!rolesOf(session.me).includes('ADMIN'))"),'Admin role must be verified server-side');
assert(admin.includes("if(session?.unavailable)return recoveryPage(request,session.setCookies)"),'Transient auth failures must preserve the session');
assert(admin.includes("if(!session)return loginRedirect(request,clearCookies())"),'Invalid sessions must return to canonical login');

assert(middleware.includes("if(url.pathname==='/portal/admin')return context.next();"),'Portal middleware must bypass Admin HTML');
const bypass=middleware.indexOf("if(url.pathname==='/portal/admin')return context.next();"),text=middleware.indexOf('response.text()');
assert(text<0||bypass<text,'Admin must bypass response buffering');

for(const marker of ['rona-admin-shell" content="current-only-v2','data-rona-admin-shell="current-only-v2','current-only-router-v2','id="nav"','id="page-home"','id="page-prices"','id="page-access"','id="page-agent-settlements"','id="page-claims"','id="page-market-news"','portal-admin-shell-fast-v1.js','clients-agents-current-ui'])assert(shell.includes(marker),`Current Admin shell missing ${marker}`);
for(const marker of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','admin_externalized','BOOT_ERROR_LATCH_FINAL_CANDIDATE'])assert(!shell.includes(marker),`Legacy Admin marker returned: ${marker}`);
assert(shell.includes('grid-template-columns:272px minmax(0,1fr)'),'Canonical Home-scale sidebar must be owned by the current shell');
assert(shell.includes('min-height:48px')&&shell.includes('font-size:14.5px'),'Canonical navigation sizing missing');
assert(shell.includes('data-action="create-access">Создать доступ</button>'),'Current shell must expose primary access action before module mount');
assert(shell.includes("sessionStorage.setItem('rona.admin.currentPage',page)"),'Current shell must preserve explicit navigation');
assert(shell.includes('new MutationObserver(scheduleGuard)'),'Current shell must guard against late navigation resets');
assert(shell.length<60000,'Current Admin shell must remain structural, not a bundled legacy cabinet');

assert(build.includes("path: 'portal-src/current/admin.html'"),'Build must source Admin from current shell');
assert(build.includes('CURRENT_ONLY_ADMIN_SHELL_WITH_FROZEN_CANONICAL_ASSETS'),'Build integrity must declare current-only Admin architecture');
assert(build.includes('legacy_runtime_in_deployment:false'),'Build integrity must fail closed on legacy deployment');
assert(build.includes('current-only-router-v2'),'Build must reject a shell without authoritative current router');

assert(runtime.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'Single-owner runtime marker missing');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='CHECKING'"),'Async session state missing');
assert(runtime.includes("if(r.status===401||r.status===403)"),'Only explicit auth denial may redirect');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='DEGRADED_BACKEND'"),'Transient backend degradation state missing');
for(const required of ['/portal/main-ui','/portal/claims-r2-ui','/portal/remaining-sections-ui','/portal/prices-current-ui','/portal/analytics-v2-ui','/portal/rail-current-v81-maplibre-ui','/portal/rail-safe-fallback-ui'])assert(runtime.includes(required),`Required current module missing: ${required}`);
for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','owner-layout-polish-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])assert(!runtime.includes(forbidden),`Competing Admin module returned: ${forbidden}`);
assert(runtime.includes('async function loadRail()')&&runtime.includes("root.dataset.ronaRailOwner='safe-fallback-direct-child-v1'"),'Rail primary/fallback recovery missing');
assert(runtime.includes('async function loadAnalytics()')&&runtime.includes("root.dataset.ronaAnalyticsOwner='analytics-v2'"),'Dedicated Analytics owner missing');
assert(!runtime.includes("['agent-settlements','messages','analytics','market-news'].includes(p)"),'Analytics/News must not be routed back to Remaining owner');
assert(!runtime.includes('enforceOwners')&&!runtime.includes('installOwnerGuards'),'Fast shell must not own page DOM');

assert(watchdog.includes("window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v5-market-news-content-health'"),'Page-aware watchdog missing');
assert(watchdog.includes("if(p==='monitoring')return'rail'")&&watchdog.includes("if(p==='analytics')return'analytics'")&&watchdog.includes("if(p==='market-news')return'market-news-current'"),'Current recovery mappings missing');
for(const marker of ["root.querySelector(':scope > .mn-masthead')","root.querySelector(':scope > .mn-toolbar')","root.querySelector(':scope > .mn-statusline')","root.querySelector(':scope > main')","activateMarketNews('watchdog-content-repair')"])assert(watchdog.includes(marker),`Market News content-health recovery missing: ${marker}`);
assert(!watchdog.includes('location.reload(')&&!watchdog.includes('location.replace('),'Watchdog must never navigate/reload during UI recovery');

assert(remaining.includes("window.__RONA_MARKET_NEWS_OWNER_GUARD_V6__='20260827-content-health-v6'"),'No-store Market News owner guard v6 missing');
assert(remaining.includes("if(!healthy(root))emitRepair('market-news-owner-guard-v6-content-repair')"),'Market News empty-root repair missing');
assert(remaining.includes("headers.set('x-rona-market-news-owner','dedicated-current-content-health-v6')"),'Market News no-store owner header missing');

assert(railSafe.includes('const WATCH_FROM=')&&railSafe.includes('const WATCH_TO='),'Rail fallback safe observer contract missing');
assert(railSafe.includes("observer.observe(host,{childList:true})"),'Rail fallback replacement observer must be direct-child only');
assert(railSafe.includes("if(!q('[data-rail-current-root]',host))queueRepair()"),'Rail fallback may repair only when current root is lost');
assert(railSafe.includes('.replace(WATCH_FROM,WATCH_TO)'),'Rail fallback must replace the recursive observer before serving runtime code');
assert(railSafe.includes("window.__RONA_RAIL_SAFE_FALLBACK__='20260826-direct-child-v1'"),'Rail safe fallback marker missing');

assert(access.includes("window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v4'"),'Current Clients/Agents owner missing');
assert(access.includes("const OWNER_API='/portal/owner-api',AUTH='/portal/admin-authority'"),'Current access UI must use current server APIs');
assert(access.includes("new Option('Клиент','Клиент'),new Option('Агент','Агент')"),'Client/Agent creation modes missing');
assert(access.includes("dataset.ronaCreateAccess='primary'")&&access.includes("setAccessUserPassword")&&access.includes("'Сменить пароль'"),'Access management controls missing');
assert(access.includes("['history','История и права']"),'Access history/rights view missing');
assert(access.includes("const clientContract=kind===''||kind==='CLIENT_CONTRACT'"),'Agent bindings must not enter Client contract mutation path');
assert(!access.includes('installShellParity')&&!access.includes('installNavigationStability'),'Page module must not mutate global shell/navigation');
assert(access.includes("'x-rona-shell-mutation':'none'"),'Page-scoped shell mutation contract missing');

assert(analytics.includes("window.__RONA_ANALYTICS_V2__='20260826-analytics-v4-operational-market'"),'Approved Analytics v4 owner missing');
for(const marker of ['Управленческий срез','Торговая аналитика','Клиентская аналитика','Логистика и экспорт','Экспортные направления','Динамика'])assert(analytics.includes(marker),`Analytics functional block missing: ${marker}`);
assert(analytics.includes("operationalSource:'OWNER_ADMIN_BOOTSTRAP'")&&analytics.includes("'x-rona-shell-mutation':'none'"),'Analytics source/shell contract missing');

console.log('Admin current-only single-owner resilience QA: PASS');
