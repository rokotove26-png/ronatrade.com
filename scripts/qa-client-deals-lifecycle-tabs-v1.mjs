import http from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const runtime=await readFile('dist/assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const projection={
  contract:{client_id:'RONA-QA-CLIENT',contract_id:'RONA-QA-CONTRACT',legal_name:'QA Client'},
  applications:[],
  deals:[
    {deal_id:'DEAL-2098-101',business_status:'EXECUTING',current_status:'EXECUTING',client_deal_stage:'ACTIVE',client_deal_stage_source:'CANONICAL_DEAL_EXECUTION_LIFECYCLE_V1',payment_status:'NOT_DUE',resource_status:'RESOURCE_CONFIRMED'},
    {deal_id:'DEAL-2098-102',business_status:'EXECUTING',current_status:'EXECUTING',client_deal_stage:'ATTENTION',client_deal_stage_source:'CANONICAL_DEAL_EXECUTION_LIFECYCLE_V1',post_rail_completion_attention:true,payment_status:'PAID',resource_status:'RESOURCE_CONFIRMED'},
    {deal_id:'DEAL-2098-103',business_status:'COMPLETED',current_status:'COMPLETED',client_deal_stage:'COMPLETED',client_deal_stage_source:'CANONICAL_DEAL_EXECUTION_LIFECYCLE_V1',payment_status:'PAID',resource_status:'RESOURCE_CONFIRMED',closed_at:'2098-03-01T00:00:00Z'},
    {deal_id:'DEAL-2098-104',business_status:'CANCELLED',current_status:'CANCELLED',client_deal_stage:'ARCHIVED',client_deal_stage_source:'CANONICAL_DEAL_EXECUTION_LIFECYCLE_V1',closed_at:'2098-03-02T00:00:00Z'}
  ]
};
const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{background:#06111c;color:#fff}.active{display:block}.rona-deal-card-v5{padding:8px;margin:4px;border:1px solid #345}[hidden]{display:none!important}</style></head><body>
<section id="page-deals" class="active"><input placeholder="ИД сделки / товар / станция"><select><option>Все этапы</option></select></section>
<script>
const projection=${JSON.stringify(projection)};
const ctx={client_id:'RONA-QA-CLIENT',contract_id:'RONA-QA-CONTRACT',legal_name:'QA Client'};
window.RONA_CLIENT_CONTEXT={
 getCurrentContext:()=>ctx,
 getCurrentProjection:()=>projection,
 whenReady:async()=>ctx,
 subscribe:(fn)=>{queueMicrotask(()=>fn(ctx,{source:'qa'}));return()=>{}}
};
</script>
<script src="/client-deals-authoritative-v1.js"></script>
</body></html>`;

const server=http.createServer((req,res)=>{
  if(req.url==='/portal/client'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
  if(req.url==='/client-deals-authoritative-v1.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(runtime);return}
  res.writeHead(404);res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('[data-rona-deal-stage-tab]').length===3);
  await page.waitForFunction(()=>document.querySelectorAll('[data-rona-deals-authoritative-rendered]').length===3);

  async function visibleIds(){
    return page.evaluate(()=>[...document.querySelectorAll('[data-rona-deals-authoritative-rendered]')].filter(x=>!x.hidden).map(x=>x.dataset.ronaCanonicalDealId));
  }
  assert.deepEqual(await visibleIds(),['DEAL-2098-101']);
  const counts=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('[data-rona-deal-stage-count]')].map(x=>[x.dataset.ronaDealStageCount,x.textContent])));
  assert.deepEqual(counts,{ACTIVE:'1',ATTENTION:'1',COMPLETED:'1'});

  await page.click('[data-rona-deal-stage-tab="ATTENTION"]');
  assert.deepEqual(await visibleIds(),['DEAL-2098-102']);
  await page.click('[data-rona-deal-stage-tab="COMPLETED"]');
  assert.deepEqual(await visibleIds(),['DEAL-2098-103']);
  await page.click('[data-rona-deal-stage-tab="ACTIVE"]');
  assert.deepEqual(await visibleIds(),['DEAL-2098-101']);

  const archived=await page.locator('[data-rona-canonical-deal-id="DEAL-2098-104"]').count();
  assert.equal(archived,0,'archived/cancelled deals must stay outside lifecycle tabs');
  console.log('CLIENT_DEALS_LIFECYCLE_TABS_V1=PASS');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
