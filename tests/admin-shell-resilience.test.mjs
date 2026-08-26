import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync('functions/portal/admin.js','utf8');
const middleware=fs.readFileSync('functions/portal/_middleware.js','utf8');
const runtime=fs.readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
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
assert(!admin.includes('adminLoginGate'),'Legacy autonomous login gate must not exist in Admin route');
assert(!admin.includes('rona-admin-auth-v3413'),'Legacy autonomous auth runtime must not exist in Admin route');
assert(!admin.includes('canonicalAdminAsset'),'Legacy canonical substrate adapter must not exist');

assert(admin.includes('async function sessionProbe(accessToken)'),'Admin entry route must verify the server session');
assert(admin.includes(`${'${PORTAL_API}'}/session/me`),'Admin entry route must verify /session/me before serving the shell');
assert(admin.includes('async function ensureSession(request)'),'Admin entry route must support authenticated refresh/retry');
assert(admin.includes("if(!rolesOf(session.me).includes('ADMIN'))"),'Admin role must be verified server-side');
assert(!admin.includes('hasPortalCookie(request)'),'Cookie presence alone must never authorize the Admin shell');
assert(admin.includes("if(session?.unavailable)return recoveryPage(request,session.setCookies)"),'Transient auth/backend failures must preserve the session and show recovery state');
assert(admin.includes("if(!session)return loginRedirect(request,clearCookies())"),'Invalid sessions must return to the canonical portal login');

assert(middleware.includes("if(url.pathname==='/portal/admin')return context.next();"),'Portal middleware must bypass Admin HTML');
const adminBypassIndex=middleware.indexOf("if(url.pathname==='/portal/admin')return context.next();");
const responseTextIndex=middleware.indexOf('response.text()');
assert(responseTextIndex<0||adminBypassIndex<responseTextIndex,'Admin must bypass any response buffering');

for(const marker of ['rona-admin-shell" content="current-only-v2','data-rona-admin-shell="current-only-v2','current-only-router-v2','id="nav"','id="page-home"','id="page-prices"','id="page-access"','id="page-agent-settlements"','id="page-claims"','portal-admin-shell-fast-v1.js','clients-agents-current-ui'])assert(shell.includes(marker),`Current Admin shell missing ${marker}`);
for(const marker of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','admin_externalized','v3.4.13','BOOT_ERROR_LATCH_FINAL_CANDIDATE'])assert(!shell.includes(marker),`Legacy Admin marker returned to current shell: ${marker}`);
assert(shell.includes('grid-template-columns:238px minmax(0,1fr)'),'Canonical-scale sidebar must be owned by the current shell');
assert(shell.includes('data-action="create-access">Создать доступ</button>'),'Current shell must expose the primary access action even before the access module finishes mounting');
assert(shell.includes("sessionStorage.setItem('rona.admin.currentPage',page)"),'Current shell must preserve explicit user navigation during late module boot');
assert(shell.includes('new MutationObserver(scheduleGuard)'),'Current shell must guard against late navigation resets');
assert(shell.length<60000,'Current Admin shell must remain a small structural shell, not a bundled legacy cabinet');

assert(build.includes("path: 'portal-src/current/admin.html'"),'Build must source Admin from current-only shell');
assert(build.includes('CURRENT_ONLY_ADMIN_SHELL_WITH_FROZEN_CANONICAL_ASSETS'),'Build integrity must declare current-only Admin architecture');
assert(build.includes("path: 'portal-src/canonical/canonical_background.png'"),'Build must use the frozen standalone background asset');
assert(build.includes("path: 'portal-src/canonical/canonical_logo.svg'"),'Build must use the frozen standalone logo asset');
assert(!build.includes("SOURCES.admin"),'Frozen legacy Admin source must not be part of deployment sources');
assert(!build.includes('const ADMIN_RUNTIME'),'Legacy externalized Admin runtime must not be a deployment input');
assert(build.includes('legacy_runtime_in_deployment:false'),'Build integrity must fail closed on legacy deployment');
assert(build.includes('current-only-router-v2'),'Build must reject a shell without the authoritative current router');

assert(runtime.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='fast-static-v1'"),'Static resilience runtime marker missing');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='CHECKING'"),'Async session state missing');
assert(runtime.includes("if(r.status===401||r.status===403)"),'Only explicit authorization denial may redirect the Admin shell client runtime');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='DEGRADED_BACKEND'"),'Transient backend degradation state missing');
assert(runtime.includes("'/portal/main-ui?v=20260824-0320'"),'Current main-v2 runtime must remain loaded');
assert(runtime.includes("'/portal/prices-current-ui?v=20260825-2055-centered-modal-v4'"),'Current Prices UI must remain loaded');
assert(runtime.includes("'/portal/analytics-v2-ui?v=20260824-v3-market-rona-lpg'"),'Canonical Analytics UI must remain loaded');

assert(access.includes("window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-current-only-v2'"),'Current Clients/Agents owner missing');
assert(access.includes("const AUTH='/portal/admin-authority'"),'Current access UI must use server authority directly');
assert(!access.includes('harvestLegacy'),'Current access UI must not harvest legacy DOM');
assert(!access.includes('window.openModal'),'Current access UI must not depend on legacy modal functions');
assert(access.includes("window.__RONA_CLIENTS_AGENTS_V4_READY__=true"),'Current access UI must preserve the established owner-ready contract');

console.log('Admin current-only v2 resilience QA: PASS');