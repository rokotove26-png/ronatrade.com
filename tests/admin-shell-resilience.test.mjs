import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync('functions/portal/admin.js','utf8');
const middleware=fs.readFileSync('functions/portal/_middleware.js','utf8');
const runtime=fs.readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');

assert(!admin.includes("from './[[path]].js'"),'Admin shell must not depend on catch-all session runtime');
assert(!admin.includes('supabase.co'),'Admin shell must not call Supabase directly');
assert(!admin.includes('/portal/api/session/me'),'Admin server route must not block on session probe');
assert(admin.includes('ASSETS?.fetch'),'Admin shell must serve the canonical static asset directly');
assert(admin.includes("u.pathname='/portal/admin';"),'Cloudflare Static Assets must receive the Admin pretty pathname');
assert(!admin.includes("u.pathname='/portal/admin.html';"),'Direct .html Static Assets path must not return to Admin shell');
assert(admin.includes("'x-rona-admin-shell','fast-static-v1'"),'Admin shell resilience header missing');
assert(admin.includes('hasPortalCookie(request)'),'Admin shell must retain a cookie-presence entry gate');

assert(middleware.includes("if(url.pathname==='/portal/admin')return context.next();"),'Portal middleware must bypass Admin HTML');
const adminBypassIndex=middleware.indexOf("if(url.pathname==='/portal/admin')return context.next();");
const responseTextIndex=middleware.indexOf('response.text()');
assert(responseTextIndex<0||adminBypassIndex<responseTextIndex,'Admin must bypass any response buffering');
assert(!middleware.includes('rona-admin-live-authority-adapter'),'Admin authority adapter must not be injected by HTML middleware');

assert(runtime.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='fast-static-v1'"),'Static resilience runtime marker missing');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='CHECKING'"),'Async session state missing');
assert(runtime.includes("if(r.status===401||r.status===403)"),'Only explicit authorization denial may redirect the Admin shell');
assert(runtime.includes("window.__RONA_ADMIN_SESSION_STATE__='DEGRADED_BACKEND'"),'Transient backend degradation state missing');
assert(runtime.includes("revealShell('backend-degraded')"),'Transient backend failure must preserve the shell');
assert(!runtime.includes("html:not(.rona-owner-paint-ready) body .app{opacity:0"),'Static runtime must never install the old first-paint blackout gate');
assert(!runtime.includes('setInterval(tick,100)'),'100 ms polling loop must not return');
assert(runtime.includes("'/portal/prices-current-ui?v=20260825-2055-centered-modal-v4'"),'Current Prices UI must remain loaded');
assert(runtime.includes("'/portal/admin-access-ui'"),'Admin access UI must remain loaded');
assert(runtime.includes("'/portal/clients-agents-v4-ui?v=20260824-2018-home-parity-v1'"),'Canonical Clients/Agents UI must remain loaded');
assert(runtime.includes("'/portal/analytics-v2-ui?v=20260824-v3-market-rona-lpg'"),'Canonical Analytics UI must remain loaded');

console.log('Admin shell resilience QA: PASS');
