import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const must=(ok,msg)=>{if(!ok)throw Error(msg)};
const runtime=await readFile('dist/assets/portal-runtime/client-market-intelligence-v1.js','utf8');
const mark='20261009-admin-canonical-shared-presenter-v14';
const sharedFile=await readFile('functions/portal/analytics-canonical-presenter-v14.js','utf8');
const sharedMatch=sharedFile.match(/export const SHARED_ANALYTICS_PRESENTER_V14=String.raw`([\s\S]*?)`;/);
if(!sharedMatch||!sharedMatch[1].includes('ADMIN_APPROVED_SHARED_V14'))throw Error('SHARED_ADMIN_PRESENTER_NOT_FOUND');
const adminModule=await readFile('functions/portal/analytics-v2-ui.js','utf8');
const bridgeMatch=adminModule.match(/export const CANONICAL_PRICING_BRIDGE_RUNTIME=String.raw`([\s\S]*?)`;/);
const gapModule=await readFile('functions/portal/lpg-observation-gap-runtime-v13.js','utf8');
const gapMatch=gapModule.match(/export const LPG_GAP_RUNTIME=String.raw`([\s\S]*?)`;/);
if(!bridgeMatch||!gapMatch)throw Error('EXACT_ADMIN_RUNTIME_CONTRACT_BROKEN');
const sharedRuntime=bridgeMatch[1]+sharedMatch[1]+gapMatch[1];

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
<section class="rona-owner-card an2-rona"><div class="an2-rona-head"><h2>Возможные цены RONA Trade на нет текущих данных</h2><span class="rona-fin-pill">INDICATIVE</span></div><div class="an2-rona-grid"><section class="rona-owner-card an2-price-card"><h3>CPT Озинки</h3><div class="an2-price-base">—</div><div class="an2-price-range">LOW — · HIGH —</div><div class="an2-price-current">—</div></section></div><div class="an2-model-note">Нет текущих данных</div></section>
<section class="rona-owner-card"><div class="an2-comment">Архивная котировка</div></section>
</section></section>
<script>
window.RONA_ANALYTICS_VIEW={
  product:'AI92',setPayloadCount:0,
  getState(){return {product:this.product,source:'PLATTS'}},
  setProduct(key){this.product=key;this.setPayload(this.data);return true},
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
  if(b)RONA_ANALYTICS_VIEW.setProduct(b.dataset.an2Product)
});
</script><script src="/client-analytics.js" defer></script></body></html>`;
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('cache-control','no-store');
  if(pathname==='/portal/client'){res.setHeader('content-type','text/html');res.end(html);return}
  if(pathname==='/client-analytics.js'){res.setHeader('content-type','application/javascript');res.end(runtime);return}
  if(pathname==='/portal/analytics-client-approved-runtime-v14'){res.setHeader('content-type','application/javascript; charset=utf-8');res.end(sharedRuntime);return}
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
  await page.waitForFunction(()=>window.RONA_ANALYTICS_PRESENTER_V14?.version==='ADMIN_APPROVED_SHARED_V14',null,{timeout:9000});
  const first=await page.evaluate(()=>{
    const c=document.querySelector('#rona-analytics-v2');
    return{owner:c?.dataset.ronaClientAnalyticsVisualOwner,display:c?getComputedStyle(c).display:null,
      substitute:document.querySelectorAll('[data-rona-client-market-intelligence-owner="analytics"]').length,
      svgHidden:c?.querySelector('[data-chart-svg]')?getComputedStyle(c.querySelector('[data-chart-svg]')).visibility==='hidden':null,oldVisible:c?.innerText.includes('21.08.2026')||
        c?.innerText.includes('09.2026')||c?.innerText.includes('1 111'),
      values:window.RONA_ANALYTICS_PRESENTER_V14?.getPayload?.()?.products?.AI92?.values};
  });
  must(first.owner==='canonical-v7'&&first.display!=='none'&&!first.substitute&&first.svgHidden&&!first.oldVisible,
    'SOURCE_SAFE_CANONICAL_VISUAL_NOT_RESTORED '+JSON.stringify(first));
  must(first.values.length===0,'STALE_SOURCE_ROW_WAS_PUBLISHED');
  // Exact Admin parity: the Client contract-price projection cannot replace
  // the Analytics canonical values. The same approved model owns pricing.
  payload={...payload,generated_at:'2026-10-09T00:02:00Z',analytics:[row('АИ-92')],clientCanonicalAnalytics:{"version":"RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1","cutoff":"09.10.2026","latestTradeDate":"09.10.2026","products":{"AI92":{"name":"АИ-92","basis":"Platts Source Confirmed","dates":["07.10","08.10","09.10"],"values":[1081,1092,1103],"rona":{"reference":1103,"bases":[["CPT Озинки",1223.17],["CPT Сарыагаш",1332.1],["CPT Наушки",1280.91]]},"forecast":{"month":"2026-11","low":1027,"base":1097.75,"high":1195,"forward":1097.75,"sourceRef":"QA-SOURCE-20261009"}},"AI95":{"name":"АИ-95","dates":[],"values":[]},"DT":{"name":"ДТ","dates":[],"values":[]},"LPG":{"name":"СУГ","dates":[],"values":[]}}}};
  payload.analyticsCanonicalParity='ADMIN_APPROVED_SHARED_V14';
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>window.RONA_ANALYTICS_PRESENTER_V14?.getPayload?.()?.products?.AI92?.values?.at(-1)===1103,null,{timeout:10000});
  must(await page.locator(owner+' [data-chart-svg]').isVisible(),'CANONICAL_APPROVED_SERIES_CHART_NOT_SHOWN');
  must(await page.locator(owner).count()===1,'CANONICAL_VISUAL_OWNER_WAS_REPLACED');
  payload={...payload,generated_at:'2026-10-09T00:03:00Z',analytics:[row('АИ-92','CURRENT',[1081,1092,1145])],clientCanonicalAnalytics:{...payload.clientCanonicalAnalytics,products:{...payload.clientCanonicalAnalytics.products,AI92:{...payload.clientCanonicalAnalytics.products.AI92,values:[1081,1092,1145]}}}};
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>window.RONA_ANALYTICS_PRESENTER_V14?.getPayload?.()?.products?.AI92?.values?.at(-1)===1145,null,{timeout:10000});
  // The main chart is a DATE-OF-OBSERVATION monitor, never a three-maturity curve.
  // Monthly LOW/BASE/HIGH remains separately sourced on the right-hand side.
  const dailyFixture=(name,days,values,forecastBase,forecastLow,forecastHigh,
    spotFreshness,instrument,deliveryMonth,status,sourceGap=false)=>({
    name,basis:name==='ДТ'
      ?'Platts Diesel ULSD 10 ppm · Cargoes CIF NWE/Basis ARA · физический компонент, не композит БНК'
      :'Platts Propane CIF NWE Large Cargo Financial · поставка 10.2026',
    spotFreshness,dates:days,values,
    dailyMonitor:{
      version:'RONA_MARKET_OBSERVED_DAILY_V1',
      granularity:'OBSERVATION_DATE',sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
      unit:'USD/т',instrument,observationCount:days.length,
      availableTotal:days.length+(sourceGap?3:0),
      firstAsOf:days[0]+'.2026',lastAsOf:days.at(-1)+'.2026',
      referenceDate:'08.10.2026',status,sourceGap,deliveryMonth,noInterpolation:true,
      notMonthlyMaturityCurve:true,observedDates:days.map(d=>'2026-10-'+d.slice(0,2))
    },
    forecast:{
      month:'2026-11',low:forecastLow,base:forecastBase,high:forecastHigh,
      forward:forecastBase,sourceRef:'https://t.me/platts_digits/7510',
      comment:'Индикативный прогноз (отдельно от дневного графика)'
    },
    // A valid finance curve may be provided as forecast metadata but MUST NOT
    // override the primary daily series dates.
    termCurve:{
      kind:'FORWARD_TERM_STRUCTURE',sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
      asOfDate:'07.10.2026',sourceDocId:'QA-PLATTS-CONFIRMED',
      sourceRef:'https://t.me/platts_digits/7510',indexName:'Financial',
      dates:['10.2026','11.2026','12.2026'],
      values:[forecastHigh,forecastBase,forecastLow],
      deliveryMonths:['2026-10','2026-11','2026-12'],observationCount:3
    }
  });
  payload={
    ...payload,generated_at:'2026-10-09T00:04:00Z',
    clientCanonicalAnalytics:{
      ...payload.clientCanonicalAnalytics,
      products:{
        ...payload.clientCanonicalAnalytics.products,
        DT:dailyFixture('ДТ',['01.10','06.10','08.10'],
          [1449.25,1323,1476.25],1370,1328,1403.125,
          'STALE_SOURCE','DIESEL_PLATTS_ULSD_CIF_NWE_PHYSICAL_COMPONENT',null,
          'VERIFIED_DAILY_OBSERVATIONS'),
        LPG:dailyFixture('СУГ / СПБТ',['25.07','27.07','29.08','07.10'],[680,692,715,775],
          725,698.5,775,'TO_VERIFY_FRESHNESS',
          'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY','2026-10',
          'VERIFIED_DAILY_OBSERVATIONS',true)
      }
    }
  };
  payload.clientCanonicalAnalytics.products.LPG.dailyMonitor={
    ...payload.clientCanonicalAnalytics.products.LPG.dailyMonitor,
    observedDates:['2026-07-25','2026-07-27','2026-08-29','2026-10-07'],
    segmentIds:[0,0,1,2],gapBeforeDays:[0,2,33,39],
    segmentCount:3,historyIncludesAllGapSegments:true,availableTotal:4
  };
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>
    window.RONA_ANALYTICS_PRESENTER_V14?.getPayload?.()?.products?.DT?.dailyMonitor?.sourceStatus==='CONFIRMED',
    null,{timeout:10000});
  for(const [key,label,expectedLast,expectedSpot,count] of [
    ['DT','ДТ','08.10', 'STALE_SOURCE',3],
    ['LPG','СУГ','07.10','TO_VERIFY_FRESHNESS',4]
  ]){
    await page.evaluate(k=>document.querySelector('[data-an2-product="'+k+'"]')?.click(),key);
    await page.waitForFunction(k=>
      document.querySelector('#rona-analytics-v2')?.dataset.ronaSelectedProduct===k,
      key,{timeout:7000});

    const proof=await page.evaluate(()=>({
      selected:window.RONA_ANALYTICS_VIEW.getState().product,
      heading:document.querySelector('#rona-analytics-v2 [data-chart-title]')?.textContent,
      source:document.querySelector('#rona-analytics-v2 [data-chart-source]')?.textContent,
      status:document.querySelector('#rona-analytics-v2')?.dataset.ronaPhysicalSpotFreshness,
      dates:window.RONA_ANALYTICS_PRESENTER_V14.getPayload().products[
        window.RONA_ANALYTICS_VIEW.getState().product]?.dates,
      values:window.RONA_ANALYTICS_PRESENTER_V14.getPayload().products[
        window.RONA_ANALYTICS_VIEW.getState().product]?.values,
      forecast:window.RONA_ANALYTICS_PRESENTER_V14.getPayload().products[
        window.RONA_ANALYTICS_VIEW.getState().product]?.forecast,
      kpi:document.querySelector('#rona-analytics-v2 .an2-kpis .rona-owner-kpi')?.textContent,
      overlays:document.querySelectorAll(
        '#rona-analytics-v2 [data-chart-stage] .an2-empty').length,
      svgHidden:getComputedStyle(document.querySelector(
        '#rona-analytics-v2 [data-chart-svg]')).visibility==='hidden',
      gapHistory:document.querySelector('#rona-analytics-v2')?.dataset.ronaLpgHistorySegments,
      gapRendered:!!document.querySelector('#rona-analytics-v2 svg')?.dataset.ronaLpgHistoryV13,
      lineSegments:document.querySelectorAll('#rona-analytics-v2 path.rmc-line').length,
      markerCount:document.querySelectorAll('#rona-analytics-v2 circle.rmc-point').length
    }));
    must(proof.selected===key && proof.heading.includes('Динамика '+label) &&
      !proof.heading.includes('Форвардная кривая') &&
      proof.dates.length===count && proof.dates.at(-1)===expectedLast &&
      proof.dates.every(d=>/^\d{2}\.\d{2}$/.test(d)) &&
      proof.forecast.month==='2026-11' &&
      proof.overlays===0 &&
      !proof.svgHidden && proof.kpi===expectedLast+'.2026' &&
      (key!=='LPG'||(
        JSON.parse(proof.gapHistory||'null')?.ids?.join(',')==='0,0,1,2')),
      'CLIENT_DAILY_'+key+'_V12_FAILED '+JSON.stringify(proof));
    console.log('CLIENT_DAILY_OBSERVATIONS_'+key+'_V12=PASS '+JSON.stringify(proof));
  }
  // The pre-v12 "no publication" overlay MUST be absent on petrol as well.
  await page.evaluate(()=>document.querySelector('[data-an2-product="AI92"]')?.click());
  await page.waitForFunction(()=>
    document.querySelector('#rona-analytics-v2')?.dataset.ronaSelectedProduct==='AI92',
    null,{timeout:7000});
  must(await page.locator('#rona-analytics-v2 [data-chart-stage] .an2-empty').count()===0,
    'OBSOLETE_NO_DATA_OVERLAY_COVERS_GASOLINE_CHART');
  mode='ERROR';latencyMs=40;
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset.renderState==='ERROR_NO_ARCHIVE',null,{timeout:10000});
  const failure=await page.evaluate(()=>({
    safe:document.querySelector('#rona-analytics-v2')?.dataset.ronaClientSourceSafe,
    series:window.RONA_ANALYTICS_PRESENTER_V14?.getPayload?.()?.products?.AI92?.values,
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
