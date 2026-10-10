import http from 'node:http';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {onRequest as renderAnalytics} from '../functions/portal/analytics-v2-ui.js';

// Regression for owner screenshots 2026-10-10 23:35 / 23:35.
// Real verified Sep-Oct source dates: weekends/ordinary unobserved dates have no
// plotted circles; normal gaps must NOT turn a single curve into loose dots.
const assert=(v,m)=>{if(!v)throw new Error(m)};
const script=await (await renderAnalytics({})).text();
const iso={
  DT:['2026-09-17','2026-09-18','2026-09-23','2026-09-24','2026-09-25','2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-06','2026-10-08'],
  LPG:['2026-09-17','2026-09-18','2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-29','2026-10-01','2026-10-05','2026-10-06','2026-10-07']
};
const values={
  DT:[1523.25,1545,1505,1541,1482.75,1450.5,1396.25,1464,1449.25,1323,1476.25],
  LPG:[651,649,641,643,657.5,685,669,674,716,758,749,775]
};
const ddmm=d=>d.slice(8,10)+'.'+d.slice(5,7);
const full=d=>ddmm(d)+'.'+d.slice(0,4);
const gaps=key=>iso[key].map((d,i)=>i?Math.round((Date.parse(d+'T00:00:00Z')-Date.parse(iso[key][i-1]+'T00:00:00Z'))/86400000):0);
const dayMonitor=key=>({
  version:'RONA_MARKET_OBSERVED_DAILY_V1',
  granularity:'OBSERVATION_DATE',sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
  noInterpolation:true,notMonthlyMaturityCurve:true,
  observedDates:iso[key],observationCount:iso[key].length,availableTotal:iso[key].length,
  segmentIds:iso[key].map(()=>0),segmentCount:1,historyIncludesAllGapSegments:true,
  gapBeforeDays:gaps(key),firstAsOf:full(iso[key][0]),lastAsOf:full(iso[key].at(-1)),
  referenceDate:'08.10.2026',status:'VERIFIED_DAILY_OBSERVATIONS',
  deliveryMonth:key==='DT'?null:'2026-10',sourceGap:true,
  instrument:key==='DT'?'DIESEL_PLATTS_ULSD_CIF_NWE_PHYSICAL_COMPONENT'
                       :'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY'
});
const forecast=(base,low,high)=>({month:'2026-11',base,low,high,forward:base,reference:base,
  sourceRef:'https://t.me/platts_digits/7510',direction:'РОСТ',confidence:'СРЕДНЯЯ',curveType:'PLATTS_NOV'});
const payload={
  version:'RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',cutoff:'08.10.2026',latestTradeDate:'08.10.2026',
  products:{
    AI92:{name:'АИ-92',dates:['07.10','08.10'],values:[1255.75,1251.25],
      forecast:forecast(1097.75,1027,1195.75)},
    AI95:{name:'АИ-95',dates:['07.10','08.10'],values:[1295.75,1291.25],
      calculationRule:'AI92+40',forecast:forecast(1137.75,1067,1235.75)},
    DT:{name:'ДТ',dates:iso.DT.map(ddmm),values:values.DT,dailyMonitor:dayMonitor('DT'),
      basis:'Platts Diesel ULSD · Cargoes CIF NWE/Basis ARA · физический компонент',
      forecast:forecast(1370,1328,1403.13),rona:{reference:1370,bases:[['CPT Озинки',1379.92]]}},
    LPG:{name:'СУГ',dates:iso.LPG.map(ddmm),values:values.LPG,dailyMonitor:dayMonitor('LPG'),
      basis:'Platts Propane CIF NWE Large Cargo Financial · поставка 10.2026',
      forecast:forecast(725,698.5,775)}
  }
};
const html='<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><main id="page-analytics" class="page active"></main><script src="/analytics.js"></script></body></html>';
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('cache-control','no-store');
  if(pathname==='/portal/admin'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(html)}
  if(pathname==='/analytics.js'){res.setHeader('content-type','application/javascript; charset=utf-8');return res.end(script)}
  if(pathname==='/portal/api/v1/admin/analytics'){
    res.setHeader('content-type','application/json');return res.end(JSON.stringify({ok:true,data:{canonicalAnalytics:payload}}));
  }
  res.statusCode=404;res.end('not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:980}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v3',{timeout:15000});

  mkdirSync('.qa-artifacts',{recursive:true});
  const inspect=async(key)=>{
    await page.locator('#rona-analytics-v2 [data-product="'+key+'"]').click();
    const target=iso[key].length;
    await page.waitForFunction(({key,target})=>{
      const root=document.querySelector('#rona-analytics-v2'),svg=root?.querySelector('.rona-market-chart-svg');
      return window.RONA_ANALYTICS_VIEW?.getState?.()?.product===key&&
        root?.dataset?.ronaChartKind==='OBSERVATION_DAILY'&&
        svg?.dataset?.ronaAdminSingleOwner==='20261010-admin-r3-exclusive-chart-owner-r4'&&
        svg?.querySelectorAll('circle.rmc-point').length===target&&
        svg.querySelectorAll('path.rmc-line').length===target-1;
    },{key,target},{timeout:10000});
    const result=await page.evaluate(()=>{
      const root=document.querySelector('#rona-analytics-v2'),svg=root.querySelector('.rona-market-chart-svg');
      const points=[...svg.querySelectorAll('circle.rmc-point')],paths=[...svg.querySelectorAll('path.rmc-line')];
      return {points:points.length,lines:paths.length,
        chartKind:root.dataset.ronaChartKind,sourceGapSegments:root.dataset.ronaSourceGapSegments,
        gapInterpolation:root.dataset.ronaGapInterpolation,owner:svg.dataset.ronaAdminSingleOwner,
        dates:points.map(p=>(p.getAttribute('aria-label')||'').slice(0,10)),
        x:points.map(p=>Number(p.getAttribute('cx'))),
        pathSegments:paths.map(p=>String(p.getAttribute('d')||'')),
        aria:points.every(p=>p.querySelector('title')&&p.getAttribute('tabindex')==='0'),
        insight:root.querySelector('.an2-comment')?.textContent||'',
        clipped:svg.getBoundingClientRect().width<=0};
    });
    assert(result.points===target&&result.lines===target-1,key+' must connect every adjacent CONFIRMED observation '+JSON.stringify(result));
    assert(result.dates.every((d,i)=>d===full(iso[key][i])),key+' plot date mismatch '+JSON.stringify(result.dates));
    assert(result.x.every((x,i,all)=>Number.isFinite(x)&&(i===0||x>all[i-1])),key+' non-monotone observation x');
    assert(result.pathSegments.every(s=>s.startsWith('M ')&&s.includes(' L ')&&!s.includes(' C ')),key+' unexpected fake smoothing');
    assert(result.aria && result.gapInterpolation==='OFF' && result.sourceGapSegments==='1',key+' plot ownership/gaps');
    assert(result.insight.includes('пропуски'),key+' missing-day disclosure lost');
    assert(!result.clipped,key+' plot collapsed');
    await page.locator('#rona-analytics-v2').screenshot({path:'.qa-artifacts/analytics-r5-'+key.toLowerCase()+'.png'});
    await page.evaluate(()=>window.RONA_ANALYTICS_VIEW.render());
    await page.waitForFunction(n=>document.querySelector('#rona-analytics-v2 .rona-market-chart-svg')?.querySelectorAll('path.rmc-line').length===n,target-1,{timeout:6000});
    console.log('R5_SPARSE_CONNECTED_'+key+'=PASS',JSON.stringify({points:result.points,lines:result.lines,first:result.dates[0],last:result.dates.at(-1),gapCount:gaps(key).filter(n=>n>1).length}));
  };
  await inspect('DT');
  await inspect('LPG');
  await inspect('DT');
  assert(errors.length===0,'page errors: '+errors.join('; '));
  console.log('RONA_ADMIN_ANALYTICS_R5_OWNER_SCREENSHOT_REPAIR=PASS');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
