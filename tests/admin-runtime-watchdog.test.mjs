import fs from 'node:fs';
import assert from 'node:assert/strict';

const shell=fs.readFileSync('portal-src/current/admin.html','utf8');
const watchdog=fs.readFileSync('assets/portal-admin-runtime-watchdog-v1.js','utf8');

assert(shell.includes('id="rona-admin-runtime-watchdog-loader"'),'Admin shell must load runtime watchdog');
assert(shell.includes('/assets/portal-admin-runtime-watchdog-v1.js?v=20260826-single-owner-1345'),'Admin watchdog single-owner asset/version missing');
assert(watchdog.includes("window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v3'"),'Page-aware recovery marker missing');
assert(watchdog.includes("if(p==='claims')return'claims'"),'Claims recovery mapping missing');
assert(watchdog.includes("if(p==='access')return'clients-agents-current'"),'Access recovery mapping missing');
assert(watchdog.includes("if(p==='monitoring')return'rail'"),'Rail recovery mapping missing');
assert(watchdog.includes("if(p==='analytics')return'analytics'"),'Analytics recovery mapping missing');
assert(watchdog.includes("if(['agent-settlements','messages','market-news'].includes(p))return'remaining'"),'Remaining-section recovery mapping missing');
assert(watchdog.includes("window.__RONA_ANALYTICS_V2_READY__===true"),'Analytics readiness marker missing');
assert(watchdog.includes("[data-rail-current-v4=\"ready\"],[data-rail-current-root]"),'Rail readiness root missing');
assert(watchdog.includes("window.dispatchEvent(new CustomEvent('rona:admin-module-retry'"),'In-place module retry event missing');
assert(watchdog.includes("btn.textContent='Повторить загрузку'"),'Explicit retry control missing');
assert(watchdog.includes('(state.pageAttempts[p]||0)>=3'),'Recovery must be bounded before terminal inline state');
assert(!watchdog.includes('location.reload('),'Watchdog must not hard reload');
assert(!watchdog.includes('location.replace('),'Watchdog must not navigate to another page');
assert(!watchdog.includes('hardReloadOnce'),'Legacy destructive recovery must be removed');
assert(!watchdog.includes('RELOAD_KEY'),'Reload-loop state must be removed');
console.log('Admin page-aware non-destructive watchdog QA: PASS');