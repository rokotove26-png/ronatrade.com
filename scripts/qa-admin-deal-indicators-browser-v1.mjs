import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const preview=String(process.env.PREVIEW_ORIGIN||'').replace(/\/$/,'');
assert.match(preview,/^https:\/\/[a-f0-9]+\.rona-trade-public\.pages\.dev$/,'immutable Cloudflare preview is required');

const source=await readFile('functions/portal/deals-current-state-ui.js','utf8');
assert.match(source,/return !\(add\|\|signed\)\|\|!inv}/,'Documents must depend only on RONA addendum lineage + invoice');
assert.match(source,/function hasClientSignedAddendum\(d\)\{return !!docKind\(d&&d\.deal_id,'SIGNED_ADDENDUM'\)}/,'signed addendum source missing');
assert.match(source,/return hasClientSignedAddendum\(d\)\?'GO':'HOLD'/,'GO/HOLD must depend on signed client addendum');
assert.doesNotMatch(source,/NIK|SOLARIS|FARG|GAZON|DEAL-2026-00[3-9]/i,'implementation must not hardcode business entities');

const deployedResponse=await fetch(preview+'/portal/deals-current-state-ui?indicator-proof='+Date.now(),{cache:'no-store'});
assert.equal(deployedResponse.status,200,'deployed Deals runtime must be reachable');
assert.equal(deployedResponse.headers.get('x-rona-deal-indicators'),'documents-addendum-invoice-status-client-signed-v1','deployed indicator marker missing');
const deployedRuntime=await deployedResponse.text();
assert.match(deployedRuntime,/return !\(add\|\|signed\)\|\|!inv}/,'deployed Documents rule missing');
assert.match(deployedRuntime,/return hasClientSignedAddendum\(d\)\?'GO':'HOLD'/,'deployed GO/HOLD rule missing');

// Read-only production snapshot captured for this hotfix. Business identifiers are QA evidence only;
// the implementation above remains universal and contains none of these identifiers.
const snapshot={
  generatedAt:'2026-09-10T10:00:00.000Z',
  deals:[
    {deal_id:'DEAL-2026-003',client_id:'RONA-QA-003',legal_name:'Общество с ограниченной ответственностью «PRODUCTION PETROL»',contract_id:'CTR-003',contract_status:'ACTIVE',business_status:'CANCELLED',lifecycle_state:'CLOSED',cancellation_state:'CANCELLED',source_product:'СУГ',source_quantity_tonnes:1,delivery_basis:'DAP',finance_status:'NOT_DUE',accounting_status:'CURRENT'},
    {deal_id:'DEAL-2026-004',client_id:'RONA-QA-004',legal_name:'Общество с ограниченной ответственностью «FARG‘ONA GAZ TO‘LDIRISH STANSIYASI»',contract_id:'CTR-004',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:100,delivery_basis:'DAP',product_confirmed_at:'2026-08-26T00:00:00Z',quantity_confirmed_at:'2026-08-26T00:00:00Z',finance_status:'PAID',accounting_status:'CURRENT'},
    {deal_id:'DEAL-2026-005',client_id:'RONA-QA-005',legal_name:'Совместное предприятие Общество с ограниченной ответственностью «UNVERSAL SOLYARIS GRAND»',contract_id:'CTR-005',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:100,delivery_basis:'DAP',product_confirmed_at:'2026-08-26T00:00:00Z',quantity_confirmed_at:'2026-08-26T00:00:00Z',finance_status:'NOT_DUE',accounting_status:'CURRENT'},
    {deal_id:'DEAL-2026-006',client_id:'RONA-QA-006',legal_name:'Совместное предприятие Общество с ограниченной ответственностью «UNVERSAL SOLYARIS GRAND»',contract_id:'CTR-006',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:100,delivery_basis:'DAP',product_confirmed_at:'2026-08-26T00:00:00Z',quantity_confirmed_at:'2026-08-26T00:00:00Z',finance_status:'NOT_DUE',accounting_status:'CURRENT'},
    {deal_id:'DEAL-2026-007',client_id:'RONA-QA-007',legal_name:'Общество с ограниченной ответственностью Топливная компания «НИК-ОЙЛ»',contract_id:'CTR-007',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:250,delivery_basis:'DAP',product_confirmed_at:'2026-09-04T00:00:00Z',quantity_confirmed_at:'2026-09-04T00:00:00Z',finance_status:'NOT_DUE',accounting_status:'CURRENT',client_addendum_downloaded_at:'2026-09-04T21:10:00Z'},
    {deal_id:'DEAL-2026-008',client_id:'RONA-QA-008',legal_name:'Общество с ограниченной ответственностью Топливная компания «НИК-ОЙЛ»',contract_id:'CTR-008',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:470,delivery_basis:'DAP',product_confirmed_at:'2026-09-04T00:00:00Z',quantity_confirmed_at:'2026-09-04T00:00:00Z',finance_status:'NOT_DUE',accounting_status:'CURRENT',client_addendum_downloaded_at:'2026-09-04T21:10:00Z'},
    {deal_id:'DEAL-2026-009',client_id:'RONA-QA-009',legal_name:'Общество с ограниченной ответственностью «ГазОнэ»',contract_id:'CTR-009',contract_status:'ACTIVE',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',source_product:'СУГ',source_quantity_tonnes:100,delivery_basis:'DAP',product_confirmed_at:'2026-09-10T00:00:00Z',quantity_confirmed_at:'2026-09-10T00:00:00Z',finance_status:'NOT_DUE',accounting_status:'CURRENT'}
  ],
  documents:[
    {deal_id:'DEAL-2026-004',document_kind:'INVOICE',document_id:'QA-004-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'DEAL-2026-004',document_kind:'SIGNED_ADDENDUM',document_id:'QA-004-S',authoritative_filename:'signed-addendum.pdf'},
    {deal_id:'DEAL-2026-005',document_kind:'INVOICE',document_id:'QA-005-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'DEAL-2026-005',document_kind:'SIGNED_ADDENDUM',document_id:'QA-005-S',authoritative_filename:'signed-addendum.pdf'},
    {deal_id:'DEAL-2026-006',document_kind:'INVOICE',document_id:'QA-006-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'DEAL-2026-006',document_kind:'SIGNED_ADDENDUM',document_id:'QA-006-S',authoritative_filename:'signed-addendum.pdf'},
    {deal_id:'DEAL-2026-007',document_kind:'ADDENDUM',document_id:'QA-007-A',authoritative_filename:'addendum.pdf'},
    {deal_id:'DEAL-2026-007',document_kind:'INVOICE',document_id:'QA-007-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'DEAL-2026-008',document_kind:'ADDENDUM',document_id:'QA-008-A',authoritative_filename:'addendum.pdf'},
    {deal_id:'DEAL-2026-008',document_kind:'INVOICE',document_id:'QA-008-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'DEAL-2026-009',document_kind:'INVOICE',document_id:'QA-009-I',authoritative_filename:'invoice.pdf'},
    {deal_id:'DEAL-2026-009',document_kind:'SIGNED_ADDENDUM',document_id:'QA-009-S',authoritative_filename:'signed-addendum.pdf'}
  ],
  rail:[],dataConflicts:[]
};

const html=`<!doctype html><html><head><meta charset="utf-8"></head><body><nav id="nav"><button data-page="deals">Сделки</button></nav><main id="page-deals"><div class="rona-owner-page-content" data-owner-page="deals"></div></main><script src="${preview}/portal/deals-current-state-ui?browser-proof=1"></script></body></html>`;
let bootstrapHits=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);
  if(url.pathname==='/portal/admin'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;
  }
  if(url.pathname==='/portal/owner-api'){
    bootstrapHits++;
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data:snapshot}));return;
  }
  res.writeHead(404,{'content-type':'text/plain'});res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080}});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));

async function activeRow(dealId){
  const row=page.locator('.rona-current-deal-table tbody tr').filter({hasText:dealId});
  await row.waitFor({state:'visible',timeout:15000});
  assert.equal(await row.count(),1,`${dealId} must render once`);
  return row;
}
async function assertIndicators(dealId,documents,status){
  const row=await activeRow(dealId);
  const cells=row.locator('td');
  assert.match(String(await cells.nth(8).textContent()),new RegExp(documents),`${dealId} Documents mismatch`);
  assert.equal(String(await cells.nth(10).textContent()).trim(),status,`${dealId} Status mismatch`);
}
async function proveActive(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-deals-current-ready'),null,{timeout:15000});
  await assertIndicators('DEAL-2026-004','Комплект актуален','GO');
  await assertIndicators('DEAL-2026-005','Комплект актуален','GO');
  await assertIndicators('DEAL-2026-006','Комплект актуален','GO');
  await assertIndicators('DEAL-2026-007','Комплект актуален','HOLD');
  await assertIndicators('DEAL-2026-008','Комплект актуален','HOLD');
  await assertIndicators('DEAL-2026-009','Комплект актуален','GO');
}

try{
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await proveActive();
  const annulled=page.locator('.rona-current-deal-filter button').filter({hasText:'Аннулированные'});
  await annulled.click();
  await assertIndicators('DEAL-2026-003','Требует документа','NO-GO');
  await page.reload({waitUntil:'domcontentloaded'});
  await proveActive();
  assert.ok(bootstrapHits>=2,'reload must obtain the projection again');
  assert.deepEqual(pageErrors,[],'runtime must not throw browser errors');
  console.log('ADMIN_DEAL_INDICATORS_BROWSER=PASS',JSON.stringify({preview,existingDeals:['DEAL-2026-003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','DEAL-2026-007','DEAL-2026-008','DEAL-2026-009'],documents:{complete:6,requires:1},status:{GO:4,HOLD:2,NO_GO:1},nickOil:'ADDENDUM+INVOICE=>COMPLETE;NO_SIGNED=>HOLD',solarisGrand:'SIGNED_ADDENDUM=>GO',fargona:'PAID+SIGNED_ADDENDUM=>GO',gazone:'SIGNED_ADDENDUM=>GO',reload:true,bootstrapHits}));
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
