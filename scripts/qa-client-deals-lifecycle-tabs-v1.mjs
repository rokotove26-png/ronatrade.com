import http from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const runtime=await readFile('dist/assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const responsiveCss=await readFile('dist/assets/portal-runtime/client-content-responsive-v1.css','utf8');
const buttonRuntime=await readFile('dist/assets/portal-runtime/portal-canonical-button-hover-v1.js','utf8');
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
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
body{background:#06111c;color:#fff;margin:0}.active{display:block}.rona-deal-card-v5{padding:8px;margin:4px;border:1px solid #345}[hidden]{display:none!important}
#page-deals{width:1100px;padding:0 20px;box-sizing:border-box}
.qa-title-frame{width:80%;margin-left:auto;border:1px solid #456;border-radius:12px;padding:14px;box-sizing:border-box}
.qa-title-inner{width:32%;border:1px solid #678;background:linear-gradient(180deg,#10283b,#091726);padding:4px 8px;box-sizing:border-box}
.qa-company-frame,.qa-filter-frame{width:100%;border:1px solid #345;box-sizing:border-box;margin-top:12px;padding:8px}
</style><link rel="stylesheet" href="/client-content-responsive-v1.css"></head><body>
<section id="page-deals" class="active">
  <section class="qa-title-frame"><div class="qa-title-inner"><h1>Сделки</h1></div></section>
  <div class="qa-company-frame">Выбрана компания · QA Client</div>
  <div class="qa-filter-frame"><input placeholder="ИД сделки / товар / станция"><select><option>Все этапы</option></select><button>Сбросить</button></div>
</section>
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
<script src="/portal-canonical-button-hover-v1.js"></script>
</body></html>`;

const server=http.createServer((req,res)=>{
  if(req.url==='/portal/client'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
  if(req.url==='/client-deals-authoritative-v1.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(runtime);return}
  if(req.url==='/client-content-responsive-v1.css'){res.writeHead(200,{'content-type':'text/css; charset=utf-8'});res.end(responsiveCss);return}
  if(req.url==='/portal-canonical-button-hover-v1.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(buttonRuntime);return}
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
  await page.waitForFunction(()=>document.documentElement.dataset.ronaClientDealsFrameAlignment==='20261004-client-deals-outer-title-frame-align-v15');

  async function visibleIds(){
    return page.evaluate(()=>[...document.querySelectorAll('[data-rona-deals-authoritative-rendered]')].filter(x=>!x.hidden).map(x=>x.dataset.ronaCanonicalDealId));
  }
  assert.deepEqual(await visibleIds(),['DEAL-2098-101']);
  const counts=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('[data-rona-deal-stage-count]')].map(x=>[x.dataset.ronaDealStageCount,x.textContent])));
  assert.deepEqual(counts,{ACTIVE:'1',ATTENTION:'1',COMPLETED:'1'});

  const visual=await page.evaluate(()=>{
    const tabs=[...document.querySelectorAll('[data-rona-deal-stage-tab]')];
    const firstCard=document.querySelector('[data-rona-deals-authoritative-rendered]');
    const strip=firstCard?.querySelector('[data-rona-deal-state-strip="authoritative-v8"]');
    const tabRects=tabs.map(x=>x.getBoundingClientRect());
    const cardRect=firstCard?.getBoundingClientRect();
    const cardStyle=firstCard?getComputedStyle(firstCard):null;
    return{
      tabHeights:tabRects.map(r=>Math.round(r.height)),
      tabWidths:tabRects.map(r=>Math.round(r.width)),
      selectedBackground:getComputedStyle(tabs[0]).backgroundImage,
      cardWidth:Math.round(cardRect?.width||0),
      cardRadius:cardStyle?.borderRadius||'',
      stripVisible:Boolean(strip&&getComputedStyle(strip).display!=='none'),
      visualMarker:document.querySelector('[data-rona-deal-stage-tabs]')?.dataset?.ronaDealsVisual||''
    };
  });
  assert.ok(visual.tabHeights.every(h=>h>=46),'lifecycle tabs must have comfortable desktop height');
  assert.ok(Math.max(...visual.tabWidths)-Math.min(...visual.tabWidths)<=2,'lifecycle tabs must have equal widths');
  assert.match(visual.selectedBackground,/gradient/i,'selected tab must have deliberate premium hierarchy');
  assert.ok(visual.cardWidth>700,'deal card must use the available workspace width');
  assert.match(visual.cardRadius,/1[4-9]px|2\dpx/,'deal card must use the premium rounded hierarchy');
  assert.equal(visual.stripVisible,true,'canonical state strip must be visibly composed');
  assert.equal(visual.visualMarker,'premium-hierarchy-v12','visual hierarchy marker must be present');

  const frameAlignment=await page.evaluate(()=>{
    const title=document.querySelector('.qa-title-frame').getBoundingClientRect();
    const inner=document.querySelector('.qa-title-inner').getBoundingClientRect();
    const selectors=['.qa-company-frame','.qa-filter-frame','[data-rona-deal-stage-tabs]','[data-rona-deals-authoritative-list]'];
    const rects=selectors.map(selector=>{
      const node=document.querySelector(selector),rect=node?.getBoundingClientRect();
      return {selector,aligned:node?.getAttribute('data-rona-deals-frame-aligned'),left:rect?.left||0,right:rect?.right||0,width:rect?.width||0};
    });
    return{
      title:{left:title.left,right:title.right,width:title.width},
      inner:{left:inner.left,right:inner.right,width:inner.width},
      anchorClass:document.querySelector('[data-rona-deals-frame-anchor="title"]')?.className||'',
      rects
    };
  });
  assert.ok(frameAlignment.inner.width<frameAlignment.title.width*.5,'fixture must contain a deliberately narrower decorated inner title wrapper');
  assert.match(String(frameAlignment.anchorClass),/qa-title-frame/,'outer title frame must be the alignment authority, never the nested decoration');
  for(const rect of frameAlignment.rects){
    assert.equal(rect.aligned,'true',rect.selector+' must be owned by title-frame alignment');
    assert.ok(Math.abs(rect.left-frameAlignment.title.left)<=1.5,rect.selector+' left edge must match title frame '+JSON.stringify(frameAlignment));
    assert.ok(Math.abs(rect.right-frameAlignment.title.right)<=1.5,rect.selector+' right edge must match title frame '+JSON.stringify(frameAlignment));
  }

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
