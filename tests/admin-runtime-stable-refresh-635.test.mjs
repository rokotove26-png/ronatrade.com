import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as adminMainUi } from '../functions/portal/admin-main-ui-current.js';
import { onRequest as serveMainUi } from '../functions/portal/main-ui/index.js';
import { onRequest as enforceMainUi } from '../functions/portal/main-ui/_middleware.js';
import { onRequest as cashR2Ui } from '../functions/portal/cash-r2-ui.js';
import { onRequest as shellUi } from '../functions/portal/admin-approved-shell-v455-ui.js';

const adminRaw=await (await adminMainUi()).text();
const cash=await (await cashR2Ui()).text();
const shell=await (await shellUi()).text();
const adminResponse=await enforceMainUi({request:new Request('https://ronaoil.com/portal/main-ui?issue635=qa'),next:()=>serveMainUi({})});
const admin=await adminResponse.text();
assert.equal(adminResponse.status,200,admin.slice(0,240));

test('Issue 635 removes unconditional Admin repaint and body-wide render observer',()=>{
  new Function(adminRaw);
  assert.ok(adminRaw.includes("window.__RONA_OWNER_ADMIN_AUTO_REFRESH__='authority-change-only-v2'"));
  assert.ok(adminRaw.includes("window.__RONA_OWNER_AI_SYNC_POLL_MS__=60000"));
  assert.ok(adminRaw.includes("setInterval(()=>refreshAdmin(false),60000)"));
  assert.ok(adminRaw.includes("ownerAdminSnapshotSignature"));
  assert.ok(adminRaw.includes("ownerAiStableSignature"));
  assert.doesNotMatch(adminRaw,/setInterval\(\(\)=>ownerAdminRefreshTick\(false\),30000\)/);
  assert.doesNotMatch(adminRaw,/new MutationObserver\(renderAdmin\)/);
});

test('Admin bootstrap and AI sync mutate active UI only when stable source signature changes',()=>{
  assert.ok(adminRaw.includes("changed=!!force||!previousSignature||nextSignature!==previousSignature"));
  assert.ok(adminRaw.includes("if(changed&&ownerAdminRefreshSafe())ownerAdminRenderCurrent()"));
  assert.ok(adminRaw.includes("adminChanged=!!initial||!previousSignature||nextSignature!==previousSignature"));
  assert.ok(adminRaw.includes("financeChanged=!!initial||!previousFinanceSignature||nextFinanceSignature!==previousFinanceSignature"));
  assert.ok(adminRaw.includes("if(adminChanged)renderAdmin()"));
  assert.ok(adminRaw.includes("if(financeChanged)window.dispatchEvent(new CustomEvent('rona:finance-sync'"));
  assert.ok(adminRaw.includes("if(k==='generatedAt'||k==='generated_at')continue"));
});

test('Cash R2 is the sole emitted accounting owner after middleware',()=>{
  new Function(admin);
  assert.ok(admin.includes("window.__RONA_CASH_RUNTIME_OWNER__='cash-r2-exclusive-v1'"));
  assert.ok(admin.includes('accounting:ensureCashR2Host,'));
  assert.ok(admin.includes("data-rona-cash-host"));
  assert.doesNotMatch(admin,/function renderCash\(\)/);
  assert.doesNotMatch(admin,/accounting:renderCash,/);
  assert.doesNotMatch(admin,/renderPayments\(\);renderCash\(\)/);
});

test('Cash background refresh is 60s max, signature-gated, and keeps current DOM visible',()=>{
  new Function(cash);
  assert.ok(cash.includes('var CHECK_MS=60000'));
  assert.ok(cash.includes("mode:'SOURCE_SIGNATURE_CHANGE_ONLY_TRANSIENT_RECOVERY'"));
  assert.ok(cash.includes("if(current&&currentSignature&&signature===currentSignature){clearInitialRetryTimer();clearDegraded();"));
  assert.ok(cash.includes("if(!current&&!background)renderLoading()"));
  assert.ok(cash.includes("if(!current){if(transient){scheduleInitialRetry"));
  assert.ok(cash.includes("setInterval(function(){checkCurrent('fallback-poll',false)},CHECK_MS)"));
  assert.ok(cash.includes("window.addEventListener('rona:finance-sync'"));
  assert.ok(cash.includes("if(ev&&ev.detail&&ev.detail.changed===false)return"));
  assert.ok(cash.includes("host.replaceChildren(wrap);clearInitialRetryTimer();currentSignature=signature||payloadSignature(p);"));
  const loadStart=cash.indexOf('async function load(from,to,options)');
  const loadEnd=cash.indexOf('function initialLoad()',loadStart);
  const loadBody=cash.slice(loadStart,loadEnd);
  assert.equal((loadBody.match(/renderLoading\(\)/g)||[]).length,1);
  assert.ok(loadBody.includes("setDegraded(transient?'Временная задержка Finance. Последние подтверждённые данные сохранены.'"));
  assert.ok(loadBody.indexOf('await requestProjection')>loadBody.indexOf('renderLoading()'));
  assert.ok(loadBody.indexOf('renderPayload(p,signature,reason)')>loadBody.indexOf('payloadSignature(p)'));
});

test('Cash initial transient failures auto-retry with bounded backoff and one healthy poll timer',()=>{
  assert.ok(cash.includes('INITIAL_RETRY_DELAYS=[2000,5000,15000,30000]'));
  assert.ok(cash.includes('REQUEST_TIMEOUT_MS=20000'));
  assert.ok(cash.includes('function isTransientError(e)'));
  assert.ok(cash.includes('statement timeout|canceling statement'));
  assert.ok(cash.includes("msg.textContent='Временная задержка Finance, повторяем...'"));
  assert.ok(cash.includes('function scheduleInitialRetry(from,to,retryAttempt,reason,message)'));
  assert.ok(cash.includes('if(retryAttempt>=INITIAL_RETRY_DELAYS.length)'));
  assert.ok(cash.includes("window.__RONA_CASH_R2_POLL_TIMER__"));
  assert.ok(cash.includes('runtime.pollTimerCount=1'));
  assert.ok(cash.includes("ownerSignature===lastOwnerFinanceSignature"));
  assert.ok(cash.includes('runtime.versionUnchangedCount++'));
  assert.ok(cash.includes("if(current||initialRetryTimer||(window.__RONA_CASH_R2_STATE__&&window.__RONA_CASH_R2_STATE__.status==='RETRYING'))return"));
});

test('Cash keeps a valid payload visible on transient background failure',()=>{
  assert.ok(cash.includes('function setDegraded(message)'));
  assert.ok(cash.includes('function clearDegraded()'));
  assert.ok(cash.includes("status:'READY',degraded:true"));
  assert.ok(cash.includes("Последние подтверждённые данные сохранены"));
  assert.ok(cash.includes("if(current&&currentSignature&&signature===currentSignature){clearInitialRetryTimer();clearDegraded();"));
  assert.ok(cash.includes("if(!current){if(transient){scheduleInitialRetry"));
  assert.ok(cash.includes("setDegraded(transient?'Временная задержка Finance. Последние подтверждённые данные сохранены.'"));
});

test('canonical Admin background remains a session-level static shell concern',()=>{
  new Function(shell);
  assert.ok(shell.includes('body.admin-auth-server-verified{background-image:url("/assets/portal-canonical/background.png")!important'));
  assert.ok(shell.includes('background-attachment:fixed!important'));
  assert.doesNotMatch(cash,/admin-auth-server-verified/);
});
