import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const must=(ok,msg)=>{if(!ok)throw Error(msg)};
const runtime=await readFile('dist/assets/portal-runtime/client-market-intelligence-v1.js','utf8');
const mark='20261009-client-analytics-authorized-price-bridge-v8';
const stamp='2026-10-09T00:01:00Z';
const row=(product,source='CURRENT',values=[1081,1092,1103])=>({
  publication_id:'CLIENT-QA-20261009',publication_item_id:'SAFE-CHART-'+product,
  published_at:stamp,analytics_as_of:stamp,product,headline:'Опубликованный подтверждённый ряд',
  content_text:'Подтверждённая опубликованная публикация клиентского контура',
  public_chart:{type:'DAILY_SERIES',unit:'USD/т',source_freshness_state:source,
    labels:['2026-10-07','2026-10-08','2026-10-09'],values}
});
let payload={version:'RONA_CLIENT_MARKET_INTELLIGENCE_V1',generated_at:stamp,analytics:[
  row('АИ-92','STALE_SOURCE'),row('СУГ / СПБТ','TO_VERIFY_FRESHNESS')],news:[]};
let mode='OK',requests=0,latencyMs=75;
const html=String.raw`<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body>
<section id="page-analytics" class="page active"><section id="rona-analytics-v2" class="an2">
<section class="rona-visual-hero rona-analytics-hero"><h1>Аналитика</h1></section>
<div class="an2-kpis"><section class="rona-owner-card"><h2>Platts</h2><div class="rona-owner-kpi">21.08.2026</div><div class="rona-owner-muted">Архив</div></section>
<section class="rona-owner-card"><h2>Argus</h2><div class="rona-owner-kpi">1 111</div><div class="rona-owner-muted">Архив</div></section>
<section class="rona-owner-card"><h2>Прогноз</h2><div class="rona-owner-kpi">09.2026</div><div class="rona-owner-muted">Архив</div></section></div>
<section class="rona-owner-card"><div class="an2-controls"><button data-an2-product="AI92">АИ-92</button><button data-an2-product="AI95">АИ-95</button><button data-an2-product="DT">ДТ</button><button data-an2-product="LPG">СУГ</button></div></section>
<div class="an2-main"><section class="rona-owner-card an2-chart"><div data-chart-title>Динамика 21.08.2026</div>
<div data-chart-source>Platts · архив</div><div class="rona-market-chart-metric">1111</div>
<div class="rona-market-chart-stage" data-chart-stage><svg data-chart-svg><text>21.08.2026</text></svg></div>
<aside class="an2-market-forecast"><div class="an2-mf-title">Прогноз на 09.2026</div></aside></section></div>
<section class="rona-owner-card an2-rona"><div class="an2-rona-grid"><section class="rona-owner-card an2-price-card"><h3>CPT Озинки</h3><div class="an2-price-base">—</div><div class="an2-price-range">LOW — · HIGH —</div><div class="an2-price-current">—</div></section></div><div class="an2-model-note">Нет текущих данных</div></section>
<section class="rona-owner-card"><div class="an2-comment">Архивная котировка</div></section>
</section></section>
<script>
window.RONA_ANALYTICS_VIEW={
  product:'AI92',setPayloadCount:0,
  getState(){return {product:this.product,source:'PLATTS'}},
  setPayload(p){
    this.data=p;this.setPayloadCount++;
    const k=p.products[this.product];
    document.querySelectorAll('.an2-kpis .rona-owner-kpi').forEach(n=>n.textContent=p.latestTradeDate);
    document.querySelector('.an2-comment').textContent=k.forecast.comment;
    document.querySelector('[data-chart-title]').textContent=k.dates.length?'Динамика '+this.product:'Нет текущего ряда';
    document.querySelector('.an2-mf-title').textContent='Прогноз: '+k.forecast.month;
    return true;
  }
};
document.querySelector('.an2-controls').addEventListener('click',e=>{
  const b=e.target.closest('[data-an2-product]');
  if(b){RONA_ANALYTICS_VIEW.product=b.dataset.an2Product;
    RONA_ANALYTICS_VIEW.setPayload(RONA_ANALYTICS_VIEW.data)}
});
</script><script src="/client-analytics.js" defer></script></body></html>`;
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('cache-control','no-store');
  if(pathname==='/portal/client'){res.setHeader('content-type','text/html');res.end(html);return}
  if(pathname==='/client-analytics.js'){res.setHeader('content-type','application/javascript');res.end(runtime);return}
  if(pathname==='/portal/api/v1/client/market-intelligence'){
    requests++;
    const status=mode,b=structuredClone(payload);
    setTimeout(()=>{if(res.destroyed)return;res.setHeader('content-type','application/json');
      if(status==='ERROR'){res.statusCode=503;res.end(JSON.stringify({ok:false,code:'FEED_UNAVAILABLE'}))}
      else res.end(JSON.stringify({ok:true,data:b}))},latencyMs);
    return;
  }
  res.statusCode=404;res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1170,height:657}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/portal/client',{waitUntil:'domcontentloaded'});
  const owner='#page-analytics > #rona-analytics-v2';
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset.renderState==='PUBLISHED_CURRENT_ONLY',null,{timeout:10000});
  const first=await page.evaluate(()=>{
    const c=document.querySelector('#rona-analytics-v2');
    return{owner:c?.dataset.ronaClientAnalyticsVisualOwner,display:c?getComputedStyle(c).display:null,
      substitute:document.querySelectorAll('[data-rona-client-market-intelligence-owner="analytics"]').length,
      svgHidden:c?.querySelector('[data-chart-svg]')?getComputedStyle(c.querySelector('[data-chart-svg]')).visibility==='hidden':null,oldVisible:c?.innerText.includes('21.08.2026')||
        c?.innerText.includes('09.2026')||c?.innerText.includes('1 111'),
      values:window.RONA_ANALYTICS_VIEW?.data?.products?.AI92?.values};
  });
  must(first.owner==='canonical-v7'&&first.display!=='none'&&!first.substitute&&first.svgHidden&&!first.oldVisible,
    'SOURCE_SAFE_CANONICAL_VISUAL_NOT_RESTORED '+JSON.stringify(first));
  must(first.values.length===0,'STALE_SOURCE_ROW_WAS_PUBLISHED');
  // Published price authority belongs to the selected client's existing Price page,
  // never to the Admin canonical price snapshot or a cross-tenant memory cache.
  await page.evaluate(()=>{
    window.RONA_CLIENT_CONTEXT={getCurrentContext:()=>({client_id:'A',contract_id:'C1'})};
    window.__RONA_CLIENT_PRICE_SYNC_STATE__={authority:'SERVER_AUTHORITATIVE_PRICE_PROJECTION',
      context:{client_id:'A',contract_id:'C1'},loadedAt:new Date().toISOString(),
      prices:[{product:'АИ-92',basis:'CPT Озинки',price:1242.75,currency:'USD'}]};
    window.dispatchEvent(new Event('rona:client-prices-updated'));
  });
  await page.waitForFunction(()=>document.querySelector('.an2-price-current')?.textContent?.includes('242,75'),null,{timeout:5500});
  const priced=await page.evaluate(()=>({text:document.querySelector('.an2-price-current')?.textContent||'',
    base:document.querySelector('.an2-price-base')?.textContent,
    range:document.querySelector('.an2-price-range')?.textContent,
    authority:document.querySelector('.an2-rona')?.dataset.ronaClientPriceAuthority,
    source:document.querySelector('.an2-price-card')?.dataset.ronaClientPriceSource}));
  must(priced.text.includes('1')&&priced.text.includes('242,75')&&priced.text.includes('USD/т')&&
    priced.authority==='SERVER_AUTHORITATIVE_PRICE_PROJECTION'&&priced.source==='PUBLISHED_CURRENT_CONTRACT'&&
    priced.base==='—'&&!priced.range.includes('1242'),
    'AUTHORIZED_CLIENT_PRICE_NOT_PAINTED '+JSON.stringify(priced));
  await page.evaluate(()=>{
    window.RONA_CLIENT_CONTEXT={getCurrentContext:()=>({client_id:'B',contract_id:'C2'})};
    window.dispatchEvent(new Event('rona:client-prices-updated'));
  });
  await page.waitForFunction(()=>document.querySelector('.an2-price-current')?.textContent==='—',null,{timeout:5500});
  const foreign=await page.evaluate(()=>({text:document.querySelector('.an2-price-current')?.textContent,
    source:document.querySelector('.an2-price-card')?.dataset.ronaClientPriceSource||null}));
  must(foreign.text==='—'&&foreign.source===null,'CROSS_TENANT_PRICE_LEAK '+JSON.stringify(foreign));
  await page.evaluate(()=>{
    window.RONA_CLIENT_CONTEXT={getCurrentContext:()=>({client_id:'A',contract_id:'C1'})};
    window.__RONA_CLIENT_PRICE_SYNC_STATE__={authority:'SERVER_AUTHORITATIVE_PRICE_PROJECTION',
      context:{client_id:'A',contract_id:'C1'},loadedAt:new Date().toISOString(),
      prices:[{product:'АИ-92',basis:'CPT Озинки',price:1201.11,currency:'USD'},
        {product:'АИ-92',basis:'CPT Озинки',price:1202.22,currency:'USD'}]};
    window.dispatchEvent(new Event('rona:client-prices-updated'));
  });
  await page.waitForFunction(()=>document.querySelector('.an2-price-current')?.textContent?.includes('Несколько'),null,{timeout:5500});
  must(!(await page.locator('.an2-price-current').innerText()).includes('1201'),
    'AMBIGUOUS_PRICE_AUTO_SELECTED');
  console.log('CLIENT_CANONICAL_PUBLISHED_CONTRACT_PRICES_V8=PASS '+JSON.stringify({priced,foreign}));
  payload={...payload,generated_at:'2026-10-09T00:02:00Z',analytics:[row('АИ-92')]};
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>window.RONA_ANALYTICS_VIEW?.data?.products?.AI92?.values?.at(-1)===1103,null,{timeout:10000});
  must(await page.locator(owner+' [data-chart-svg]').isVisible(),'CANONICAL_APPROVED_SERIES_CHART_NOT_SHOWN');
  must(await page.locator(owner).count()===1,'CANONICAL_VISUAL_OWNER_WAS_REPLACED');
  payload={...payload,generated_at:'2026-10-09T00:03:00Z',analytics:[row('АИ-92','CURRENT',[1081,1092,1145])]};
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>window.RONA_ANALYTICS_VIEW?.data?.products?.AI92?.values?.at(-1)===1145,null,{timeout:10000});
  mode='ERROR';latencyMs=40;
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset.renderState==='ERROR_NO_ARCHIVE',null,{timeout:10000});
  const failure=await page.evaluate(()=>({
    safe:document.querySelector('#rona-analytics-v2')?.dataset.ronaClientSourceSafe,
    series:window.RONA_ANALYTICS_VIEW?.data?.products?.AI92?.values,
    title:document.querySelector('[data-chart-title]')?.textContent,
    ownerCount:document.querySelectorAll('#rona-analytics-v2').length,
    substitute:document.querySelectorAll('[data-rona-client-market-intelligence-owner="analytics"]').length
  }));
  must(failure.safe==='1'&&failure.ownerCount===1&&!failure.substitute&&!failure.series.length,
    'CANONICAL_ERROR_NOT_FAIL_CLOSED '+JSON.stringify(failure));
  must(errors.length===0,'UNCAUGHT_CLIENT_JS_ERRORS '+errors.join('; '));
  must(!runtime.includes('setInterval('),'FORBIDDEN_BACKGROUND_POLLING');
  console.log('CLIENT_SOURCE_SAFE_CANONICAL_V7=PASS '+JSON.stringify({first,failure,requests}));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
