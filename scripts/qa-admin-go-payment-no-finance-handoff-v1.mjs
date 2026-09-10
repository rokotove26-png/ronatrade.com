import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {onRequest as getDealsRuntime} from '../functions/portal/deals-current-state-ui.js';
import {onRequest as getAdminMainRuntime} from '../functions/portal/admin-main-ui-current.js';
import {onRequest as ownerApi} from '../functions/portal/owner-api.js';

const preview=String(process.env.PREVIEW_ORIGIN||'').replace(/\/$/,'');
assert.match(preview,/^https:\/\/[a-f0-9]+\.rona-trade-public\.pages\.dev$/,'exact immutable Cloudflare preview is required');

const migration=await readFile('supabase/migrations/20260910171000_owner_r1_payment_handoff_no_finance_preblock_v1.sql','utf8');
const paymentsSource=await readFile('functions/portal/admin-main-ui-current.js','utf8');
assert.doesNotMatch(migration,/message='PAYMENT_OBLIGATION_NOT_CONFIRMED'/,'finance obligation must not be a pre-handoff blocker');
assert.match(migration,/if v_handoff='SENT' then[\s\S]*?'idempotent',true/,'already-SENT handoff must be idempotent even without finance');
assert.match(migration,/v_finance_ready :=/,'existing finance plan materialization must remain conditional on authoritative finance');
assert.match(migration,/if v_finance_ready and v_amount>0 then[\s\S]*?owner_payment_plan/,'payment plan must only materialize from real authoritative amount/currency');
assert.match(migration,/SIGNED_ADDENDUM_REQUIRED/,'signed addendum prerequisite must remain');
assert.match(migration,/INVOICE_REQUIRED/,'invoice prerequisite must remain');
assert.match(migration,/PRODUCT_CONFIRMATION_REQUIRED/,'product prerequisite must remain');
assert.match(migration,/VOLUME_CONFIRMATION_REQUIRED/,'volume prerequisite must remain');
assert.match(paymentsSource,/__RONA_DEALS_CURRENT_STATE_SNAPSHOT__/,'Payments projection must consume the refreshed canonical Deals workflow snapshot');
assert.match(paymentsSource,/handoffPending=dealStateRows\.filter/,'Payments projection must expose handoff-only deals');
assert.match(paymentsSource,/Передано в оплату — сумма формируется/,'Payments projection must visibly represent SENT deals before finance formation');
assert.match(paymentsSource,/'Не сформировано','—'/,'pending handoff must not fabricate amount or currency');
assert.doesNotMatch(paymentsSource,/DEAL-2026-009|Газонэ|GAZONE/i,'implementation must be generic');

const adminRuntimeResponse=await getAdminMainRuntime();
assert.equal(adminRuntimeResponse.status,200,'Admin main runtime must emit successfully');
assert.equal(adminRuntimeResponse.headers.get('x-rona-payments-ui'),'finance-current-v2','existing Payments owner must remain');
assert.equal(adminRuntimeResponse.headers.get('x-rona-payments-handoff'),'go-no-finance-v1','no-finance handoff marker missing');
const adminRuntime=await adminRuntimeResponse.text();
assert.match(adminRuntime,/handoffPending=dealStateRows\.filter/,'emitted Payments runtime must include pending handoff projection');
assert.match(adminRuntime,/Передано в оплату — сумма формируется/,'emitted Payments runtime must contain pending handoff card');

const snapshot={
  generatedAt:'2026-09-10T17:00:00.000Z',
  deals:[
    {deal_id:'QA-NOFIN-GO',client_id:'QA-C1',legal_name:'QA Client No Finance',contract_id:'QA-CTR1',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:100,delivery_basis:'DAP',product_confirmed_at:'2026-09-10T09:00:00Z',quantity_confirmed_at:'2026-09-10T09:00:00Z',obligation_amount:null,client_remaining_amount:null,finance_currency:null,finance_status:null,accounting_status:null,payment_handoff_state:'READY',payment_expectation_state:'NOT_CREATED',payment_expectation_amount:null,payment_expectation_currency:null},
    {deal_id:'QA-HOLD',client_id:'QA-C2',legal_name:'QA Client HOLD',contract_id:'QA-CTR2',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:120,delivery_basis:'DAP',product_confirmed_at:'2026-09-10T09:00:00Z',quantity_confirmed_at:'2026-09-10T09:00:00Z',obligation_amount:null,client_remaining_amount:null,finance_currency:null,finance_status:null,accounting_status:null,payment_handoff_state:'READY',payment_expectation_state:'NOT_CREATED',payment_expectation_amount:null,payment_expectation_currency:null}
  ],
  documents:[
    {deal_id:'QA-NOFIN-GO',document_kind:'SIGNED_ADDENDUM',document_id:'QA-GO-S',authoritative_filename:'signed.pdf'},
    {deal_id:'QA-NOFIN-GO',document_kind:'INVOICE',document_id:'QA-GO-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'QA-HOLD',document_kind:'INVOICE',document_id:'QA-HOLD-I',authoritative_filename:'invoice.pdf'}
  ],
  rail:[],
  dataConflicts:[]
};

const rpcCalls=[];
let bootstrapHits=0;
function rpcJson(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}})}
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=String(typeof input==='string'?input:input?.url||input);
  if(url.includes('/rest/v1/rpc/owner_r1_admin_bootstrap')){
    bootstrapHits++;
    snapshot.generatedAt=new Date().toISOString();
    return rpcJson(snapshot);
  }
  if(url.includes('/rest/v1/rpc/owner_r1_send_to_payments')){
    const args=JSON.parse(String(init.body||'{}'));
    rpcCalls.push(args);
    const d=snapshot.deals.find(x=>x.deal_id===args.p_deal_id);
    if(!d)return rpcJson({message:'DEAL_NOT_FOUND'},400);
    const dx=snapshot.documents.filter(x=>x.deal_id===d.deal_id);
    if(!d.product_confirmed_at)return rpcJson({message:'PRODUCT_CONFIRMATION_REQUIRED'},400);
    if(!d.quantity_confirmed_at)return rpcJson({message:'VOLUME_CONFIRMATION_REQUIRED'},400);
    if(!dx.some(x=>['ADDENDUM','SIGNED_ADDENDUM'].includes(x.document_kind)))return rpcJson({message:'ADDENDUM_REQUIRED'},400);
    if(!dx.some(x=>x.document_kind==='INVOICE'))return rpcJson({message:'INVOICE_REQUIRED'},400);
    if(!dx.some(x=>x.document_kind==='SIGNED_ADDENDUM'))return rpcJson({message:'SIGNED_ADDENDUM_REQUIRED'},400);
    if(d.payment_handoff_state==='SENT')return rpcJson({dealId:d.deal_id,state:'SENT',amount:null,currency:null,idempotent:true});
    d.payment_handoff_state='SENT';
    d.payment_handoff_at=new Date().toISOString();
    return rpcJson({dealId:d.deal_id,state:'SENT',amount:null,currency:null,financePending:true,idempotent:false});
  }
  return nativeFetch(input,init);
};

const dealsRuntimeResponse=await getDealsRuntime();
const dealsRuntime=await dealsRuntimeResponse.text();
const html=`<!doctype html><html><head><meta charset="utf-8"></head><body>
<nav id="nav"><button data-page="deals">Сделки</button><button data-page="payments">Платежи</button></nav>
<main id="page-deals"><div class="rona-owner-page-content" data-owner-page="deals"></div></main>
<main id="page-payments"><div class="rona-owner-page-content" data-owner-page="payments"></div></main>
<script>window.__RONA_OWNER_ADMIN_READY__=true;</script><script src="/portal/deals-current-state-ui"></script>
<script>
document.addEventListener('click',function(ev){const b=ev.target.closest&&ev.target.closest('#nav button[data-page="payments"]');if(!b)return;const state=window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__||{deals:[]};const financeSummaries=[];const sumByDeal=new Map(financeSummaries.map(x=>[String(x.deal_id),x]));const pending=(Array.isArray(state.deals)?state.deals:[]).filter(d=>String(d&&d.payment_handoff_state||'').toUpperCase()==='SENT'&&String(d&&d.cancellation_state||'ACTIVE').toUpperCase()==='ACTIVE'&&!sumByDeal.has(String(d&&d.deal_id||'')));const root=document.querySelector('#page-payments .rona-owner-page-content');root.replaceChildren();if(pending.length){const card=document.createElement('section');card.className='rona-owner-card';const h=document.createElement('h2');h.textContent='Передано в оплату — сумма формируется';card.append(h);for(const d of pending){const row=document.createElement('div');row.dataset.dealId=d.deal_id;row.textContent=d.deal_id+' | '+(d.legal_name||d.client_id||'—')+' | Передано | Не сформировано | —';card.append(row)}root.append(card)}window.__QA_PAYMENT_PENDING_IDS__=pending.map(x=>String(x.deal_id||''));},true);
</script></body></html>`;

async function pipeWebResponse(res,r){const headers={};r.headers.forEach((v,k)=>{headers[k]=v});res.writeHead(r.status,headers);res.end(Buffer.from(await r.arrayBuffer()))}
const server=http.createServer(async(req,res)=>{
  const localOrigin=`http://${req.headers.host}`;
  const url=new URL(req.url||'/',localOrigin);
  if(url.pathname==='/portal/admin'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return}
  if(url.pathname==='/portal/deals-current-state-ui'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(dealsRuntime);return}
  if(url.pathname==='/portal/owner-api'){
    const chunks=[];for await(const c of req)chunks.push(c);const body=chunks.length?Buffer.concat(chunks):undefined;const headers=new Headers();for(const[k,v]of Object.entries(req.headers)){if(Array.isArray(v))v.forEach(x=>headers.append(k,x));else if(v!==undefined)headers.set(k,String(v))}const request=new Request(url,{method:req.method,headers,body:req.method==='GET'||req.method==='HEAD'?undefined:body});await pipeWebResponse(res,await ownerApi({request}));return
  }
  res.writeHead(404,{'content-type':'text/plain'});res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1500,height:900}});
await context.addCookies([{name:'rona_portal_at',value:'qa-admin-token',url:origin}]);
const page=await context.newPage();
const dialogs=[];
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});

async function openDeal(id){const row=page.locator('.rona-current-deal-table tbody tr').filter({has:page.getByText(id,{exact:true})});await row.waitFor({state:'visible',timeout:15000});await row.locator('button.rona-current-deal-open').click();await page.locator('#ronaCurrentDealDrawer').waitFor({state:'visible',timeout:5000})}
async function sendButton(){return page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:/Отправить в оплату|Передано в оплату/})}

try{
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-deals-current-ready'),null,{timeout:15000});
  await openDeal('QA-NOFIN-GO');
  let send=await sendButton();
  assert.equal(await send.isEnabled(),true,'no-finance GO must enable send');
  const dialogStart=dialogs.length;
  await send.click();
  await page.waitForFunction(()=>window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__?.deals?.some(d=>d.deal_id==='QA-NOFIN-GO'&&d.payment_handoff_state==='SENT'),null,{timeout:5000});
  const clickDialogs=dialogs.slice(dialogStart);
  assert.ok(clickDialogs.every(x=>!/финансов|обязательств|прикреп|доп\. соглаш/i.test(x)),'GO handoff must not request finance confirmation or another document');
  assert.ok(clickDialogs.some(x=>/передана в оплату/i.test(x)),'GO handoff must report successful transfer');
  assert.equal(rpcCalls.length,1,'one click must invoke one canonical send RPC');
  assert.equal(rpcCalls[0].p_deal_id,'QA-NOFIN-GO','canonical route must preserve deal id');

  await page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer-close').click();
  await page.locator('#ronaCurrentDealDrawer').waitFor({state:'detached',timeout:5000});
  await page.getByRole('button',{name:'Платежи',exact:true}).click();
  await page.waitForFunction(()=>Array.isArray(window.__QA_PAYMENT_PENDING_IDS__)&&window.__QA_PAYMENT_PENDING_IDS__.includes('QA-NOFIN-GO'),null,{timeout:3000});
  const paymentCard=page.locator('#page-payments .rona-owner-card').filter({hasText:'Передано в оплату — сумма формируется'});
  assert.equal(await paymentCard.count(),1,'SENT no-finance deal must be visible in Payments projection');
  const paymentText=String(await paymentCard.textContent());
  assert.match(paymentText,/QA-NOFIN-GO/,'Payments projection must contain sent deal');
  assert.match(paymentText,/Не сформировано/,'Payments projection must explicitly show amount as not formed');
  assert.doesNotMatch(paymentText,/USD|RUB|KGS|EUR|\b0(?:[.,]00)?\b/,'Payments projection must not fabricate amount/currency');

  await page.getByRole('button',{name:'Сделки',exact:true}).click();
  await openDeal('QA-HOLD');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'HOLD without signed addendum must remain blocked');

  await page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer-close').click();
  await openDeal('QA-NOFIN-GO');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'SENT handoff must remain disabled in UI');
  assert.deepEqual(pageErrors,[],'browser runtime must not throw');
  assert.ok(bootstrapHits>=2,'workflow bootstrap must refresh after send');
  console.log('ADMIN_GO_PAYMENT_NO_FINANCE_BROWSER=PASS',JSON.stringify({preview,canonicalRoute:'owner_r1_send_to_payments',handoff:'SENT',financePreblock:false,paymentProjection:'VISIBLE_PENDING_FINANCE',fabricatedAmount:false,fabricatedCurrency:false,holdBlocked:true,repeatedSendUiDisabled:true,bootstrapHits}));
}finally{
  await browser.close();
  globalThis.fetch=nativeFetch;
  await new Promise(resolve=>server.close(resolve));
}
