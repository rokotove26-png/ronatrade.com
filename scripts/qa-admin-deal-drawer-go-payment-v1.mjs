import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {onRequest as getDealsRuntime} from '../functions/portal/deals-current-state-ui.js';

const preview=String(process.env.PREVIEW_ORIGIN||'').replace(/\/$/,'');
assert.match(preview,/^https:\/\/[a-f0-9]+\.rona-trade-public\.pages\.dev$/,'exact immutable Cloudflare preview is required');

const source=await readFile('functions/portal/deals-current-state-ui.js','utf8');
assert.match(source,/send\.disabled=overall\(d\)!=='GO'\|\|String\(d\.payment_handoff_state\|\|''\)==='SENT'/,'payment handoff must be gated by current Status GO');
assert.match(source,/function syncDealDrawer\(d\)/,'right-side deal drawer runtime is required');
assert.match(source,/host\.replaceChildren\(owned\);syncDealDrawer\(sel\)/,'selected detail must route to drawer');
assert.doesNotMatch(source,/NIK|SOLARIS|FARG|GAZON|DEAL-2026-00[0-9]/i,'business implementation must stay universal');

const runtimeResponse=await getDealsRuntime();
assert.equal(runtimeResponse.status,200,'Deals runtime response must be successful');
assert.equal(runtimeResponse.headers.get('x-rona-deal-drawer'),'right-overlay-go-gated-v1','drawer build marker missing');
const runtime=await runtimeResponse.text();
assert.match(runtime,/send\.disabled=overall\(d\)!=='GO'\|\|String\(d\.payment_handoff_state\|\|''\)==='SENT'/,'emitted runtime must gate payment handoff by GO');
assert.doesNotMatch(runtime,/send\.disabled=!r\.ready/,'legacy readiness gate must not control payment handoff');
assert.match(runtime,/postJson\('\/admin\/deals\/'\+encodeURIComponent\(id\)\+'\/send-to-payments',\{\}\)/,'existing send-to-payments backend handoff must remain unchanged');
assert.match(runtime,/rona-current-deal-drawer-layer/,'emitted runtime must contain drawer presentation');
assert.doesNotMatch(runtime,/owned\.append\(buildDetail\(sel\)\)/,'detail must not be appended below the table');

const snapshot={
  generatedAt:'2026-09-10T11:00:00.000Z',
  deals:[
    {deal_id:'QA-GO',client_id:'QA-C1',legal_name:'QA Client GO',contract_id:'QA-CTR1',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:100,delivery_basis:'DAP',product_confirmed_at:'2026-09-10T09:00:00Z',quantity_confirmed_at:'2026-09-10T09:00:00Z',obligation_amount:null,finance_currency:'',finance_status:'NOT_DUE',accounting_status:'OPEN',payment_handoff_state:'NOT_SENT'},
    {deal_id:'QA-HOLD',client_id:'QA-C2',legal_name:'QA Client HOLD',contract_id:'QA-CTR2',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:120,delivery_basis:'DAP',product_confirmed_at:'2026-09-10T09:00:00Z',quantity_confirmed_at:'2026-09-10T09:00:00Z',obligation_amount:25000,finance_currency:'USD',finance_status:'PAID',accounting_status:'OPEN',payment_handoff_state:'NOT_SENT'}
  ],
  documents:[
    {deal_id:'QA-GO',document_kind:'SIGNED_ADDENDUM',document_id:'QA-GO-S',authoritative_filename:'signed.pdf'},
    {deal_id:'QA-GO',document_kind:'INVOICE',document_id:'QA-GO-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'QA-HOLD',document_kind:'ADDENDUM',document_id:'QA-HOLD-A',authoritative_filename:'addendum.pdf'},
    {deal_id:'QA-HOLD',document_kind:'INVOICE',document_id:'QA-HOLD-I',authoritative_filename:'invoice.pdf'}
  ],
  rail:[],
  dataConflicts:[]
};

const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{min-height:3200px;margin:0}.qa-spacer{height:700px}</style></head><body><nav id="nav"><button data-page="deals">Сделки</button></nav><main id="page-deals"><div class="rona-owner-page-content" data-owner-page="deals"></div></main><div class="qa-spacer"></div><script src="/portal/deals-current-state-ui"></script></body></html>`;
let bootstrapHits=0;
const handoffs=[];
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);
  if(url.pathname==='/portal/admin'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;
  }
  if(url.pathname==='/portal/deals-current-state-ui'){
    const r=await getDealsRuntime();
    const headers=Object.fromEntries(r.headers.entries());
    res.writeHead(r.status,headers);res.end(await r.text());return;
  }
  if(url.pathname==='/portal/owner-api'){
    const path=decodeURIComponent(url.searchParams.get('path')||'');
    if(req.method==='POST'&&path==='/admin/deals/QA-GO/send-to-payments'){
      handoffs.push({method:req.method,path});
      snapshot.deals[0].payment_handoff_state='SENT';
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data:{idempotent:false}}));return;
    }
    if(req.method==='GET'&&path==='/admin/workflow-bootstrap'){
      bootstrapHits++;
      snapshot.generatedAt=new Date().toISOString();
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data:snapshot}));return;
    }
    res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,code:'QA_UNEXPECTED_PATH',path}));return;
  }
  res.writeHead(404,{'content-type':'text/plain'});res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900}});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('dialog',dialog=>dialog.accept());

async function row(dealId){
  const r=page.locator('.rona-current-deal-table tbody tr').filter({hasText:dealId});
  await r.waitFor({state:'visible',timeout:15000});
  assert.equal(await r.count(),1,`${dealId} must render once`);
  return r;
}
async function openDeal(dealId){
  const r=await row(dealId);
  const open=r.locator('button.rona-current-deal-open');
  await open.evaluate(el=>el.click());
  const drawer=page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer');
  await drawer.waitFor({state:'visible',timeout:5000});
  assert.match(String(await drawer.textContent()),new RegExp(dealId),`${dealId} detail must be inside drawer`);
  assert.equal(await page.locator('#page-deals .rona-current-deals-owned .rona-current-deal-detail').count(),0,'no detail may be appended beneath the table');
  const geometry=await drawer.evaluate(el=>{const r=el.getBoundingClientRect();return{right:r.right,width:r.width,viewport:innerWidth}});
  assert.ok(Math.abs(geometry.viewport-geometry.right)<2,'drawer must be anchored to the right viewport edge');
  assert.ok(geometry.width<geometry.viewport,'drawer must overlay, not replace, the whole desktop page');
  return drawer;
}
async function sendButton(){
  return page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:/Отправить в оплату|Передано в оплату/});
}
async function closeDrawerAndAssertScroll(expectedY){
  const close=page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer-close');
  await close.evaluate(el=>el.click());
  await page.locator('#ronaCurrentDealDrawer').waitFor({state:'detached',timeout:5000});
  await page.waitForTimeout(50);
  const y=await page.evaluate(()=>window.scrollY);
  assert.equal(y,expectedY,'closing drawer must restore the same table scroll position');
  assert.equal(await page.locator('.rona-current-deal-table').count(),1,'table context must remain mounted after close');
  assert.equal(await page.locator('.rona-current-deal-filter button[aria-pressed="true"]').first().textContent().then(v=>String(v).startsWith('Активные')),true,'active filter context must remain unchanged');
}

try{
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-deals-current-ready'),null,{timeout:15000});

  await page.evaluate(()=>window.scrollTo(0,420));
  const beforeOpen=await page.evaluate(()=>window.scrollY);
  assert.equal(beforeOpen,420,'QA scroll setup failed');

  await openDeal('QA-GO');
  let send=await sendButton();
  assert.equal(await send.isEnabled(),true,'GO must enable Отправить в оплату even when finance is NOT_DUE and obligation is absent');
  await closeDrawerAndAssertScroll(beforeOpen);

  await openDeal('QA-HOLD');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'non-GO Status must disable Отправить в оплату even when finance/doc confirmations look ready');
  await closeDrawerAndAssertScroll(beforeOpen);

  await openDeal('QA-GO');
  send=await sendButton();
  await send.click();
  await page.waitForFunction(()=>document.querySelector('#ronaCurrentDealDrawer')?.textContent?.includes('Передано в оплату'),null,{timeout:5000});
  assert.deepEqual(handoffs,[{method:'POST',path:'/admin/deals/QA-GO/send-to-payments'}],'GO action must call the existing backend handoff exactly once');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'already-sent action remains disabled by existing behavior');

  snapshot.deals[0].payment_handoff_state='NOT_SENT';
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-deals-current-ready'),null,{timeout:15000});
  await openDeal('QA-GO');
  send=await sendButton();
  assert.equal(await send.isEnabled(),true,'GO gate must survive reload');
  await page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer-close').evaluate(el=>el.click());
  await page.locator('#ronaCurrentDealDrawer').waitFor({state:'detached',timeout:5000});
  await openDeal('QA-HOLD');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'HOLD gate must survive reload');

  assert.ok(bootstrapHits>=3,'projection must refresh on initial load, send handoff, and reload');
  assert.deepEqual(pageErrors,[],'drawer runtime must not throw browser errors');
  console.log('ADMIN_DEAL_DRAWER_GO_PAYMENT=PASS',JSON.stringify({preview,runtime:'PR_CHECKOUT_ONREQUEST',drawer:'RIGHT_OVERLAY',bottomDetail:false,scrollRestore:true,goEnabledWithoutFinance:true,holdDisabled:true,handoff:'/admin/deals/:id/send-to-payments',handoffCount:handoffs.length,reload:true,bootstrapHits}));
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
