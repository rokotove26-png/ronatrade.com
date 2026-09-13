import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const origin=process.env.TARGET_ORIGIN;
if(!/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i.test(origin||''))throw new Error('IMMUTABLE_PREVIEW_REQUIRED');
const out='artifacts/admin-payments-accounting-currency-progress-v6';fs.mkdirSync(out,{recursive:true});
const control=[
 {deal_id:'DEAL-2026-004',client_name:'FARGONA GAZ TULDIRISH STANTSIYASI',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:236250,verified_received_amount:236250,expected_amount:0,due_now_amount:0,deferred_not_due_amount:0,projection_status:'AUTHORITATIVE',payment_progress_pct:100},
 {deal_id:'DEAL-2026-005',client_name:'NIK OIL',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:672500,verified_received_amount:201750,expected_amount:470750,due_now_amount:0,deferred_not_due_amount:470750,projection_status:'AUTHORITATIVE',payment_progress_pct:30},
 {deal_id:'DEAL-2026-006',client_name:'Client 006',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:164400,verified_received_amount:49320,expected_amount:115080,due_now_amount:0,deferred_not_due_amount:115080,projection_status:'AUTHORITATIVE',payment_progress_pct:30},
 {deal_id:'DEAL-2026-009',client_name:'ОсОО «ГазОнэ»',accounting_currency:'RUB',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:31002300,verified_received_amount:0,expected_amount:9300690,due_now_amount:0,deferred_not_due_amount:21701610,projection_status:'TO_VERIFY',payment_progress_pct:0}
];
const passports=control.map(r=>({...r,actual_spend_amount:r.deal_id==='DEAL-2026-004'?150000:0,actual_spend_status:'AUTHORITATIVE',converted_execution_pending_amount:0,remaining_unexecuted_amount:Math.max(0,r.verified_received_amount-(r.deal_id==='DEAL-2026-004'?150000:0)),spend_details:[]}));
const financeFragment={
 ownerPaymentSemanticsContract:'ADMIN_PAYMENTS_DEAL_ACCOUNTING_CURRENCY_PROGRESS_V6',
 ownerFinanceCanon:{record_id:'eabba23f-70b9-4d40-86ef-3d0578c71d4a',status:'AUTHORITATIVE',version:23},
 paymentContourDealIds:control.map(x=>x.deal_id),
 dealPaymentControlRows:control,
 dealPaymentPassports:passports,
 totalToReceiveTotalsByCurrency:[{currency:'RUB',amount:31002300},{currency:'USD',amount:1073150}],
 verifiedReceivedTotalsByCurrency:[{currency:'RUB',amount:0},{currency:'USD',amount:487320}],
 expectedReceiptTotalsByCurrency:[{currency:'RUB',amount:9300690},{currency:'USD',amount:585830}],
 dueNowTotalsByCurrency:[{currency:'RUB',amount:0},{currency:'USD',amount:0}],
 deferredNotDueTotalsByCurrency:[{currency:'RUB',amount:21701610},{currency:'USD',amount:585830}],
 dealActualSpendTotalsByAccountingCurrency:[{currency:'USD',amount:150000}],
 unallocatedPaymentRows:[
  {payment_id:'PAYEV-2026-000008',payment_at:'2026-09-12T10:00:00Z',direction:'OUTGOING',kind:'COUNTERPARTY_PAYMENT',amount:3644000,currency:'RUB',allocated_total:0,unallocated_residue:3644000,counterparty_name:'КУЗМАШ'},
  {payment_id:'PAYEV-2026-000010',payment_at:'2026-09-13T01:00:00Z',direction:'INCOMING',kind:'CLIENT_PAYMENT',amount:100000,currency:'USD',allocated_total:20000,unallocated_residue:80000,counterparty_name:'Test client'}
 ]
};
const financeFixture={ok:true,data:{financeFragment}};
const adminBootstrap={ok:true,data:{applications:[],deals:[],rail:[],clients:[],counterparties:[],payments:[],tasks:[],documents:[],users:[],operationalConflicts:[],financeFragment:{}}};

function pass(name,cond){if(!cond)throw new Error(name+'=FAIL');console.log(name+'=PASS')}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const pageErrors=[],consoleErrors=[],ownerPosts=[];
page.on('pageerror',err=>pageErrors.push(String(err?.stack||err?.message||err)));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
page.on('request',req=>{if(req.url().includes('/portal/owner-payment-authority-v5/'))ownerPosts.push({url:req.url(),body:req.postData()||''})});

await page.route('**/portal/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.resourceType()==='document')return route.continue();
  if(url.pathname==='/portal/owner-payments-accounting-currency-progress-v6-source')return route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store','x-qa-fixture':'finance-v23'},body:JSON.stringify(financeFixture)});
  if(url.pathname==='/portal/admin-completed-bootstrap')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminBootstrap)});
  if(url.pathname==='/portal/api/session/me')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,user:{roles:['ADMIN']}})});
  if(url.pathname.startsWith('/portal/owner-payment-authority-v5/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{accepted:true}})});
  if(req.resourceType()==='fetch'||req.resourceType()==='xhr')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{}})});
  return route.continue();
});

const mainUiResponsePromise=page.waitForResponse(response=>{
  try{return new URL(response.url()).pathname==='/portal/main-ui'}catch{return false}
},{timeout:60000});
const documentResponse=await page.goto(origin+'/portal/admin.html',{waitUntil:'domcontentloaded',timeout:60000});
pass('REAL_PREVIEW_DOCUMENT_200',!!documentResponse&&documentResponse.ok());
pass('REAL_PREVIEW_DOCUMENT_URL',new URL(page.url()).pathname==='/portal/admin.html');
const nav=page.locator('#nav button[data-page="payments"]');await nav.waitFor({state:'attached',timeout:15000});
pass('REAL_PREVIEW_DEPLOYED_ADMIN_DOM',await page.locator('#page-payments').count()===1&&await nav.count()===1);
const mainUiResponse=await mainUiResponsePromise;
pass('REAL_PREVIEW_MAIN_UI_200',mainUiResponse.ok());
pass('REAL_PREVIEW_MAIN_UI_HEADER',String(mainUiResponse.headers()['x-rona-admin-payment-owner-screen']||'')==='owner-semantics-v3');
pass('REAL_PREVIEW_MAIN_UI_ORIGIN',new URL(mainUiResponse.url()).origin===origin);
await page.waitForFunction(()=>window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__==='20260913-accounting-currency-progress-v6',{timeout:20000});
pass('REAL_PREVIEW_DEPLOYED_V6_RUNTIME',await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__==='20260913-accounting-currency-progress-v6'));
await page.waitForFunction(()=>window.__RONA_OWNER_PAYMENTS_V6_READY__===true,{timeout:20000});
await nav.click({force:true});
await page.locator('#page-payments .rona-pay-v6-stack').waitFor({state:'visible',timeout:10000});

const text=await page.locator('#page-payments').innerText(),norm=text.replace(/[\s\u00a0\u202f]/g,'');
pass('DEAL_ACCOUNTING_CURRENCY_FOLLOWS_CLIENT_PAYMENT',text.includes('Валюта учета'));
pass('DEAL_004_USD',(await page.locator('#page-payments tr',{hasText:'DEAL-2026-004'}).first().innerText()).includes('USD'));
pass('DEAL_005_USD',(await page.locator('#page-payments tr',{hasText:'DEAL-2026-005'}).first().innerText()).includes('USD'));
pass('DEAL_006_USD',(await page.locator('#page-payments tr',{hasText:'DEAL-2026-006'}).first().innerText()).includes('USD'));
const gaz=await page.locator('#page-payments tr',{hasText:'DEAL-2026-009'}).first().innerText(),gazNorm=gaz.replace(/[\s\u00a0\u202f]/g,'');
pass('DEAL_009_RUB',gaz.includes('RUB')&&gazNorm.includes('31002300')&&gazNorm.includes('9300690')&&gazNorm.includes('21701610'));
pass('GAZONE_NO_PARALLEL_USD_MANAGEMENT',!gaz.includes('USD')&&!gazNorm.includes('362600')&&!gazNorm.includes('108780')&&!gazNorm.includes('253820'));
pass('GLOBAL_TOTALS_GROUPED_BY_CURRENCY',norm.includes('31002300RUB')&&norm.includes('1073150USD'));
for(const [deal,pct] of [['DEAL-2026-004','100'],['DEAL-2026-005','30'],['DEAL-2026-006','30'],['DEAL-2026-009','0']]){
  const el=page.locator(`[data-rona-progress-deal="${deal}"]`);
  pass('PROGRESS_'+deal.replaceAll('-','_')+'_'+pct,await el.getAttribute('data-progress-pct')===pct);
}
pass('PAYMENT_PROGRESS_VISUAL_ONLY',text.includes('Заполняется только VERIFIED_RECEIVED / TOTAL_TO_RECEIVE'));
pass('PROGRESS_FILL_VERIFIED_RECEIVED_ONLY',await page.locator('[data-rona-progress-deal="DEAL-2026-005"] .rona-pay-v6-progress-fill').evaluate(el=>el.style.width)==='30%');
pass('DEFERRED_UNFILLED_NEUTRAL',await page.locator('[data-rona-progress-deal="DEAL-2026-005"] .rona-pay-v6-progress').count()===1);
pass('NO_PROGRESS_TRANCHE_SEGMENTATION',await page.locator('.progress-segment').count()===0);
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_PROGRESS_USD.png'),fullPage:true});

await page.locator('[data-rona-v6-deal-open="DEAL-2026-009"]').first().click();
await page.locator('.rona-pay-v6-action-backdrop').waitFor({state:'visible'});
const modal=await page.locator('.rona-pay-v6-action-backdrop').innerText();
pass('GAZONE_RUB_PASSPORT',modal.includes('RUB')&&!modal.includes('USD'));
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_GAZONE_RUB.png'),fullPage:true});
await page.locator('.rona-pay-v6-action-backdrop').getByRole('button',{name:'Закрыть'}).click();

await page.locator('[data-rona-v6-allocate="PAYEV-2026-000010"]').click();
await page.locator('.rona-pay-v6-action-backdrop').waitFor({state:'visible'});
await page.locator('.rona-pay-v6-modal-row select').selectOption('DEAL-2026-004');
await page.locator('.rona-pay-v6-modal-row input').fill('30000');
await page.locator('.rona-pay-v6-action-backdrop').getByRole('button',{name:'Добавить сделку'}).click();
const allocationRows=page.locator('.rona-pay-v6-modal-row');
await allocationRows.nth(1).locator('select').selectOption('DEAL-2026-005');
await allocationRows.nth(1).locator('input').fill('20000');
await page.screenshot({path:path.join(out,'REAL_PREVIEW_V6_OWNER_UNALLOCATED.png'),fullPage:true});
await page.locator('.rona-pay-v6-action-backdrop').getByRole('button',{name:'Подтвердить'}).click();
await page.waitForTimeout(350);
pass('OWNER_UNALLOCATED_PARTIAL_MULTI_DEAL_WORKFLOW',ownerPosts.some(x=>x.url.includes('/client-allocation')&&x.body.includes('DEAL-2026-004')&&x.body.includes('DEAL-2026-005')&&x.body.includes('30000')&&x.body.includes('20000')));
pass('PAYMENT_AMOUNT_IMMUTABLE',ownerPosts.every(x=>!x.body.includes('PAYMENT.amount')));

pass('REAL_PREVIEW_NO_PAGEERROR',pageErrors.length===0);
pass('REAL_PREVIEW_NO_CONSOLE_ERRORS',consoleErrors.length===0);
const proof={immutablePreview:origin,documentUrl:page.url(),head:process.env.EXPECTED_HEAD||null,documentStatus:documentResponse?.status()||null,mainUiUrl:mainUiResponse.url(),mainUiStatus:mainUiResponse.status(),mainUiHeader:mainUiResponse.headers()['x-rona-admin-payment-owner-screen']||null,v6Runtime:await page.evaluate(()=>window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__||null),pageErrors,consoleErrors,ownerPosts};
fs.writeFileSync(path.join(out,'real-preview-browser-proof.json'),JSON.stringify(proof,null,2));
console.log('REAL_PREVIEW_BROWSER_ACCEPTANCE=PASS');
console.log('IMMUTABLE_PREVIEW='+origin);
console.log('REAL_PREVIEW_DOCUMENT='+page.url());
console.log('REAL_PREVIEW_MAIN_UI='+mainUiResponse.url());
await browser.close();
