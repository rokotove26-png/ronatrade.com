import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const origin=process.env.TARGET_ORIGIN;
if(!/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i.test(origin||''))throw new Error('IMMUTABLE_PREVIEW_REQUIRED');
const out='artifacts/admin-payments-accounting-currency-progress-v6';fs.mkdirSync(out,{recursive:true});
const adminBootstrap={ok:true,data:{applications:[],deals:[],rail:[],clients:[],counterparties:[],payments:[],tasks:[],documents:[],users:[],operationalConflicts:[],financeFragment:{}}};
function makeFinanceFragment({gazTotal=31002300,gazExpected=9300690,gazFuture=21701610}={}){
  const control=[
    {deal_id:'DEAL-2026-004',client_name:'FARGONA GAZ TULDIRISH STANTSIYASI',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:236250,verified_received_amount:236250,expected_amount:0,due_now_amount:0,deferred_not_due_amount:0,remaining_obligation_amount:0,projection_status:'AUTHORITATIVE',payment_progress_pct:100},
    {deal_id:'DEAL-2026-005',client_name:'NIK OIL',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:672500,verified_received_amount:201750,expected_amount:470750,due_now_amount:0,deferred_not_due_amount:470750,remaining_obligation_amount:470750,projection_status:'AUTHORITATIVE',payment_progress_pct:30},
    {deal_id:'DEAL-2026-006',client_name:'Client 006',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:164400,verified_received_amount:49320,expected_amount:115080,due_now_amount:0,deferred_not_due_amount:115080,remaining_obligation_amount:115080,projection_status:'AUTHORITATIVE',payment_progress_pct:30},
    {deal_id:'DEAL-2026-009',client_name:'ОсОО «ГазОнэ»',accounting_currency:'RUB',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:gazTotal,verified_received_amount:0,expected_amount:gazExpected,due_now_amount:0,deferred_not_due_amount:gazFuture,remaining_obligation_amount:gazTotal,projection_status:'TO_VERIFY',payment_progress_pct:0}
  ];
  const passports=control.map(r=>({...r,actual_spend_amount:r.deal_id==='DEAL-2026-004'?150000:0,actual_spend_status:'AUTHORITATIVE',converted_execution_pending_amount:0,remaining_unexecuted_amount:Math.max(0,r.verified_received_amount-(r.deal_id==='DEAL-2026-004'?150000:0)),spend_details:[]}));
  return{
    ownerPaymentSemanticsContract:'ADMIN_PAYMENTS_DEAL_ACCOUNTING_CURRENCY_PROGRESS_V6',
    ownerFinanceCanon:{record_id:'eabba23f-70b9-4d40-86ef-3d0578c71d4a',status:'AUTHORITATIVE',version:23},
    paymentContourDealIds:control.map(x=>x.deal_id),dealPaymentControlRows:control,dealPaymentPassports:passports,
    totalToReceiveTotalsByCurrency:[{currency:'RUB',amount:gazTotal},{currency:'USD',amount:1073150}],
    verifiedReceivedTotalsByCurrency:[{currency:'RUB',amount:0},{currency:'USD',amount:487320}],
    expectedReceiptTotalsByCurrency:[{currency:'RUB',amount:gazExpected},{currency:'USD',amount:585830}],
    dueNowTotalsByCurrency:[{currency:'RUB',amount:0},{currency:'USD',amount:0}],
    deferredNotDueTotalsByCurrency:[{currency:'RUB',amount:gazFuture},{currency:'USD',amount:585830}],
    remainingToReceiveTotalsByCurrency:[{currency:'RUB',amount:gazTotal},{currency:'USD',amount:585830}],
    dealActualSpendTotalsByAccountingCurrency:[{currency:'USD',amount:150000}],
    unallocatedPaymentRows:[
      {payment_id:'PAYEV-2026-000008',payment_at:'2026-09-12T10:00:00Z',direction:'OUTGOING',kind:'COUNTERPARTY_PAYMENT',amount:3644000,currency:'RUB',allocated_total:0,unallocated_residue:3644000,counterparty_name:'КУЗМАШ'},
      {payment_id:'PAYEV-2026-000010',payment_at:'2026-09-13T01:00:00Z',direction:'INCOMING',kind:'CLIENT_PAYMENT',amount:100000,currency:'USD',allocated_total:20000,unallocated_residue:80000,counterparty_name:'Test client'}
    ]
  };
}
let activeFinanceFragment=makeFinanceFragment();
function pass(name,cond){if(!cond)throw new Error(name+'=FAIL');console.log(name+'=PASS')}
const compact=s=>String(s||'').replace(/[\s\u00a0\u202f]/g,'');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-rona-v6-real-preview-qa':'exact-head-v6-r2'}});
const page=await context.newPage();
const pageErrors=[],consoleErrors=[],ownerPosts=[],financeRequests=[];
page.on('pageerror',err=>pageErrors.push(String(err?.stack||err?.message||err)));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
page.on('request',req=>{
  if(req.url().includes('/portal/owner-payment-authority-v5/'))ownerPosts.push({url:req.url(),body:req.postData()||''});
  if(req.url().includes('/portal/owner-payments-accounting-currency-progress-v6-source'))financeRequests.push(req.url());
});

await page.route('**/portal/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.resourceType()==='document')return route.continue();
  if(url.pathname==='/portal/owner-payments-accounting-currency-progress-v6-source')return route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store','x-qa-fixture':'finance-v23-structured'},body:JSON.stringify({ok:true,data:{financeFragment:activeFinanceFragment}})});
  if(url.pathname==='/portal/admin-completed-bootstrap')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminBootstrap)});
  if(url.pathname==='/portal/api/session/me')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,user:{roles:['ADMIN']}})});
  if(url.pathname.startsWith('/portal/owner-payment-authority-v5/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{accepted:true}})});
  if(req.resourceType()==='fetch'||req.resourceType()==='xhr')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{}})});
  return route.continue();
});

const mainUiResponsePromise=page.waitForResponse(response=>{try{return new URL(response.url()).pathname==='/portal/main-ui'}catch{return false}},{timeout:60000});
const documentResponse=await page.goto(origin+'/portal/admin-payments-v6-real-preview-qa',{waitUntil:'domcontentloaded',timeout:60000});
console.log('REAL_PREVIEW_DOCUMENT_STATUS='+(documentResponse?.status()??'none'));
console.log('REAL_PREVIEW_DOCUMENT_URL_ACTUAL='+page.url());
pass('REAL_PREVIEW_DOCUMENT_200',!!documentResponse&&documentResponse.ok());
pass('REAL_PREVIEW_DOCUMENT_URL',new URL(page.url()).pathname==='/portal/admin-payments-v6-real-preview-qa');
pass('REAL_PREVIEW_DEPLOYED_ADMIN_ASSET',String(documentResponse.headers()['x-rona-v6-real-preview-asset']||'')==='DEPLOYED_ADMIN_CURRENT');
const nav=page.locator('#nav button[data-page="payments"]');await nav.waitFor({state:'attached',timeout:15000});
pass('REAL_PREVIEW_DEPLOYED_ADMIN_DOM',await page.locator('#page-payments').count()===1&&await nav.count()===1);
const mainUiResponse=await mainUiResponsePromise;
pass('REAL_PREVIEW_MAIN_UI_200',mainUiResponse.ok());
pass('REAL_PREVIEW_MAIN_UI_HEADER',String(mainUiResponse.headers()['x-rona-admin-payment-owner-screen']||'')==='owner-semantics-v3');
pass('REAL_PREVIEW_MAIN_UI_ORIGIN',new URL(mainUiResponse.url()).origin===origin);
await page.waitForFunction(()=>window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__==='20260913-accounting-currency-progress-v6-r2',{timeout:20000});
pass('REAL_PREVIEW_DEPLOYED_V6_R2_RUNTIME',await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__==='20260913-accounting-currency-progress-v6-r2'));
await nav.click({force:true});
pass('REAL_PREVIEW_DEPLOYED_RENDER_HOOK',await page.evaluate(()=>typeof window.__RONA_OWNER_PAYMENTS_V6_RENDER__==='function'&&typeof window.__RONA_OWNER_PAYMENTS_V6_REFRESH__==='function'));
await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_RENDER__());
try{await page.waitForFunction(()=>window.__RONA_OWNER_PAYMENTS_V6_READY__===true,{timeout:15000})}catch(err){console.log('REAL_PREVIEW_READY_DIAG='+JSON.stringify({pageErrors,consoleErrors,financeRequests,currentState:await page.evaluate(()=>window.__RONA_PAYMENTS_CURRENT_STATE__||null),paymentsText:(await page.locator('#page-payments').innerText().catch(()=>'' )).slice(0,1500)}));throw err}
await page.locator('#page-payments .rona-pay-v6-stack').waitFor({state:'visible',timeout:10000});

const summary=page.locator('[data-rona-summary-kpis="v6-r2"]'),cards=summary.locator('.rona-pay-v6-summary-card');
await summary.waitFor({state:'visible'});
pass('SUMMARY_KPI_DESKTOP_HORIZONTAL',await cards.count()===4);
const desktopRects=await cards.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}));
pass('SUMMARY_KPI_DESKTOP_FOUR_COLUMNS',new Set(desktopRects.map(r=>Math.round(r.y))).size===1&&new Set(desktopRects.map(r=>Math.round(r.x))).size===4);
pass('SUMMARY_KPI_EQUAL_CARD_HEIGHT',Math.max(...desktopRects.map(r=>r.h))-Math.min(...desktopRects.map(r=>r.h))<2);
const toReceiveCurrencies=await page.locator('[data-rona-summary-metric="to-receive"] [data-rona-summary-currency]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-rona-summary-currency')));
pass('SUMMARY_KPI_MULTI_CURRENCY_INSIDE_CARD',toReceiveCurrencies.includes('USD')&&toReceiveCurrencies.includes('RUB')&&toReceiveCurrencies.length===2);
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_R2_DESKTOP_TOP.png'),fullPage:false});

let text=await page.locator('#page-payments').innerText();
pass('DEAL_ACCOUNTING_CURRENCY_FOLLOWS_CLIENT_PAYMENT',text.includes('Валюта учета'));
for(const deal of ['DEAL-2026-004','DEAL-2026-005','DEAL-2026-006'])pass('DEAL_'+deal.slice(-3)+'_USD',(await page.locator('#page-payments tr',{hasText:deal}).first().innerText()).includes('USD'));
let gaz=await page.locator('#page-payments tr',{hasText:'DEAL-2026-009'}).first().innerText(),gazNorm=compact(gaz);
pass('DEAL_009_RUB',gaz.includes('RUB')&&gazNorm.includes('31002300')&&gazNorm.includes('9300690')&&gazNorm.includes('21701610'));
pass('GAZONE_NO_PARALLEL_USD_MANAGEMENT',!gaz.includes('USD')&&!gazNorm.includes('362600')&&!gazNorm.includes('108780')&&!gazNorm.includes('253820'));
const totalCard=compact(await page.locator('[data-rona-summary-metric="to-receive"]').innerText()),receivedCard=compact(await page.locator('[data-rona-summary-metric="received"]').innerText()),expectedCard=compact(await page.locator('[data-rona-summary-metric="expected"]').innerText());
pass('GLOBAL_TOTALS_GROUPED_BY_CURRENCY',totalCard.includes('31002300RUB')&&totalCard.includes('1073150USD')&&receivedCard.includes('0RUB')&&receivedCard.includes('487320USD')&&expectedCard.includes('9300690RUB')&&expectedCard.includes('585830USD'));
for(const [deal,pct] of [['DEAL-2026-004','100'],['DEAL-2026-005','30'],['DEAL-2026-006','30'],['DEAL-2026-009','0']]){const el=page.locator(`[data-rona-progress-deal="${deal}"]`);pass('PROGRESS_'+deal.replaceAll('-','_')+'_'+pct,await el.getAttribute('data-progress-pct')===pct)}
pass('PAYMENT_PROGRESS_VISUAL_ONLY',text.includes('Progress: VERIFIED_RECEIVED / TOTAL_TO_RECEIVE'));
pass('PROGRESS_FILL_VERIFIED_RECEIVED_ONLY',await page.locator('[data-rona-progress-deal="DEAL-2026-005"] .rona-pay-v6-progress-fill').evaluate(el=>el.style.width)==='30%');
pass('DEFERRED_UNFILLED_NEUTRAL',await page.locator('[data-rona-progress-deal="DEAL-2026-005"] .rona-pay-v6-progress').count()===1);
pass('NO_PROGRESS_TRANCHE_SEGMENTATION',await page.locator('.progress-segment').count()===0);
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_R2_DEALS_PROGRESS.png'),fullPage:true});

const runtimeBefore=await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__);
activeFinanceFragment=makeFinanceFragment({gazTotal:32000000,gazExpected:9600000,gazFuture:22400000});
await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_REFRESH__());
await page.waitForFunction(()=>document.querySelector('tr')&&document.body.innerText.replace(/[\s\u00a0\u202f]/g,'').includes('32000000'),{timeout:10000});
const changedGaz=compact(await page.locator('#page-payments tr',{hasText:'DEAL-2026-009'}).first().innerText());
const runtimeAfter=await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__);
pass('FINANCE_VALUE_CHANGE_REQUIRES_NO_CODE_CHANGE',changedGaz.includes('32000000')&&changedGaz.includes('9600000')&&changedGaz.includes('22400000')&&runtimeBefore===runtimeAfter);
activeFinanceFragment=makeFinanceFragment();
await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_REFRESH__());
await page.waitForFunction(()=>document.body.innerText.replace(/[\s\u00a0\u202f]/g,'').includes('31002300'),{timeout:10000});

await page.locator('[data-rona-v6-deal-open="DEAL-2026-009"]').first().click();
await page.locator('.rona-pay-v6-action-backdrop').waitFor({state:'visible'});
const modal=await page.locator('.rona-pay-v6-action-backdrop').innerText();
pass('GAZONE_RUB_PASSPORT',modal.includes('RUB')&&!modal.includes('USD'));
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_R2_GAZONE_RUB.png'),fullPage:true});
await page.locator('.rona-pay-v6-action-backdrop').getByRole('button',{name:'Закрыть'}).click();

await page.locator('[data-rona-v6-allocate="PAYEV-2026-000010"]').click();
await page.locator('.rona-pay-v6-action-backdrop').waitFor({state:'visible'});
await page.locator('.rona-pay-v6-modal-row select').selectOption('DEAL-2026-004');
await page.locator('.rona-pay-v6-modal-row input').fill('30000');
await page.locator('.rona-pay-v6-action-backdrop').getByRole('button',{name:'Добавить сделку'}).click();
const allocationRows=page.locator('.rona-pay-v6-modal-row');
await allocationRows.nth(1).locator('select').selectOption('DEAL-2026-005');
await allocationRows.nth(1).locator('input').fill('20000');
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_R2_OWNER_UNALLOCATED.png'),fullPage:true});
await page.locator('.rona-pay-v6-action-backdrop').getByRole('button',{name:'Подтвердить'}).click();
await page.waitForTimeout(350);
pass('OWNER_UNALLOCATED_PARTIAL_MULTI_DEAL_WORKFLOW',ownerPosts.some(x=>x.url.includes('/client-allocation')&&x.body.includes('DEAL-2026-004')&&x.body.includes('DEAL-2026-005')&&x.body.includes('30000')&&x.body.includes('20000')));
pass('PAYMENT_AMOUNT_IMMUTABLE',ownerPosts.every(x=>!x.body.includes('PAYMENT.amount')));

await page.setViewportSize({width:900,height:900});await page.waitForTimeout(100);
const mediumRects=await cards.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,h:r.height}}));
pass('SUMMARY_KPI_MEDIUM_2X2',Math.abs(mediumRects[0].y-mediumRects[1].y)<2&&Math.abs(mediumRects[2].y-mediumRects[3].y)<2&&mediumRects[2].y>mediumRects[0].y+20&&Math.abs(mediumRects[0].x-mediumRects[2].x)<2&&Math.abs(mediumRects[1].x-mediumRects[3].x)<2);
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_R2_MEDIUM_KPI.png'),fullPage:false});

await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
const mobileRects=await cards.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width}}));
pass('SUMMARY_KPI_MOBILE_SINGLE_COLUMN',mobileRects.every((r,i)=>i===0||(Math.abs(r.x-mobileRects[0].x)<2&&r.y>mobileRects[i-1].y+20)));
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_R2_MOBILE_KPI.png'),fullPage:false});

pass('REAL_PREVIEW_NO_PAGEERROR',pageErrors.length===0);
pass('REAL_PREVIEW_NO_CONSOLE_ERRORS',consoleErrors.length===0);
const proof={immutablePreview:origin,documentUrl:page.url(),head:process.env.EXPECTED_HEAD||null,documentStatus:documentResponse?.status()||null,deployedAdminAsset:documentResponse?.headers()?.['x-rona-v6-real-preview-asset']||null,mainUiUrl:mainUiResponse.url(),mainUiStatus:mainUiResponse.status(),mainUiHeader:mainUiResponse.headers()['x-rona-admin-payment-owner-screen']||null,v6Runtime:runtimeAfter,automationProof:{initialGazoneTotal:31002300,changedGazoneTotal:32000000,applicationRuntimeUnchanged:runtimeBefore===runtimeAfter},desktopRects,mediumRects,mobileRects,financeRequests,pageErrors,consoleErrors,ownerPosts};
fs.writeFileSync(path.join(out,'real-preview-browser-proof.json'),JSON.stringify(proof,null,2));
console.log('REAL_PREVIEW_BROWSER_ACCEPTANCE=PASS');
console.log('IMMUTABLE_PREVIEW='+origin);
console.log('REAL_PREVIEW_DOCUMENT='+page.url());
console.log('REAL_PREVIEW_MAIN_UI='+mainUiResponse.url());
await browser.close();
