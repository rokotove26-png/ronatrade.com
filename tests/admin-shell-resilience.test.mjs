import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync('functions/portal/admin.js','utf8');
const middleware=fs.readFileSync('functions/portal/_middleware.js','utf8');
const runtime=fs.readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
const watchdog=fs.readFileSync('assets/portal-admin-runtime-watchdog-v1.js','utf8');
const build=fs.readFileSync('scripts/build-pages-direct-canonical.mjs','utf8');
const shell=fs.readFileSync('portal-src/current/admin.html','utf8');
const access=fs.readFileSync('functions/portal/clients-agents-current-ui.js','utf8');

assert(admin.includes('ASSETS?.fetch'),'Admin route must serve the static current shell through the asset binding');
assert(admin.includes("u.pathname='/portal/admin';"),'Cloudflare Static Assets must receive the Admin pretty pathname');
assert(!admin.includes("u.pathname='/portal/admin.html';"),'Direct .html Static Assets path must not return to Admin route');
assert(admin.includes("'x-rona-admin-shell','current-only-v2'"),'Current-only Admin shell v2 header missing');
assert(admin.includes("'x-rona-admin-auth','server-verified-v1'"),'Server-authenticated Admin marker missing');
assert(admin.includes("'x-rona-admin-current-only','main-v2-shell-v2'"),'Current-only v2 lifecycle header missing');
assert(!admin.includes('HTMLRewriter'),'Admin entry must not transform or buffer a legacy HTML substrate');
assert(!admin.includes('adminLoginGate')&&!admin.includes('rona-admin-auth-v3413'),'Legacy auth must not exist in Admin route');
assert(admin.includes('async function sessionProbe(accessToken)'),'Admin entry route must verify the server session');
assert(admin.includes(`${'${PORTAL_API}'}/session/me`),'Admin entry route must verify /session/me before serving the shell');
assert(admin.includes('async function ensureSession(request)'),'Admin entry route must support authenticated refresh/retry');
assert(admin.includes("if(!rolesOf(session.me).includes('ADMIN'))"),'Admin role must be verified server-side');
assert(admin.includes("if(session?.unavailable)return recoveryPage(request,session.setCookies)"),'Transient auth failures must preserve the session');
assert(admin.includes("if(!session)return loginRedirect(request,clearCookies())"),'Invalid sessions must return to canonical login');

assert(middleware.includes("if(url.pathname==='/portal/admin')return context.next();"),'Portal middleware must bypass Admin HTML');
const bypass=middleware.indexOf("if(url.pathname==='/portal/admin')return context.next();"),text=middleware.indexOf('response.text()');
assert(text<0||bypass<text,'Admin must bypass response buffering');

for(const marker of ['rona-admin-shell" content="current-only-v2','data-rona-admin-shell="current-only-v2','current-only-router-v2','id="nav"','id="page-home"','id="page-prices"','id="page-access"','id="page-agent-settlements"','id="page-claims"','portal-admin-shell-fast-v1.js','clients-agents-current-ui'])assert(shell.includes(marker),`Current Admin shell missing ${marker}`);
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
for(const required of ['/portal/main-ui','/portal/claims-r2-ui','/portal/remaining-sections-current-ui','/portal/analytics-v2-ui','/portal/prices-standard-list-current-ui','/portal/access-create-parity-ui','/portal/rail-current-v81-maplibre-ui'])assert(runtime.includes(required),`Required current module missing: ${required}`);
assert(!runtime.includes("['agent-settlements','messages','analytics','market-news']"),'Generic Remaining must not own Analytics');
for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','owner-layout-polish-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])assert(!runtime.includes(forbidden),`Competing Admin module returned: ${forbidden}`);
assert(!runtime.includes('enforceOwners')&&!runtime.includes('installOwnerGuards'),'Fast shell must not own page DOM');
assert(watchdog.includes("window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v2'"),'Page-aware watchdog missing');
assert(!watchdog.includes('location.reload(')&&!watchdog.includes('location.replace('),'Watchdog must never navigate/reload during UI recovery');

assert(access.includes("window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v3'"),'Current Clients/Agents owner missing');
assert(access.includes("const OWNER_API='/portal/owner-api',AUTH='/portal/admin-authority'"),'Current access UI must use current server APIs');
assert(access.includes("new Option('Клиент','Клиент'),new Option('Агент','Агент')"),'Client/Agent creation modes missing');
assert(access.includes("dataset.ronaCreateAccess='primary'"),'Primary create-access action missing');
assert(!access.includes('installShellParity')&&!access.includes('installNavigationStability'),'Page module must not mutate global shell/navigation');
assert(access.includes("'x-rona-shell-mutation':'none'"),'Page-scoped shell mutation contract missing');

console.log('Admin current-only single-owner resilience QA: PASS');