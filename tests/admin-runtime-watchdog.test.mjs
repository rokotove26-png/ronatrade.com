import fs from 'node:fs';
import assert from 'node:assert/strict';

const shell=fs.readFileSync('portal-src/current/admin.html','utf8');
const watchdog=fs.readFileSync('assets/portal-admin-runtime-watchdog-v1.js','utf8');

assert(shell.includes('id="rona-admin-runtime-watchdog-loader"'),'Admin shell must load the runtime watchdog');
assert(shell.includes('/assets/portal-admin-runtime-watchdog-v1.js?v=20260826-self-heal-v1'),'Admin watchdog asset/version missing');

for(const marker of [
  "window.__RONA_ADMIN_RUNTIME_WATCHDOG__='current-only-recovery-v1'",
  "window.__RONA_MAIN_UI_RUNTIME_LOADED__===true",
  "window.__RONA_OWNER_ADMIN_READY__===true",
  "const prior=document.getElementById(id);",
  "if(prior)prior.remove();",
  "u.searchParams.set('_rona_recovery_attempt'",
  "sessionStorage.getItem(RELOAD_KEY)",
  "sessionStorage.setItem(RELOAD_KEY",
  "hardReloadOnce('MAIN_UI_NOT_READY')",
  "hardReloadOnce('OWNER_ADMIN_NOT_READY')",
  "hardReloadOnce('HOME_STATIC_PLACEHOLDER_STUCK')",
  "window.__RONA_ADMIN_RUNTIME_RECOVERY_READY__=true",
])assert(watchdog.includes(marker),`Admin runtime watchdog missing ${marker}`);

assert(watchdog.includes("const delays=[300,900,2200,4200]"),'Main UI recovery must use bounded retries');
assert(watchdog.includes("const delays=[250,800,1800]"),'Fast shell recovery must use bounded retries');
assert(watchdog.includes("if(last&&now-last<90000)"),'Automatic hard reload must be loop-protected');
assert(watchdog.includes("btn.textContent='Повторить загрузку'"),'Terminal recovery must leave an explicit user retry control');
assert(!watchdog.includes('setInterval(location.reload'),'Watchdog must not create an uncontrolled reload loop');

console.log('Admin runtime watchdog QA: PASS');
