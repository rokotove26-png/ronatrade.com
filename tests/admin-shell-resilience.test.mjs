import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const admin=read('functions/portal/admin.js');
const portalRouter=read('functions/portal/[[path]].js');
const middleware=read('functions/portal/_middleware.js');
const runtime=read('assets/portal-admin-shell-fast-v1.js');
const watchdog=read('assets/portal-admin-runtime-watchdog-v1.js');
const build=read('scripts/build-pages-direct-canonical.mjs');
const shell=read('portal-src/current/admin.html');
const access=read('functions/portal/clients-agents-current-ui.js');
const analytics=read('functions/portal/analytics-v2-ui.js');
const analyticsBase=read('functions/portal/analytics-v2-approved-base.js');
const railSafe=read('functions/portal/rail-safe-fallback-ui.js');
const remaining=read('functions/portal/remaining-sections-ui.js');
const workerShell=read('functions/admin-runtime-shell-v3.js');
const workerWatchdog=read('functions/admin-runtime-watchdog-v3.js');
const workerAccess=read('functions/admin-runtime-access-v3.js');

assert(admin.includes('ASSETS?.fetch'),'Admin route must serve the static current shell through the asset binding');
assert(admin.includes("u.pathname='/portal/admin';"),'Cloudflare Static Assets must receive the Admin pretty pathname');
assert(!admin.includes("u.pathname='/portal/admin.html';"),'Direct .html Static Assets path must not return to Admin route');
for(const marker of ["'x-rona-admin-shell','current-only-v2'","'x-rona-admin-auth','server-verified-v1'","'x-rona-admin-auth-resilience','triple-authority-owner-v2'","'x-rona-admin-current-only','main-v2-shell-v2'",'async function adminFallbackProbe(accessToken)','async function authOwnerProbe(accessToken)','async function sessionProbe(accessToken)','async function ensureSession(request)'])assert(admin.includes(marker),`Admin route marker missing: ${marker}`);
assert(!admin.includes('HTMLRewriter')&&!admin.includes('adminLoginGate')&&!admin.includes('rona-admin-auth-v3413'),'Legacy Admin route behavior returned');
assert(admin.includes("if(!rolesOf(session.me).includes('ADMIN'))"),'Admin role must be verified server-side');
assert(admin.includes("'x-rona-admin-runtime-delivery','worker-failsafe-v1'"),'Admin Worker failsafe delivery marker missing');
for(const target of ['/admin-runtime-shell-v3','/admin-runtime-access-v3','/admin-runtime-watchdog-v3'])assert(admin.includes(target),`Admin route runtime rewrite missing: ${target}`);
assert(admin.includes('function rewriteAdminRuntimeSources(source)'),'Admin route must rewrite critical stale static runtime URLs in-place');
assert(admin.includes("const fallback=await adminFallbackProbe(accessToken)"),'Primary Admin auth degradation must try the isolated Admin control-plane authority before recovery mode');
assert(admin.includes("if(fallback.state!=='UNAVAILABLE')return fallback"),'Explicit control-plane fallback allow/deny must be honored before owner fallback');
assert(admin.includes("const ownerFallback=await authOwnerProbe(accessToken)"),'Admin owner fallback must validate the bearer directly with Supabase Auth');
assert(admin.includes("identity==='OWNER_ADMIN'"),'Direct Auth fallback must be restricted to trusted app_metadata portal_identity OWNER_ADMIN');
assert(admin.includes('content="10;url=${target}"'),'Recovery loop must be damped to ten seconds');
assert(admin.includes("if(session?.unavailable)return recoveryPage(request,session.setCookies)"),'Dual-authority transient auth failures must preserve the session');
assert(portalRouter.includes("const ADMIN_CONTROL_PLANE_API = \`${SUPABASE_URL}/functions/v1/rona-admin-control-plane\`;"),'Portal router Admin control-plane authority missing');
assert(portalRouter.includes('async function adminControlPlaneProbe(accessToken)'),'Portal router Admin fallback probe missing');
assert(portalRouter.includes("const requestedPath=canonicalProtectedPath(new URL(request.url).pathname),allowAdminFallback=requestedPath==='/portal/admin'"),'Admin fallback must be scoped only to /portal/admin');
assert(portalRouter.includes('async function authOwnerProbe(accessToken)'),'Portal router owner Auth fallback missing');
assert(portalRouter.includes("const ownerFallback=await authOwnerProbe(accessToken);if(ownerFallback.state!=='UNAVAILABLE')return ownerFallback"),'Portal router must use trusted owner Auth fallback after both Edge authorities are unavailable');
assert(admin.includes("if(!session)return loginRedirect(request,clearCookies())"),'Invalid sessions must return to canonical login');

assert(middleware.includes("if(url.pathname!=='/portal/client')return response;"),'Portal middleware must leave non-Client routes untouched');
const clientOnly=middleware.indexOf("if(url.pathname!=='/portal/client')return response;"),text=middleware.indexOf('response.text()');
assert(clientOnly>=0&&(text<0||clientOnly<text),'Non-Client routes must bypass response buffering');

for(const marker of ['rona-admin-shell" content="current-only-v2','data-rona-admin-shell="current-only-v2','current-only-router-v2','id="nav"','id="page-home"','id="page-prices"','id="page-access"','id="page-agent-settlements"','id="page-claims"','id="page-market-news"','portal-admin-shell-fast-v1.js','clients-agents-current-ui'])assert(shell.includes(marker),`Current Admin shell missing ${marker}`);
for(const marker of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','admin_externalized','BOOT_ERROR_LATCH_FINAL_CANDIDATE'])assert(!shell.includes(marker),`Legacy Admin marker returned: ${marker}`);
assert(shell.includes('grid-template-columns:272px minmax(0,1fr)'),'Canonical Home-scale sidebar must be owned by the current shell');
assert(shell.includes('min-height:48px')&&shell.includes('font-size:14.5px'),'Canonical navigation sizing missing');
assert(shell.includes('data-action="create-access">Создать доступ</button>'),'Current shell must expose primary access action before module mount');
assert(shell.includes("sessionStorage.setItem('rona.admin.currentPage',page)"),'Current shell must preserve explicit navigation');
assert(shell.includes('new MutationObserver(scheduleGuard)'),'Current shell must guard against late navigation resets');
assert(shell.length<60000,'Current Admin shell must remain structural, not a bundled legacy cabinet');

assert(build.includes("path: 'portal-src/current/admin.html'"),'Build must source Admin from current shell');
assert(build.includes('CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS'),'Build integrity must declare current-only Admin and Client architecture');
assert(build.includes('legacy_runtime_in_deployment:false'),'Build integrity must fail closed on legacy deployment');
assert(build.includes('current-only-router-v2'),'Build must reject a shell without authoritative current router');

assert(runtime.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'Single-owner runtime marker missing');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='CHECKING'"),'Async session state missing');
assert(runtime.includes("if(r.status===401||r.status===403)"),'Only explicit auth denial may redirect');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='DEGRADED_BACKEND'"),'Transient backend degradation state missing');
for(const required of ['/portal/main-ui','/portal/claims-r2-ui','/portal/remaining-sections-ui','/portal/prices-current-ui','/portal/analytics-v2-ui','/portal/rail-current-v81-maplibre-ui','/portal/rail-safe-fallback-ui'])assert(runtime.includes(required),`Required current module missing: ${required}`);
for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','owner-layout-polish-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])assert(!runtime.includes(forbidden),`Competing Admin module returned: ${forbidden}`);
assert(runtime.includes('async function loadRail()')&&runtime.includes("root.dataset.ronaRailOwner='safe-fallback-direct-child-v2'")&&runtime.includes("window.__RONA_RAIL_CURRENT_REPAIR__"),'Rail primary/repair/fallback recovery missing');
assert(runtime.includes('async function loadAnalytics()')&&runtime.includes("root.dataset.ronaAnalyticsOwner='analytics-v2'"),'Dedicated Analytics owner missing');
assert(!runtime.includes("['agent-settlements','messages','analytics','market-news'].includes(p)"),'Analytics/News must not be routed back to Remaining owner');
assert(!runtime.includes('enforceOwners')&&!runtime.includes('installOwnerGuards'),'Fast shell must not own page DOM');

assert(watchdog.includes("window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v10-radio-payments-heading'"),'Current page-aware watchdog marker missing');
assert(watchdog.includes("state=window.__RONA_ADMIN_RUNTIME_RECOVERY__={version:'page-aware-v10-radio-payments-heading'"),'Current watchdog recovery-state version missing');
assert(watchdog.includes("n.querySelector(':scope > .rona-owner-page-content')"),'Home finalized owner content check missing');
assert(watchdog.includes("n.querySelector(':scope > .current-loading:not(.rona-owner-original-hidden)')"),'Hidden fallback-safe Home loading check missing');
assert(watchdog.includes("if(p==='analytics')return !!n.querySelector('#rona-analytics-v2 .an2-head')&&!!n.querySelector('#rona-analytics-v2 .an2-controls')&&!!n.querySelector('#rona-analytics-v2 .an2-main')"),'Analytics rendered readiness check missing');
assert(watchdog.includes("if(p==='monitoring')return'rail'")&&watchdog.includes("if(p==='analytics')return'analytics'")&&watchdog.includes("if(p==='market-news')return'market-news-current'"),'Current recovery mappings missing');
for(const marker of ["root.querySelector(':scope > .mn-masthead')","root.querySelector(':scope > .mn-toolbar')","root.querySelector(':scope > .mn-statusline')","root.querySelector(':scope > main')","activateMarketNews('watchdog-content-repair')"])assert(watchdog.includes(marker),`Market News content-health recovery missing: ${marker}`);
assert(!watchdog.includes('location.reload(')&&!watchdog.includes('location.replace('),'Watchdog must never navigate/reload during UI recovery');

assert(workerShell.includes('CURRENT_RUNTIME_NOT_READY_WITHOUT_TEARDOWN'),'Worker shell failsafe does not embed the stable Access loader');
assert(workerShell.includes("const accessReady=()=>window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!accessHost()"),'Worker shell failsafe embeds stale Access readiness');
assert(!workerShell.includes('window.__RONA_CLIENTS_AGENTS_CURRENT__=null'),'Worker shell failsafe embeds destructive Access teardown');
assert(workerWatchdog.includes("if(p==='access')return window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!n.querySelector(':scope > #rona-ca4')"),'Worker watchdog failsafe embeds stale Access readiness');
assert(workerWatchdog.includes("'x-rona-admin-worker-runtime':'watchdog-stability-v3'"),'Worker watchdog delivery marker missing');
assert(workerShell.includes("'x-rona-admin-worker-runtime':'shell-stability-v3'"),'Worker shell delivery marker missing');
assert(workerAccess.trim()==="export { onRequest } from './portal/clients-agents-current-ui.js';",'Worker Access failsafe must alias the current Access authority exactly');

assert(remaining.includes("window.__RONA_MARKET_NEWS_OWNER_GUARD_V6__='20260827-content-health-v6'"),'No-store Market News owner guard v6 missing');
assert(remaining.includes("if(!healthy(root))emitRepair('market-news-owner-guard-v6-content-repair')"),'Market News empty-root repair missing');
assert(remaining.includes("headers.set('x-rona-market-news-owner','dedicated-current-content-health-v6')"),'Market News no-store owner header missing');

assert(railSafe.includes("window.__RONA_RAIL_SAFE_FALLBACK__='20260918-direct-child-v2'"),'Rail safe fallback marker missing');
assert(railSafe.includes("window.__RONA_OWNER_ADMIN_SNAPSHOT__"),'Rail fallback must use the authoritative Admin snapshot');
assert(railSafe.includes("data-rail-current-root")&&railSafe.includes("ready"),'Rail fallback current-root readiness marker missing');
assert(railSafe.includes("Подтверждённые ГУ-12 отсутствуют.")&&railSafe.includes("движение вагонов не моделируется"),'Rail fallback must fail closed without fabricated movement data');
assert(!railSafe.includes('const WATCH_FROM=')&&!railSafe.includes("baseRail(context)"),'Rail fallback must no longer depend on superseded legacy source transforms');

assert(access.includes("window.__RONA_CLIENTS_AGENTS_CURRENT__='20260828-single-owner-v5'"),'Current Clients/Agents owner missing');
assert(access.includes("const OWNER_API='/portal/owner-api',AUTH='/portal/admin-authority'"),'Current access UI must use current server APIs');
assert(access.includes("new Option('Клиент','Клиент'),new Option('Агент','Агент')"),'Client/Agent creation modes missing');
assert(access.includes("dataset.ronaCreateAccess='primary'")&&access.includes("setPasswordFor")&&access.includes("'Сменить пароль'"),'Access management controls missing');
assert(access.includes("['history','История и права']"),'Access history/rights view missing');
assert(access.includes("const clientContract=kind===''||kind==='CLIENT_CONTRACT'"),'Agent bindings must not enter Client contract mutation path');
assert(!access.includes('installShellParity')&&!access.includes('installNavigationStability'),'Page module must not mutate global shell/navigation');
assert(access.includes("'x-rona-shell-mutation':'none'"),'Page-scoped shell mutation contract missing');

assert(analytics.includes("import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js'"),'Approved Analytics source wrapper missing');
assert(analytics.includes("const CANONICAL_ANALYTICS_SOURCE='RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html'"),'Canonical v4.3.2 source provenance missing');
assert(analytics.includes("const CANONICAL_ANALYTICS_MARKER='approved-v4.3.2-pricing-bridge-single-owner'"),'Canonical v4.3.2 runtime marker missing');
assert(analytics.includes("headers.set('x-rona-analytics-owner','approved-v432-exclusive')"),'Canonical Analytics owner header missing');
assert(analytics.includes("headers.set('x-rona-analytics-visual','approved-hero-v432-pricing-bridge')"),'Canonical Analytics visual header missing');
assert(analytics.includes('approved-data-contract: AI95 first=1075.25 last=1226.75; differential=AI92+40 USD/t'),'Approved gasoline differential contract missing');
assert(!analytics.includes('ROOT_TO')&&!analytics.includes('BIND_TO')&&!analytics.includes('home-canonical-frames-title-v1'),'Obsolete Analytics transform returned');
assert(analytics.includes("for(const stale of ['rona-analytics-canonical-title'"),'Canonical Analytics stale-owner guard missing');
assert(analyticsBase.includes("'x-rona-analytics-ui':'approved-v4.3.1-single-owner'")&&analyticsBase.includes("'x-rona-analytics-owner':'approved-v431-exclusive'")&&analyticsBase.includes("'x-rona-analytics-visual':'approved-hero-v431'")&&analyticsBase.includes("'x-rona-analytics-chart':'designer-v3-shared-gasoline-axis'"),'Frozen approved Analytics base headers missing');

console.log('Admin current-only single-owner resilience QA: PASS');
