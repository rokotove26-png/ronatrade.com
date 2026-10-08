import http from 'node:http';
import {chromium} from 'playwright';
import {onRequest as renderAnalytics} from '../functions/portal/analytics-v2-ui.js';

const assert=(truth,message)=>{if(!truth)throw new Error(message)};
const script=await (await renderAnalytics({})).text();
let mode='OK',requests=0;
const forecast=(month,base,low,high,sourceRef='https://t.me/platts_digits/7510')=>
  ({month,base,low,high,forward:base,reference:base,sourceRef,direction:'РОСТ',confidence:'СРЕДНЯЯ',curveType:'PLATTS_NOV'});
const canon={
  version:'RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',
  cutoff:'07.10.2026',latestTradeDate:'07.10.2026',
  products:{
    AI92:{name:'АИ-92',dates:['07.10'],values:[1261.75],forecast:forecast('2026-11',1097.75,1027,1195.75),rona:{reference:1261.75,bases:[['CPT Озинки',1200]]}},
    AI95:{name:'АИ-95',dates:['07.10'],values:[1301.75],forecast:forecast('2026-11',1137.75,1067,1235.75),rona:{reference:1301.75,bases:[['CPT Озинки',1240]]}},
    DT:{name:'ДТ',dates:[],values:[],forecast:forecast('2026-11',1370,1328,1403.125),rona:{reference:1270.0833333,bases:[['CPT Озинки',1280],['CPT Сарыагаш',1385]]}},
    LPG:{name:'LPG / СУГ',dates:['07.10'],values:[725],forecast:forecast('2026-11',725,698.5,775),rona:{reference:725,bases:[['CPT Озинки',610],['CPT Сарыагаш',745]]},
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
  await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v2',{timeout:15000});
  assert(requests>0,'real UI never fetched Analytics API');
  await page.locator('#rona-analytics-v2 [data-product="DT"]').click();
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2 [data-chart-stage]')?.textContent?.includes('Нет актуального подтверждённого ряда'),{timeout:8000});
  const dt=await page.evaluate(()=>{
    const root=document.querySelector('#rona-analytics-v2');
    return {
      forecast:root.querySelector('.an2-market-forecast')?.innerText||'',
      chart:root.querySelector('[data-chart-stage]')?.innerText||'',
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
      rootPresent:!!root,stagePresent:!!stage,stageHtml:stage?.outerHTML.slice(0,500),
      closestMatches:!!ctl?.closest('#rona-analytics-v2 .an2-controls button[data-product]'),
      dataset:document.documentElement.dataset.ronaAnalyticsData,priceMode:root?.querySelector('.an2-rona')?.dataset?.pricingMode};
  });
  console.log('DT_BROWSER_DEBUG',JSON.stringify({debug,errors}));
  assert(dt.chart.includes('Нет актуального подтверждённого ряда'),'Missing DT physical series was represented by stale chart: '+JSON.stringify({chart:dt.chart.slice(0,160),debug,errors}));
  assert(dt.heading.includes('2026-11'),'DT RONA scenario prices were not updated');
  assert(dt.prices.length>0&&dt.prices.every(x=>x!=='—'&&x.trim()),'DT owner-authoritative scenario prices suppressed despite source model');
  await page.locator('#rona-analytics-v2 [data-product="LPG"]').click();
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2 .an2-kpis .rona-owner-card:nth-child(2) .rona-owner-kpi')?.textContent?.includes('Нет актуальных данных'),{timeout:8000});
  const lpg=await page.evaluate(()=>{
    const root=document.querySelector('#rona-analytics-v2');
    return {forecast:root.querySelector('.an2-market-forecast')?.innerText||'',
      regional:Array.from(root.querySelectorAll('.an2-kpis .rona-owner-card')).at(1)?.innerText||'',
      chart:root.querySelector('[data-chart-source]')?.textContent||''}
  });
  assert(lpg.forecast.includes('2026-11'),'LPG November forecast missing');
  assert(lpg.forecast.includes('725'),'LPG November Platts BASE 725 missing');
  assert(lpg.regional.includes('Нет актуальных данных'),'August Petromarket benchmark still shown as current: '+lpg.regional);
  assert(lpg.regional.includes('25.08.2026'),'Historical LPG regional source date must remain disclosed');
  assert(lpg.chart.includes('07.10'),'LPG chart date still misleading: '+lpg.chart);
  mode='ERROR';
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='SOURCE_UNAVAILABLE',{timeout:8000});
  const failureText=await page.locator('#rona-analytics-v2 .an2-market-forecast').innerText();
  assert(failureText.includes('Прогноз недоступен'),'Outage must never fall back to stale September forecast');
  assert(errors.length===0,'Uncaught browser errors: '+errors.join('; '));
  console.log(JSON.stringify({result:'PASS',browser:'chromium',real_ui_response:true,dt_month:'2026-11',dt_base:1370,dt_chart:'SOURCE_ABSENT',dt_owner_prices:'SOURCE_LOCKED',lpg_month:'2026-11',lpg_base:725,lpg_petromarket:'STALE_HIDDEN',api_failure:'FAIL_CLOSED',pageerrors:errors.length,requests}));
}finally{
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
}
