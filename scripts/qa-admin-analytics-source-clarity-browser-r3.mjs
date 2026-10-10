import http from 'node:http';
import {chromium} from 'playwright';
import {onRequest as renderAnalytics} from '../functions/portal/analytics-v2-ui.js';

const assert=(truth,message)=>{if(!truth)throw new Error(message)};
const script=await (await renderAnalytics({})).text();
let mode='OK',requests=0;
const forecast=(month,base,low,high,sourceRef='https://t.me/platts_digits/7510')=>
  ({month,base,low,high,forward:base,reference:base,sourceRef,direction:'РОСТ',confidence:'СРЕДНЯЯ',curveType:'PLATTS_NOV'});
const term=(key)=>({
  kind:'OBSERVATION_DAILY',sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
  asOfDate:'07.10.2026',sourceRef:'https://t.me/platts_digits/7510',
  sourceDocId:'TG-PLATTS-CF27D158005EDC786FCBDB98',
  indexName:key==='DT'?'Composite ULSD 10 ppmS FOB ARA + CIF NWE Cargo Financial':'Propane CIF NWE Large Cargo Financial',
  basis:key==='DT'?'Composite FOB ARA + CIF NWE':'CIF NWE Large Cargo Financial',
  unit:'USD/т',dates:['10.2026','11.2026','12.2026'],
  deliveryMonths:['2026-10','2026-11','2026-12'],
  values:key==='DT'?[1403.125,1370,1328]:[775,725,698.5],
  observationCount:3
});
const dates={
  DT:['2026-08-26','2026-08-27','2026-08-28','2026-09-17','2026-09-18','2026-09-23','2026-09-24','2026-09-25','2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-06','2026-10-08'],
  LPG:['2026-08-26','2026-08-27','2026-08-28','2026-09-17','2026-09-18','2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-29','2026-10-01','2026-10-05','2026-10-06','2026-10-07']
};
const observed={
  DT:[1275.75,1247.75,1310.25,1523.25,1545,1505,1541,1482.75,1450.5,1396.25,1464,1449.25,1323,1476.25],
  LPG:[539,544.5,556.5,651,649,641,643,657.5,685,669,674,716,758,749,775]
};
const daily=(key)=>({
  version:'RONA_MARKET_OBSERVED_DAILY_V1',
  granularity:'OBSERVATION_DATE',sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
  noInterpolation:true,notMonthlyMaturityCurve:true,
  observedDates:dates[key],
  observationCount:dates[key].length,availableTotal:dates[key].length,segmentIds:dates[key].map((_,i)=>i<3?0:1),segmentCount:2,historyIncludesAllGapSegments:true,
  firstAsOf:'26.08.2026',
  lastAsOf:key==='DT'?'08.10.2026':'07.10.2026',
  status:'VERIFIED_DAILY_OBSERVATIONS',
  deliveryMonth:key==='DT'?null:'2026-10',sourceGap:true,
  instrument:key==='DT'?'DIESEL_PLATTS_ULSD_CIF_NWE_PHYSICAL_COMPONENT'
                       :'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY'
});
const canon={
  version:'RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',
  cutoff:'07.10.2026',latestTradeDate:'07.10.2026',
  products:{
    AI92:{name:'АИ-92',dates:['07.10'],values:[1261.75],forecast:forecast('2026-11',1097.75,1027,1195.75),rona:{reference:1261.75,bases:[['CPT Озинки',1200]]}},
    AI95:{name:'АИ-95',dates:['07.10'],values:[1301.75],forecast:forecast('2026-11',1137.75,1067,1235.75),rona:{reference:1301.75,bases:[['CPT Озинки',1240]]}},
    DT:{name:'ДТ',dates:dates.DT.map(d=>d.slice(8)+'.'+d.slice(5,7)),values:observed.DT,
      basis:'Platts Diesel ULSD Cargoes CIF NWE/Basis ARA · physical component',
      dailyMonitor:daily('DT'),termCurve:term('DT'),
      forecast:forecast('2026-11',1370,1328,1403.125),
      rona:{reference:1270.0833333,bases:[['CPT Озинки',1280],['CPT Сарыагаш',1385]]}},
    LPG:{name:'LPG / СУГ',dates:dates.LPG.map(d=>d.slice(8)+'.'+d.slice(5,7)),values:observed.LPG,
      basis:'Platts Propane CIF NWE Large Cargo Financial · поставка 10.2026',
      dailyMonitor:daily('LPG'),termCurve:term('LPG'),
      forecast:forecast('2026-11',725,698.5,775),
      rona:{reference:725,bases:[['CPT Озинки',610],['CPT Сарыагаш',745]]},
      regionalBenchmark:{date:'25.08.2026',low:725,base:753,high:780}}
  }
};
const html='<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><main id="page-analytics" class="page active"></main><script src="/analytics.js"></script></body></html>';
const server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('cache-control','no-store');
  if(path==='/portal/admin'){res.setHeader('content-type','text/html; charset=utf-8');res.end(html);return}
  if(path==='/analytics.js'){res.setHeader('content-type','application/javascript; charset=utf-8');res.end(script);return}
  if(path==='/portal/api/v1/admin/analytics'){
    requests++;
    if(mode==='ERROR'){res.statusCode=502;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,code:'ANALYTICS_BOOTSTRAP_FAILED'}));return}
    res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,data:{canonicalAnalytics:canon}}));return;
  }
  res.statusCode=404;res.end('not found');
});
await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done)});
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v3',{timeout:15000});
  assert(requests>0,'real UI never fetched Analytics API');
  await page.locator('#rona-analytics-v2 [data-product="DT"]').click();
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset?.ronaChartKind==='OBSERVATION_DAILY'&&document.querySelector('#rona-analytics-v2 [data-chart-title]')?.textContent?.includes('ДТ'),{timeout:8000});
  const dt=await page.evaluate(()=>{
    const root=document.querySelector('#rona-analytics-v2');
    return {
      forecast:root.querySelector('.an2-market-forecast')?.innerText||'',
      chart:root.querySelector('[data-chart-stage]')?.innerText||'',
      title:root.querySelector('[data-chart-title]')?.textContent||'',
      source:root.querySelector('[data-chart-source]')?.textContent||'',
      chartKind:root.dataset.ronaChartKind,
      chartSource:root.dataset.ronaChartSource,
      heading:root.querySelector('.an2-rona h2')?.textContent||'',
      prices:Array.from(root.querySelectorAll('.an2-price-base')).map(x=>x.textContent),
      kpis:Array.from(root.querySelectorAll('.an2-kpis .rona-owner-kpi')).map(x=>x.textContent),
      data:document.documentElement.dataset.ronaAnalyticsData
    }
  });
  assert(dt.forecast.includes('2026-11'),'DT November forecast was not rendered: '+dt.forecast.slice(0,160));
  assert(dt.forecast.replaceAll(String.fromCharCode(160),' ').includes('1 370'),'DT source-backed BASE 1370 missing: '+dt.forecast.slice(0,160));
  const debug=await page.evaluate(()=>{
    const root=document.querySelector('#rona-analytics-v2');
    const ctl=root?.querySelector('.an2-controls button[data-product="DT"]');
    const stage=root?.querySelector('[data-chart-stage]');
    return {state:window.RONA_ANALYTICS_VIEW?.getState?.(),documentVersion:window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__,
      rootPresent:!!root,stagePresent:!!stage,stageHtml:stage?.outerHTML.slice(0,4500),
      closestMatches:!!ctl?.closest('#rona-analytics-v2 .an2-controls button[data-product]'),
      dataset:document.documentElement.dataset.ronaAnalyticsData,priceMode:root?.querySelector('.an2-rona')?.dataset?.pricingMode};
  });
  console.log('DT_BROWSER_DEBUG',JSON.stringify({debug,errors}));
  assert(dt.title.includes('Динамика ДТ'),'DT graph must be an observed-day physical component, not monthly maturity: '+JSON.stringify(dt));
  assert(dt.chartKind==='OBSERVATION_DAILY','DT daily observed series not rendered: '+JSON.stringify({dt,debug,errors}));
  assert(dt.source.includes('26.08.2026')&&dt.source.includes('08.10.2026')&&dt.source.includes('CIF NWE'),'DT chart provenance/basis absent: '+dt.source);
  assert(!dt.chart.includes('Нет актуального подтверждённого ряда'),'DT daily observed series must not be shown empty');
  assert(dt.heading.includes('2026-11'),'DT RONA scenario prices were not updated');
  assert(dt.prices.length>0&&dt.prices.every(x=>x!=='—'&&x.trim()),'DT owner-authoritative scenario prices suppressed despite source model');
  const dtInsight=(await page.locator('#rona-analytics-v2 .an2-comment').innerText()).replace(/[\s\u00a0]+/g,' ');
  assert(dtInsight.includes('BASE 1 370,00')&&dtInsight.includes('физическому компоненту')&&dtInsight.includes('некорректно'), 'DT basis-safe insight missing '+dtInsight);
  const dtGeometry=await page.evaluate(()=>{
    const r=document.querySelector('#rona-analytics-v2');
    const points=[...r.querySelectorAll('circle.rmc-point')];
    return {points:points.length,lines:r.querySelectorAll('path.rmc-line').length,
      labels:[...r.querySelectorAll('text.rmc-point-label')].filter(x=>getComputedStyle(x).display!=='none').length};
  });
  assert(dtGeometry.points===14&&dtGeometry.lines===12&&dtGeometry.labels<14,'DT daily gap and label geometry invalid: '+JSON.stringify(dtGeometry));
  await page.locator('#rona-analytics-v2 [data-product="LPG"]').click();
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset?.ronaChartKind==='OBSERVATION_DAILY'&&document.querySelector('#rona-analytics-v2 [data-chart-title]')?.textContent?.includes('СУГ')&&document.querySelector('#rona-analytics-v2 .an2-kpis .rona-owner-card:nth-child(2) .rona-owner-kpi')?.textContent?.includes('Нет актуальных данных'),{timeout:8000});
  const lpg=await page.evaluate(()=>{
    const root=document.querySelector('#rona-analytics-v2');
    const chartSvg=root.querySelector('.rona-market-chart-svg');
    const labels=[...(chartSvg?.querySelectorAll('text.rmc-point-label')||[])];
    const points=[...(chartSvg?.querySelectorAll('circle.rmc-point')||[])];
    const note=root.querySelector('.an2-comment');
    return {insight:note?.innerText||'',
      technicalFooterVisible:note?.nextElementSibling?.classList?.contains('rona-owner-muted')?
        getComputedStyle(note.nextElementSibling).display!=='none':null,
      pointTitles:points.filter(p=>p.querySelector('title')&&p.hasAttribute('aria-label')).length,
      visibleLabels:labels.filter(l=>getComputedStyle(l).display!=='none').length,
      pointXs:points.map(p=>Number(p.getAttribute('cx'))),
      forecast:root.querySelector('.an2-market-forecast')?.innerText||'',
      regional:Array.from(root.querySelectorAll('.an2-kpis .rona-owner-card')).at(1)?.innerText||'',
      chart:root.querySelector('[data-chart-source]')?.textContent||'',
      title:root.querySelector('[data-chart-title]')?.textContent||'',
      chartKind:root.dataset.ronaChartKind,
      source:root.dataset.ronaChartSource,gapCount:root.dataset.ronaSourceGapSegments,
      points:root.querySelectorAll('circle.rmc-point').length,lines:root.querySelectorAll('path.rmc-line').length}
  });
  assert(lpg.forecast.includes('2026-11'),'LPG November forecast missing');
  assert(lpg.forecast.includes('725'),'LPG November Platts BASE 725 missing');
  assert(lpg.regional.includes('Нет актуальных данных'),'August Petromarket benchmark still shown as current: '+lpg.regional);
  assert(lpg.regional.includes('25.08.2026'),'Historical LPG regional source date must remain disclosed');
  assert(lpg.chart.includes('07.10')&&lpg.chart.includes('CIF NWE Large Cargo Financial'),'LPG verified observation date/basis missing: '+lpg.chart);
  assert(lpg.title.includes('Динамика СУГ'),'LPG main chart must use day of observation: '+lpg.title);
  assert(lpg.chartKind==='OBSERVATION_DAILY','LPG observed-day point not rendered');
  assert(lpg.gapCount==='2'&&lpg.points===15&&lpg.lines===13,'LPG dates/gap rendering mismatch '+JSON.stringify(lpg));
  assert(lpg.pointTitles===15,'Missing hover/source detail for compressed observation labels');
  assert(lpg.visibleLabels<15,'All LPG value labels overlap instead of compacting');
  assert(lpg.pointXs.every((x,i,a)=>i===0||x>a[i-1]),'LPG x positions not actual ascending observation dates');
  assert(lpg.insight.includes('539,00')&&lpg.insight.includes('775,00')&&lpg.insight.includes('BASE 725,00'),'LPG source-locked analytical interpretation incomplete: '+lpg.insight);
  assert(lpg.insight.includes('разные месяцы поставки')&&lpg.insight.includes('пропуски'),'LPG month-basis/gaps disclosure missing: '+lpg.insight);
  assert(!lpg.insight.includes('https://')&&!lpg.insight.includes('RONA_CLIENT_ADMIN'),'Technical IDs/links leaked in Admin conclusion: '+lpg.insight);
  assert(lpg.technicalFooterVisible===false,'Admin conclusion technical footer remains visible');
  const chartHealth=()=>page.evaluate(()=>{
    const root=document.querySelector('#rona-analytics-v2'),svg=root?.querySelector('.rona-market-chart-svg');
    const points=[...(svg?.querySelectorAll('circle.rmc-point')||[])];
    return {product:window.RONA_ANALYTICS_VIEW?.getState?.()?.product,
      owner:svg?.dataset?.ronaAdminSingleOwner||'',
      signature:svg?.dataset?.ronaAdminChartSignature||'',
      legacyRepaint:svg?.dataset?.ronaLpgHistoryV13||'',
      points:points.length,lines:svg?.querySelectorAll('path.rmc-line').length||0,
      areas:svg?.querySelectorAll('path.rmc-area').length||0,
      labels:points.filter(p=>p.querySelector('title')&&p.hasAttribute('aria-label')).length,
      gaps:root?.dataset?.ronaSourceGapSegments,
      gapInterpolation:root?.dataset?.ronaGapInterpolation,
      x:points.map(p=>Number(p.getAttribute('cx')))};
  });
  const checkExclusive=async(product,points,lines)=>{
    await page.waitForFunction(({p,n,l})=>{
      const root=document.querySelector('#rona-analytics-v2'),svg=root?.querySelector('.rona-market-chart-svg');
      return window.RONA_ANALYTICS_VIEW?.getState?.()?.product===p&&
        svg?.dataset?.ronaAdminSingleOwner==='20261010-admin-r3-exclusive-chart-owner-r4'&&
        svg.querySelectorAll('circle.rmc-point').length===n&&
        svg.querySelectorAll('path.rmc-line').length===l&&
        svg.querySelectorAll('path.rmc-area').length===0&&
        !svg.dataset.ronaLpgHistoryV13;
    },{p:product,n:points,l:lines},{timeout:8000});
    const h=await chartHealth();
    assert(h.owner==='20261010-admin-r3-exclusive-chart-owner-r4'&&h.areas===0&&h.legacyRepaint==='',
      'unexpected duplicate legacy SVG owner '+JSON.stringify(h));
    assert(h.points===points&&h.lines===lines&&h.labels===points,'source date/values modified '+JSON.stringify(h));
    assert(h.gapInterpolation==='OFF','unverified gap interpolated '+JSON.stringify(h));
    return h;
  };
  await checkExclusive('LPG',15,13);
  for(const product of ['DT','LPG','DT','LPG']){
    await page.evaluate(key=>window.RONA_ANALYTICS_VIEW.setProduct(key),product);
    await checkExclusive(product,product==='LPG'?15:14,product==='LPG'?13:12);
    await page.evaluate(()=>window.RONA_ANALYTICS_VIEW.render());
    await checkExclusive(product,product==='LPG'?15:14,product==='LPG'?13:12);
  }
  console.log('ADMIN_ANALYTICS_R4_EXCLUSIVE_SVG_REPAINT=PASS');

  mode='ERROR';
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='SOURCE_UNAVAILABLE',{timeout:8000});
  const failureText=await page.locator('#rona-analytics-v2 .an2-market-forecast').innerText();
  assert(failureText.includes('Прогноз недоступен'),'Outage must never fall back to stale September forecast');
  const failedInsight=await page.locator('#rona-analytics-v2 .an2-comment').innerText();
  assert(failedInsight.includes('Аналитический вывод недоступен'),'Stale conclusion visible after source failure: '+failedInsight);
  mode='OK';
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v3'&&document.querySelectorAll('#rona-analytics-v2 circle.rmc-point').length===15,{timeout:10000});
  const recovered=await page.locator('#rona-analytics-v2 .an2-comment').innerText();
  assert(recovered.includes('BASE 725,00')&&recovered.includes('775,00'),'Same-signature source recovery did not restore full analysis: '+recovered);
  console.log('ADMIN_ANALYTICS_SOURCE_RECOVERY_SAME_SIGNATURE=PASS');

  for(const product of ['AI92','AI95']){
    await page.locator('#rona-analytics-v2 [data-product="'+product+'"]').click();
    await page.waitForFunction(k=>window.RONA_ANALYTICS_VIEW?.getState?.()?.product===k&&
      document.querySelector('#rona-analytics-v2 .an2-comment')?.textContent?.includes('одно подтверждённое наблюдение'),
      product,{timeout:8000});
    const outcome=await page.evaluate(()=>{
      const r=document.querySelector('#rona-analytics-v2');
      return {state:window.RONA_ANALYTICS_VIEW.getState(),insight:r.querySelector('.an2-comment')?.textContent,
        forecast:r.querySelector('.an2-market-forecast')?.innerText,
        prices:[...r.querySelectorAll('.an2-price-base')].map(x=>x.innerText)};
    });
    assert(outcome.insight.includes('BASE ')&&outcome.insight.includes('Разница BASE'),'Gasoline '+product+' scenario/fact interpretation missing '+JSON.stringify(outcome));
    assert(!outcome.insight.includes('RONA_CLIENT_ADMIN')&&!outcome.insight.includes('https://'),
      'Gasoline '+product+' service internals leaked into conclusion');
    assert(outcome.forecast.includes('2026-11')&&outcome.prices.length>0,
      'Gasoline '+product+' forecast/pricing missing');
    console.log('ADMIN_ANALYTICS_FUEL_'+product+'_INSIGHT=PASS');
  }
  const sources=await page.evaluate(()=>[...document.querySelectorAll('#rona-analytics-v2 .an2-controls button[data-source]')]
    .map(x=>({key:x.getAttribute('data-source'),text:x.textContent.trim()})));
  console.log('ADMIN_ANALYTICS_SOURCE_CONTROLS',JSON.stringify(sources));
  const argus=sources.find(x=>x.key==='ARGUS');
  if(argus){
    await page.locator('#rona-analytics-v2 .an2-controls button[data-source="ARGUS"]').click();
    await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2 .an2-comment')?.textContent?.includes('Источник Argus выбран'),
      {timeout:8000});
    const insight=await page.locator('#rona-analytics-v2 .an2-comment').innerText();
    assert(!insight.includes('BASE 1 097,75'),'Unproven Argus mixed with Platts facts');
    console.log('ADMIN_ANALYTICS_ARGUS_SOURCE_SAFE_CONCLUSION=PASS');
  }

  assert(errors.length===0,'Uncaught browser errors: '+errors.join('; '));
  console.log('ADMIN_ANALYTICS_SOURCE_CLARITY_R3=PASS');
  console.log(JSON.stringify({result:'PASS',browser:'chromium',real_ui_response:true,dt_month:'2026-11',dt_base:1370,dt_chart:'OBSERVATION_DAILY_DT',dt_owner_prices:'SOURCE_LOCKED',lpg_month:'2026-11',lpg_base:725,lpg_petromarket:'STALE_HIDDEN',lpg_chart:'OBSERVATION_DAILY_LPG',api_failure:'FAIL_CLOSED',pageerrors:errors.length,requests}));
}finally{
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
}
