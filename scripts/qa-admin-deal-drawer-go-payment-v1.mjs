import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {onRequest as getDealsRuntime} from '../functions/portal/deals-current-state-ui.js';
import {onRequest as ownerApi} from '../functions/portal/owner-api.js';

const preview=String(process.env.PREVIEW_ORIGIN||'').replace(/\/$/,'');
assert.match(preview,/^https:\/\/[a-f0-9]+\.rona-trade-public\.pages\.dev$/,'exact immutable Cloudflare preview is required');

const source=await readFile('functions/portal/deals-current-state-ui.js','utf8');
const migration=await readFile('supabase/migrations/20260910153000_owner_r1_payment_signed_addendum_lineage_v1.sql','utf8');
assert.match(source,/send\.disabled=overall\(d\)!=='GO'\|\|String\(d\.payment_handoff_state\|\|''\)==='SENT'/,'payment handoff must be gated by current Status GO');
assert.match(source,/function syncDealDrawer\(d\)/,'right-side deal drawer runtime is required');
assert.match(source,/host\.replaceChildren\(owned\);syncDealDrawer\(sel\)/,'selected detail must route to drawer');
assert.match(source,/rona-current-deal-doc-download/,'drawer document actions must use one button family');
assert.doesNotMatch(source,/NIK|SOLARIS|FARG|GAZON|DEAL-2026-00[0-9]/i,'business implementation must stay universal');
assert.match(migration,/count\(\*\) filter\(where odd\.document_kind in \('ADDENDUM','SIGNED_ADDENDUM'\)\)/,'server addendum prerequisite must recognize the signed successor lineage');
assert.match(migration,/count\(\*\) filter\(where odd\.document_kind='SIGNED_ADDENDUM'\)/,'server must still separately require authoritative SIGNED_ADDENDUM');
assert.match(migration,/PAYMENT_OBLIGATION_NOT_CONFIRMED/,'existing finance fail-closed prerequisite must remain');

const runtimeResponse=await getDealsRuntime();
assert.equal(runtimeResponse.status,200,'Deals runtime response must be successful');
assert.equal(runtimeResponse.headers.get('x-rona-deal-drawer'),'right-overlay-go-gated-owner-uat-v2','Owner UAT drawer marker missing');
const runtime=await runtimeResponse.text();
assert.match(runtime,/send\.disabled=overall\(d\)!=='GO'\|\|String\(d\.payment_handoff_state\|\|''\)==='SENT'/,'emitted runtime must gate payment handoff by GO');
assert.doesNotMatch(runtime,/send\.disabled=!r\.ready/,'legacy readiness gate must not control payment handoff');
assert.match(runtime,/postJson\('\/admin\/deals\/'\+encodeURIComponent\(id\)\+'\/send-to-payments',\{\}\)/,'existing send-to-payments browser handoff must remain unchanged');
assert.match(runtime,/rona-current-deal-drawer-layer/,'emitted runtime must contain drawer presentation');
assert.match(runtime,/button\(\(r\.add\|\|r\.signed\)\?'Заменить доп\. соглашение':'Прикрепить доп\. соглашение'/,'emitted runtime must show replace addendum when ADDENDUM or SIGNED_ADDENDUM already exists');
assert.doesNotMatch(runtime,/owned\.append\(buildDetail\(sel\)\)/,'detail must not be appended below the table');

const snapshot={
  generatedAt:'2026-09-10T15:00:00.000Z',
  deals:[
    {deal_id:'QA-GO',client_id:'QA-C1',legal_name:'QA Client GO',contract_id:'QA-CTR1',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:100,delivery_basis:'DAP',product_confirmed_at:'2026-09-10T09:00:00Z',quantity_confirmed_at:'2026-09-10T09:00:00Z',obligation_amount:12500,client_remaining_amount:12500,finance_currency:'USD',finance_status:'NOT_DUE',accounting_status:'OPEN',payment_handoff_state:'NOT_SENT'},
    {deal_id:'QA-HOLD',client_id:'QA-C2',legal_name:'QA Client HOLD',contract_id:'QA-CTR2',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:120,delivery_basis:'DAP',product_confirmed_at:'2026-09-10T09:00:00Z',quantity_confirmed_at:'2026-09-10T09:00:00Z',obligation_amount:25000,client_remaining_amount:25000,finance_currency:'USD',finance_status:'PAID',accounting_status:'OPEN',payment_handoff_state:'NOT_SENT'}
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

const rpcCalls=[];
let bootstrapHits=0;
function rpcJson(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}})}
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=String(typeof input==='string'?input:input?.url||input);
  if(url.includes('/rest/v1/rpc/owner_r1_admin_bootstrap')){
    bootstrapHits++;
    snapshot.generatedAt=new Date().toISOString();
    rpcCalls.push({name:'owner_r1_admin_bootstrap',method:String(init.method||'GET').toUpperCase()});
    return rpcJson(snapshot);
  }
  if(url.includes('/rest/v1/rpc/owner_r1_send_to_payments')){
    const args=JSON.parse(String(init.body||'{}'));
    rpcCalls.push({name:'owner_r1_send_to_payments',method:String(init.method||'GET').toUpperCase(),args,authorization:new Headers(init.headers||{}).get('authorization')});
    const d=snapshot.deals.find(x=>x.deal_id===args.p_deal_id);
    if(!d)return rpcJson({message:'DEAL_NOT_FOUND'},400);
    const dx=snapshot.documents.filter(x=>x.deal_id===d.deal_id);
    const hasAddendumLineage=dx.some(x=>['ADDENDUM','SIGNED_ADDENDUM'].includes(String(x.document_kind)));
    const hasInvoice=dx.some(x=>x.document_kind==='INVOICE');
    const hasSigned=dx.some(x=>x.document_kind==='SIGNED_ADDENDUM');
    if(!d.product_confirmed_at)return rpcJson({message:'PRODUCT_CONFIRMATION_REQUIRED'},400);
    if(!d.quantity_confirmed_at)return rpcJson({message:'VOLUME_CONFIRMATION_REQUIRED'},400);
    if(!hasAddendumLineage)return rpcJson({message:'ADDENDUM_REQUIRED'},400);
    if(!hasInvoice)return rpcJson({message:'INVOICE_REQUIRED'},400);
    if(!hasSigned)return rpcJson({message:'SIGNED_ADDENDUM_REQUIRED'},400);
    if(d.obligation_amount===null||d.obligation_amount===undefined||Number(d.obligation_amount)<0||!String(d.finance_currency||'').trim())return rpcJson({message:'PAYMENT_OBLIGATION_NOT_CONFIRMED'},400);
    const idempotent=d.payment_handoff_state==='SENT';
    d.payment_handoff_state='SENT';
    return rpcJson({dealId:d.deal_id,state:'SENT',amount:d.obligation_amount,currency:d.finance_currency,idempotent});
  }
  return nativeFetch(input,init);
};

const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{min-height:3200px;margin:0}.qa-spacer{height:700px}</style></head><body><nav id="nav"><button data-page="deals">Сделки</button></nav><main id="page-deals"><div class="rona-owner-page-content" data-owner-page="deals"></div></main><div class="qa-spacer"></div><script src="/portal/deals-current-state-ui"></script></body></html>`;
async function pipeWebResponse(res,r){
  const headers={};r.headers.forEach((v,k)=>{headers[k]=v});
  res.writeHead(r.status,headers);res.end(Buffer.from(await r.arrayBuffer()));
}
const server=http.createServer(async(req,res)=>{
  const localOrigin=`http://${req.headers.host}`;
  const url=new URL(req.url||'/',localOrigin);
  if(url.pathname==='/portal/admin'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;
  }
  if(url.pathname==='/portal/deals-current-state-ui'){
    await pipeWebResponse(res,await getDealsRuntime());return;
  }
  if(url.pathname==='/portal/owner-api'){
    const chunks=[];for await(const c of req)chunks.push(c);
    const body=chunks.length?Buffer.concat(chunks):undefined;
    const headers=new Headers();for(const[k,v]of Object.entries(req.headers)){if(Array.isArray(v))v.forEach(x=>headers.append(k,x));else if(v!==undefined)headers.set(k,String(v))}
    const request=new Request(url,{method:req.method,headers,body:req.method==='GET'||req.method==='HEAD'?undefined:body});
    await pipeWebResponse(res,await ownerApi({request}));return;
  }
  res.writeHead(404,{'content-type':'text/plain'});res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900}});
await context.addCookies([{name:'rona_portal_at',value:'qa-admin-token',url:origin}]);
const page=await context.newPage();
const pageErrors=[];
const dialogs=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});

async function row(dealId){
  const exact=page.getByText(dealId,{exact:true});
  const r=page.locator('.rona-current-deal-table tbody tr').filter({has:exact});
  await r.waitFor({state:'visible',timeout:15000});
  assert.equal(await r.count(),1,`${dealId} must render once`);
  return r;
}
async function openDeal(dealId){
  const r=await row(dealId);
  await r.locator('button.rona-current-deal-open').evaluate(el=>el.click());
  const drawer=page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer');
  await drawer.waitFor({state:'visible',timeout:5000});
  assert.match(String(await drawer.textContent()),new RegExp(dealId),`${dealId} detail must be inside drawer`);
  assert.equal(await page.locator('#page-deals .rona-current-deals-owned .rona-current-deal-detail').count(),0,'no detail may be appended beneath the table');
  const geometry=await drawer.evaluate(el=>{const r=el.getBoundingClientRect();return{right:r.right,width:r.width,viewport:innerWidth}});
  assert.ok(Math.abs(geometry.viewport-geometry.right)<2,'drawer must be anchored to the right viewport edge');
  assert.ok(geometry.width<geometry.viewport,'drawer must overlay, not replace, the whole desktop page');
  return drawer;
}
async function sendButton(){return page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:/Отправить в оплату|Передано в оплату/})}
async function closeDrawerAndAssertScroll(expectedY){
  await page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer-close').evaluate(el=>el.click());
  await page.locator('#ronaCurrentDealDrawer').waitFor({state:'detached',timeout:5000});
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>window.scrollY),expectedY,'closing drawer must restore the same table scroll position');
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
  assert.equal(await send.isEnabled(),true,'GO must enable Отправить в оплату even when finance_status is NOT_DUE');
  const addendumAction=page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:'Заменить доп. соглашение'});
  assert.equal(await addendumAction.count(),1,'SIGNED_ADDENDUM successor must render the existing addendum action as Заменить доп. соглашение');
  assert.equal(await page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:'Прикрепить доп. соглашение'}).count(),0,'uploaded addendum lineage must not render Прикрепить доп. соглашение');
  assert.equal(await page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:'Заменить инвойс'}).count(),1,'existing invoice replacement action must remain unchanged');
  const docButtons=page.locator('#ronaCurrentDealDrawer .rona-current-deal-doc-download');
  assert.equal(await docButtons.count(),2,'signed addendum and invoice must expose the same download button family');
  const docGeometry=await docButtons.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();const s=getComputedStyle(n);return{h:Math.round(r.height),radius:s.borderRadius,font:s.fontWeight}}));
  assert.equal(docGeometry[0].h,docGeometry[1].h,'document download buttons must have equal height');
  assert.equal(docGeometry[0].radius,docGeometry[1].radius,'document download buttons must share the same shape');
  const cards=await page.locator('#ronaCurrentDealDrawer .rona-current-deal-detail-grid>.rona-owner-card').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().left)));
  assert.ok(cards.length>=4&&new Set(cards).size===1,'drawer sections must be aligned as one coherent column');
  const actionDisplay=await page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions').evaluate(el=>getComputedStyle(el).display);
  assert.equal(actionDisplay,'grid','bottom actions must be one deliberate aligned group');
  await closeDrawerAndAssertScroll(beforeOpen);

  await openDeal('QA-HOLD');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'HOLD must disable Отправить в оплату even with finance PAID');
  assert.equal(await page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:'Заменить доп. соглашение'}).count(),1,'active ADDENDUM must continue to render Заменить доп. соглашение');
  await closeDrawerAndAssertScroll(beforeOpen);

  await openDeal('QA-GO');
  send=await sendButton();
  const dialogStart=dialogs.length;
  await send.click();
  await page.waitForFunction(()=>document.querySelector('#ronaCurrentDealDrawer')?.textContent?.includes('Передано в оплату'),null,{timeout:5000});
  const handoffs=rpcCalls.filter(x=>x.name==='owner_r1_send_to_payments');
  assert.equal(handoffs.length,1,'one click must execute exactly one actual owner-api RPC handoff');
  assert.equal(handoffs[0].args.p_deal_id,'QA-GO','actual owner-api must preserve the existing deal handoff argument');
  assert.equal(handoffs[0].authorization,'Bearer qa-admin-token','actual authenticated owner-api route must forward the session bearer');
  const clickDialogs=dialogs.slice(dialogStart);
  assert.ok(clickDialogs.every(x=>!/прикреп|доп\. соглаш|дополнительн.*соглаш/i.test(x)),'GO handoff must not ask to attach another addendum');
  assert.ok(clickDialogs.some(x=>/передана в оплату/i.test(x)),'one-click GO handoff must report successful transfer to Payments');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'already-sent action remains disabled');

  snapshot.deals[0].payment_handoff_state='NOT_SENT';
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-deals-current-ready'),null,{timeout:15000});
  await openDeal('QA-GO');
  send=await sendButton();
  assert.equal(await send.isEnabled(),true,'GO gate must survive reload');
  assert.equal(await page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:'Заменить доп. соглашение'}).count(),1,'signed-successor replace label must survive reload');
  await page.locator('#ronaCurrentDealDrawer .rona-current-deal-drawer-close').evaluate(el=>el.click());
  await page.locator('#ronaCurrentDealDrawer').waitFor({state:'detached',timeout:5000});
  await openDeal('QA-HOLD');
  send=await sendButton();
  assert.equal(await send.isDisabled(),true,'HOLD gate must survive reload');

  assert.ok(bootstrapHits>=3,'actual owner-api projection must refresh on initial load, send and reload');
  assert.deepEqual(pageErrors,[],'drawer runtime must not throw browser errors');
  console.log('ADMIN_DEAL_DRAWER_GO_PAYMENT_OWNER_UAT=PASS',JSON.stringify({preview,route:'ACTUAL_OWNER_API',rpc:'owner_r1_send_to_payments',drawer:'RIGHT_OVERLAY_POLISHED',documentButtons:'ONE_FAMILY',signedAddendumActionLabel:'REPLACE',bottomDetail:false,scrollRestore:true,goFinanceStatusIgnored:true,holdDisabled:true,signedSuccessorNoReattach:true,oneClickPayments:true,reload:true,bootstrapHits}));
}finally{
  await browser.close();
  globalThis.fetch=nativeFetch;
  await new Promise(resolve=>server.close(resolve));
}