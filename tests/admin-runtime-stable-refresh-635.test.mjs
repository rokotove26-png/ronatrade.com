import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as adminMainUi } from '../functions/portal/admin-main-ui-current.js';
import { onRequest as currentMainUi } from '../functions/portal/main-ui/index.js';
import { onRequest as cashR2Ui } from '../functions/portal/cash-r2-ui.js';
import { onRequest as shellUi } from '../functions/portal/admin-approved-shell-v455-ui.js';
import { __test as mainUiMiddleware } from '../functions/portal/main-ui/_middleware.js';

const adminRaw=await (await adminMainUi()).text();
const mainUi=await (await currentMainUi({})).text();
const cash=await (await cashR2Ui()).text();
const shell=await (await shellUi()).text();
const admin=mainUiMiddleware.patchCashSingleOwner(mainUiMiddleware.patchPaymentsCurrentSemantics(mainUi));

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
  assert.ok(cash.includes("mode:'SOURCE_SIGNATURE_CHANGE_ONLY'"));
  assert.ok(cash.includes("if(current&&currentSignature&&signature===currentSignature){runtime.unchangedCount++"));
  assert.ok(cash.includes("if(!current&&!background)renderLoading()"));
  assert.ok(cash.includes("if(!current)renderError("));
  assert.ok(cash.includes("setInterval(function(){checkCurrent('fallback-poll',false)},CHECK_MS)"));
  assert.ok(cash.includes("window.addEventListener('rona:finance-sync'"));
  assert.ok(cash.includes("if(ev&&ev.detail&&ev.detail.changed===false)return"));
  assert.ok(cash.includes("host.replaceChildren(wrap);currentSignature=signature||payloadSignature(p);runtime.applyCount++"));
  const loadStart=cash.indexOf('async function load(from,to,options)');
  const loadEnd=cash.indexOf('function initialLoad()',loadStart);
  const loadBody=cash.slice(loadStart,loadEnd);
  assert.equal((loadBody.match(/renderLoading\(\)/g)||[]).length,1);
  assert.ok(loadBody.indexOf('await requestProjection')>loadBody.indexOf('renderLoading()'));
  assert.ok(loadBody.indexOf('renderPayload(p,signature,reason)')>loadBody.indexOf('payloadSignature(p)'));
});

test('canonical Admin background remains a session-level static shell concern',()=>{
  new Function(shell);
  assert.ok(shell.includes('body.admin-auth-server-verified{background-image:url("/assets/portal-canonical/background.png")!important'));
  assert.ok(shell.includes('background-attachment:fixed!important'));
  assert.doesNotMatch(cash,/admin-auth-server-verified/);
});
