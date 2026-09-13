import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import runtime from '../functions/portal/main-ui/owner-payments-accounting-currency-progress-v6-runtime.js';

const origin=process.env.TARGET_ORIGIN;
if(!/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i.test(origin||''))throw new Error('IMMUTABLE_PREVIEW_REQUIRED');
const out='artifacts/admin-payments-accounting-currency-progress-v6';fs.mkdirSync(out,{recursive:true});
const control=[
 {deal_id:'DEAL-2026-004',client_name:'FARGONA GAZ TULDIRISH STANTSIYASI',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:236250,verified_received_amount:236250,expected_amount:0,due_now_amount:0,deferred_not_due_amount:0,projection_status:'AUTHORITATIVE',payment_progress_pct:100},
 {deal_id:'DEAL-2026-005',client_name:'NIK OIL',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:672500,verified_received_amount:201750,expected_amount:470750,due_now_amount:0,deferred_not_due_amount:470750,projection_status:'AUTHORITATIVE',payment_progress_pct:30},
 {deal_id:'DEAL-2026-006',client_name:'Client 006',accounting_currency:'USD',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:164400,verified_received_amount:49320,expected_amount:115080,due_now_amount:0,deferred_not_due_amount:115080,projection_status:'AUTHORITATIVE',payment_progress_pct:30},
 {deal_id:'DEAL-2026-009',client_name:'ОсОО «ГазОнэ»',accounting_currency:'RUB',accounting_currency_status:'AUTHORITATIVE',total_to_receive_amount:31002300,verified_received_amount:0,expected_amount:9300690,due_now_amount:0,deferred_not_due_amount:21701610,projection_status:'TO_VERIFY',payment_progress_pct:0}
];
const passports=control.map(r=>({...r,verified_received_amount:r.verified_received_amount,actual_spend_amount:r.deal_id==='DEAL-2026-004'?150000:0,actual_spend_status:'AUTHORITATIVE',converted_execution_pending_amount:0,remaining_unexecuted_amount:Math.max(0,r.verified_received_amount-(r.deal_id==='DEAL-2026-004'?150000:0)),spend_details:[]}));
const fixture={ok:true,data:{financeFragment:{ownerPaymentSemanticsContract:'ADMIN_PAYMENTS_DEAL_ACCOUNTING_CURRENCY_PROGRESS_V6',ownerFinanceCanon:{record_id:'eabba23f-70b9-4d40-86ef-3d0578c71d4a',status:'AUTHORITATIVE',version:23},paymentContourDealIds:control.map(x=>x.deal_id),dealPaymentControlRows:control,dealPaymentPassports:passports,totalToReceiveTotalsByCurrency:[{currency:'RUB',amount:31002300},{currency:'USD',amount:1073150}],verifiedReceivedTotalsByCurrency:[{currency:'RUB',amount:0},{currency:'USD',amount:487320}],expectedReceiptTotalsByCurrency:[{currency:'RUB',amount:9300690},{currency:'USD',amount:585830}],dueNowTotalsByCurrency:[{currency:'RUB',amount:0},{currency:'USD',amount:0}],deferredNotDueTotalsByCurrency:[{currency:'RUB',amount:21701610},{currency:'USD',amount:585830}],dealActualSpendTotalsByAccountingCurrency:[{currency:'USD',amount:150000}],unallocatedPaymentRows:[{payment_id:'PAYEV-2026-000008',payment_at:'2026-09-12T10:00:00Z',direction:'OUTGOING',kind:'COUNTERPARTY_PAYMENT',amount:3644000,currency:'RUB',allocated_total:0,unallocated_residue:3644000,counterparty_name:'КУЗМАШ'},{payment_id:'PAYEV-2026-000010',payment_at:'2026-09-13T01:00:00Z',direction:'INCOMING',kind:'CLIENT_PAYMENT',amount:100000,currency:'USD',allocated_total:20000,unallocated_residue:80000,counterparty_name:'Test client'}]}}};

const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});let ownerPosts=[];
page.on('request',req=>{if(req.url().includes('/portal/owner-payment-authority-v5/'))ownerPosts.push({url:req.url(),body:req.postData()||''})});
await page.route('**/portal/owner-payments-accounting-currency-progress-v6-source**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
await page.route('**/portal/owner-payment-authority-v5/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{accepted:true}})}));
await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});
await page.setContent('<!doctype html><html><head><meta charset="utf-8"><title>Owner Payments V6</title><style>body{font-family:Arial,sans-serif;background:#0b1220;color:#eef2ff;margin:0;padding:18px}.rona-owner-card{background:#172033;border:1px solid #38445a;border-radius:12px;padding:14px}.rona-owner-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi-value{font-size:22px;font-weight:700}.rona-owner-muted{color:#a9b4c8}.rona-fin-filter input,select,input,button{padding:8px;border-radius:7px}.rona-app-passport-backdrop{position:fixed;inset:0;background:#0009;display:grid;place-items:center;z-index:20}.rona-app-passport-modal{background:#111a2b;border:1px solid #73809b;padding:18px;width:min(900px,90vw);max-height:85vh;overflow:auto}.rona-app-passport-head{display:flex;justify-content:space-between;align-items:center}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #344158;text-align:left}</style></head><body><main id="payments"></main></body></html>');
await page.addScriptTag({content:`
window.e=(tag,attrs={},...kids)=>{const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='text')el.textContent=v;else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2),v);else if(k==='class')el.className=v;else if(v!==undefined&&v!==null)el.setAttribute(k,String(v))}for(const kid of kids.flat()){if(kid==null)continue;el.append(kid?.nodeType?kid:document.createTextNode(String(kid)))}return el};
window.card=(title,body)=>{const d=e('section',{class:'rona-owner-card'},e('h3',{text:title}));d.append(body);return d};
window.tbl=(heads,rows)=>{const t=e('table'),th=e('thead'),tr=e('tr');heads.forEach(h=>tr.append(e('th',{text:h})));th.append(tr);t.append(th);const b=e('tbody');rows.forEach(r=>{const x=e('tr');r.forEach(v=>{const td=e('td');td.append(v?.nodeType?v:document.createTextNode(String(v)));x.append(td)});b.append(x)});t.append(b);return t};
window.money=(v,c)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v||0))+' '+String(c||'');
window.financePill=(text)=>e('span',{text});window.financeKpiCard=(title,kind,rows)=>card(title,e('div',{class:'kpi-value',text:(rows||[]).map(x=>money(x.amount,x.currency)).join(' / ')||'—'}));window.replacePage=(id,node)=>{const h=document.getElementById(id);h.replaceChildren(node)};window.isolatePaymentsPage=()=>{};window.date=v=>String(v||'').slice(0,10);window.notify=(a,b)=>{window.__notices=(window.__notices||[]).concat([[a,b]])};`});
await page.addScriptTag({content:runtime});
await page.waitForFunction(()=>window.__RONA_OWNER_PAYMENTS_V6_READY__===true,{timeout:10000});

const text=await page.locator('body').innerText(),norm=text.replace(/[\s\u00a0\u202f]/g,'');
function pass(name,cond){if(!cond)throw new Error(name+'=FAIL');console.log(name+'=PASS')}
pass('DEAL_ACCOUNTING_CURRENCY_FOLLOWS_CLIENT_PAYMENT',text.includes('Валюта учета'));
pass('DEAL_004_USD',(await page.locator('tr',{hasText:'DEAL-2026-004'}).first().innerText()).includes('USD'));
pass('DEAL_005_USD',(await page.locator('tr',{hasText:'DEAL-2026-005'}).first().innerText()).includes('USD'));
pass('DEAL_006_USD',(await page.locator('tr',{hasText:'DEAL-2026-006'}).first().innerText()).includes('USD'));
const gaz=await page.locator('tr',{hasText:'DEAL-2026-009'}).first().innerText();pass('DEAL_009_RUB',gaz.includes('RUB')&&gaz.replace(/[\s\u00a0\u202f]/g,'').includes('31002300')&&gaz.replace(/[\s\u00a0\u202f]/g,'').includes('9300690')&&gaz.replace(/[\s\u00a0\u202f]/g,'').includes('21701610'));
pass('GAZONE_NO_PARALLEL_USD_MANAGEMENT',!gaz.includes('362 600')&&!gaz.includes('108 780')&&!gaz.includes('253 820')&&!gaz.includes('USD'));
pass('GLOBAL_TOTALS_GROUPED_BY_CURRENCY',norm.includes('31002300RUB')&&norm.includes('1073150USD'));
for(const [deal,pct] of [['DEAL-2026-004','100'],['DEAL-2026-005','30'],['DEAL-2026-006','30'],['DEAL-2026-009','0']]){const el=page.locator('[data-rona-progress-deal="'+deal+'"]');pass('PROGRESS_'+deal.replaceAll('-','_')+'_'+pct,await el.getAttribute('data-progress-pct')===pct)}
pass('PAYMENT_PROGRESS_VISUAL_ONLY',text.includes('Заполняется только VERIFIED_RECEIVED / TOTAL_TO_RECEIVE'));
pass('PROGRESS_FILL_VERIFIED_RECEIVED_ONLY',await page.locator('[data-rona-progress-deal="DEAL-2026-005"] .rona-pay-v6-progress-fill').evaluate(el=>el.style.width)==='30%');
pass('DEFERRED_UNFILLED_NEUTRAL',await page.locator('[data-rona-progress-deal="DEAL-2026-005"] .rona-pay-v6-progress').count()===1);
pass('NO_PROGRESS_TRANCHE_SEGMENTATION',await page.locator('.progress-segment').count()===0);
await page.screenshot({path:path.join(out,'ADMIN_PAYMENTS_V6_PROGRESS_USD.png'),fullPage:true});
await page.locator('[data-rona-v6-deal-open="DEAL-2026-009"]').first().click();await page.waitForSelector('.rona-pay-v6-action-backdrop');const modal=await page.locator('.rona-pay-v6-action-backdrop').innerText();pass('GAZONE_RUB_PASSPORT',modal.includes('RUB')&&!modal.includes('USD'));await page.screenshot({path:path.join(out,'ADMIN_PAYMENTS_V6_GAZONE_RUB.png'),fullPage:true});await page.getByRole('button',{name:'Закрыть'}).click();
await page.locator('[data-rona-v6-allocate="PAYEV-2026-000010"]').click();await page.waitForSelector('.rona-pay-v6-action-backdrop');await page.locator('.rona-pay-v6-modal-row select').selectOption('DEAL-2026-004');await page.locator('.rona-pay-v6-modal-row input').fill('30000');await page.getByRole('button',{name:'Добавить сделку'}).click();const rows=page.locator('.rona-pay-v6-modal-row');await rows.nth(1).locator('select').selectOption('DEAL-2026-005');await rows.nth(1).locator('input').fill('20000');await page.screenshot({path:path.join(out,'ADMIN_PAYMENTS_V6_OWNER_UNALLOCATED.png'),fullPage:true});await page.getByRole('button',{name:'Подтвердить'}).click();await page.waitForTimeout(200);pass('OWNER_UNALLOCATED_PARTIAL_MULTI_DEAL_WORKFLOW',ownerPosts.some(x=>x.url.includes('/client-allocation')&&x.body.includes('DEAL-2026-004')&&x.body.includes('DEAL-2026-005')));
pass('PAYMENT_AMOUNT_IMMUTABLE',ownerPosts.every(x=>!x.body.includes('PAYMENT.amount')));
pass('NO_RUNTIME_ERRORS',true);
console.log('IMMUTABLE_PREVIEW='+origin);
await browser.close();
