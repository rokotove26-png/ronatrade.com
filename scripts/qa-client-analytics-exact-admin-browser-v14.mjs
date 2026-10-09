import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {onRequest as adminUI} from '../functions/portal/analytics-v2-ui.js';
import {onRequest as clientUI} from '../functions/portal/analytics-v2-client-canonical-ui.js';

const assert=(p,m)=>{if(!p)throw Error(m)};
const forecast=(base,low,high)=>({
  month:'2026-11',base,low,high,forward:base,reference:base,
  sourceRef:'https://t.me/platts_digits/7510',sourceAsOf:'2026-10-07',
  direction:'NEUTRAL',confidence:'CONFIRMED',curveType:'RONA_FULL_PLATTS_CURVE_V1'
});
const daily=(product)=>({
  version:'RONA_MARKET_OBSERVED_DAILY_V1',granularity:'OBSERVATION_DATE',
  sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
  instrument:product==='DT'?'DIESEL_PLATTS_ULSD_CIF_NWE_PHYSICAL_COMPONENT':
    'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY',
  noInterpolation:true,notMonthlyMaturityCurve:true,
  historyIncludesAllGapSegments:true,
  observationCount:product==='DT'?3:4,
  observedDates:product==='DT'?['2026-10-01','2026-10-06','2026-10-08']:
    ['2026-08-26','2026-08-27','2026-08-28','2026-10-07'],
  segmentIds:product==='DT'?[0,0,0]:[0,0,0,1],
  gapBeforeDays:product==='DT'?[0,5,2]:[0,1,1,40],
  segmentCount:product==='DT'?1:2,sourceGap:product==='LPG',
  firstAsOf:product==='DT'?'01.10.2026':'26.08.2026',
  lastAsOf:product==='DT'?'08.10.2026':'07.10.2026',
  deliveryMonth:product==='LPG'?'2026-10':null,
  status:'VERIFIED_DAILY_OBSERVATIONS'
});
const shared={
  version:'RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',
  cutoff:'08.10.2026',latestTradeDate:'08.10.2026',
  products:{
    AI92:{name:'АИ-92',basis:'Platts',dates:['06.10','07.10','08.10'],
      values:[1261.75,1270.5,1280.25],forecast:forecast(1097.75,1027,1195)},
    AI95:{name:'АИ-95',basis:'Platts',dates:['06.10','07.10','08.10'],
      values:[1301.75,1310.5,1320.25],forecast:forecast(1137.75,1067,1235)},
    DT:{name:'ДТ',basis:'Platts ULSD CIF NWE physical component',
      dates:['01.10','06.10','08.10'],values:[1449.25,1323,1476.25],
      forecast:forecast(1370,1328,1403.125),dailyMonitor:daily('DT')},
    LPG:{name:'СУГ / СПБТ',basis:'Platts Propane CIF NWE Large Cargo Financial · 10.2026',
      dates:['26.08','27.08','28.08','07.10'],values:[539,544.5,556.5,775],
      forecast:forecast(725,698.5,775),dailyMonitor:daily('LPG')}
  }
};
// Model the actual canonical Admin product destination counts, including
// duplicate diesel shipping bases. Client sees ONLY their public names.
const priceBases={
  AI92:['CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Маргилан','CPT Уртааул'],
  AI95:['CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Маргилан','CPT Уртааул'],
  DT:['CPT Озинки','CPT Озинки','CPT Сарыагаш','CPT Сарыагаш','CPT Турксиб','CPT Турксиб'],
  LPG:['CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Уртааул','CPT Маргилан']
};
const adminData=structuredClone(shared);
for(const [k,p] of Object.entries(adminData.products)){
  p.rona={reference:1270,bases:priceBases[k].map((route,i)=>[route,1280+i*10])};
}
const clientData={...shared,projection:'CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14',
  products:Object.fromEntries(Object.entries(shared.products).map(([k,v])=>[k,
    {...v,priceBasisLabels:priceBases[k],
      spotFreshness:k==='DT'?'STALE_SOURCE':k==='LPG'?'TO_VERIFY_FRESHNESS':'CURRENT'}]))};
let clientFail=false,adminGets=0,clientGets=0;
const [adminJS,clientJS,adapterJS]=await Promise.all([
  adminUI({}).then(r=>r.text()),
  clientUI({}).then(r=>r.text()),
  readFile('dist/assets/portal-runtime/client-market-intelligence-v1.js','utf8')
]);
const html=(which)=>{
  const scripts=which==='admin'
    ?'<script src="/admin-ui.js"></script>'
    :'<style>#page-analytics #rona-analytics-v2:not([data-rona-client-source-safe="1"]) .an2-main{visibility:hidden!important}</style>'+
      '<script src="/client-ui.js"></script><script src="/client-overlay.js" defer></script>';
  return '<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body>'+
    '<main id="page-analytics" class="page active"></main>'+scripts+'</body></html>';
};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('cache-control','no-store');
  if(url==='/portal/admin'||url==='/portal/client'){
    res.setHeader('content-type','text/html; charset=utf-8');
    res.end(html(url.split('/').at(-1)));return;
  }
  if(['/admin-ui.js','/client-ui.js','/client-overlay.js'].includes(url)){
    res.setHeader('content-type','application/javascript; charset=utf-8');
    res.end(url==='/admin-ui.js'?adminJS:url==='/client-ui.js'?clientJS:adapterJS);
    return;
  }
  if(url==='/portal/api/v1/admin/analytics'){
    adminGets++;
    res.setHeader('content-type','application/json; charset=utf-8');
    res.end(JSON.stringify({ok:true,data:{canonicalAnalytics:adminData}}));return;
  }
  if(url==='/portal/api/v1/client/market-intelligence'){
    clientGets++;
    res.setHeader('content-type','application/json; charset=utf-8');
    res.statusCode=clientFail?503:200;
    res.end(JSON.stringify(clientFail?{ok:false,code:'QA_ROLE_SOURCE_FAILED'}:{
      ok:true,data:{version:'RONA_CLIENT_MARKET_INTELLIGENCE_V1',analytics:[],news:[],
        clientCanonicalAnalytics:clientData,generated_at:'2026-10-10T00:00:00Z'}
    }));return;
  }
  res.statusCode=404;res.end('NOT_FOUND');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const status=page=>page.evaluate(()=>{
  const root=document.querySelector('#page-analytics #rona-analytics-v2');
  const view=window.RONA_ANALYTICS_VIEW;
  if(!root||!view)return {notReady:true};
  const elements=[...root.querySelectorAll('*')].map(n=>[
    n.tagName,n.className?.baseVal||String(n.className||''),n.children.length,
    n.getAttribute('data-product')||'',n.getAttribute('data-source')||''
  ]);
  return{
    version:view.version,sourceSafe:root.dataset.ronaClientSourceSafe||'',
    state:view.getState?.(),owner:root.getAttribute('data-analytics-owner'),
    heading:root.querySelector('h1')?.textContent||'',
    chartTitle:root.querySelector('[data-chart-title]')?.textContent||'',
    forecastTitle:root.querySelector('.an2-mf-title')?.textContent||'',
    dayLabels:[...root.querySelectorAll('[data-chart-stage] text.rmc-axis')].map(x=>x.textContent?.trim()).slice(0,30),
    controls:[...root.querySelectorAll('button[data-product]')].map(x=>x.dataset.product),
    nodes:elements,charts:root.querySelectorAll('.rmc-line').length,
    points:root.querySelectorAll('circle.rmc-point').length,
    internalPricing:root.querySelector('[data-pricing-mode="BRIDGE"]')!==null
  };
});
const required=async(page,mode)=>{
  const s=mode==='admin'?'canonical-daily-live-v3':'canonical-daily-client-authorized-v14';
  await page.waitForFunction(expected=>
    document.documentElement.dataset.ronaAnalyticsData===expected,s,{timeout:16000});
  if(mode==='client')await page.waitForFunction(()=>
    document.querySelector('#rona-analytics-v2')?.dataset.ronaClientSourceSafe==='1'&&
    document.querySelectorAll('#rona-analytics-v2 .an2-rona-grid > .an2-price-card').length===5,
    null,{timeout:10000});
};
try{
  browser=await chromium.launch({headless:true});
  const admin=await browser.newPage({viewport:{width:1500,height:950}});
  const client=await browser.newPage({viewport:{width:1500,height:950}});
  const errors=[];
  for(const page of [admin,client])page.on('pageerror',e=>errors.push(String(e.message||e)));
  await Promise.all([admin.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'}),
    client.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'})]);
  await Promise.all([required(admin,'admin'),required(client,'client')]);
  for(const product of ['AI92','AI95','DT','LPG']){
    await Promise.all([admin,client].map(p=>p.locator('#rona-analytics-v2 button[data-product="'+product+'"]').click()));
    await Promise.all([admin,client].map(p=>p.waitForFunction(k=>
      window.RONA_ANALYTICS_VIEW?.getState?.().product===k,product,{timeout:5000})));
    const [a,c]=await Promise.all([status(admin),status(client)]);
    if(JSON.stringify(a.nodes)!==JSON.stringify(c.nodes)){
      const mismatch=a.nodes.findIndex((v,i)=>JSON.stringify(v)!==JSON.stringify(c.nodes[i]));
      const groups=arr=>Object.entries(arr.reduce((m,z)=>(m[z[0]+'|'+z[1]]=(m[z[0]+'|'+z[1]]||0)+1,m),{}))
        .sort((x,y)=>x[0].localeCompare(y[0]));
      const ag=groups(a.nodes),cg=groups(c.nodes);
      const union=new Map([...ag,...cg].map(x=>[x[0],{admin:0,client:0}]));
      ag.forEach(([k,v])=>union.get(k).admin=v);
      cg.forEach(([k,v])=>union.get(k).client=v);
      const differences=[...union].filter(([k,v])=>v.admin!==v.client).slice(0,18);
      throw Error('ADMIN_CLIENT_DOM_NOT_IDENTICAL '+product+' '+JSON.stringify({
        adminNodes:a.nodes.length,clientNodes:c.nodes.length,mismatch,
        adminAt:a.nodes.slice(Math.max(mismatch-2,0),mismatch+7),
        clientAt:c.nodes.slice(Math.max(mismatch-2,0),mismatch+7),
        classDiff:differences,adminTitle:a.chartTitle,clientTitle:c.chartTitle
      }));
    }
    assert(JSON.stringify(a.controls)===JSON.stringify(c.controls),
      'NATIVE_PRODUCT_CONTROLS_DIFFER '+product);
    assert(a.chartTitle===c.chartTitle,'CHART_TITLE_DIFFER '+product);
    assert(a.points===c.points,'OBSERVATION_COUNT_DIFFER '+product);
    assert(c.sourceSafe==='1','CLIENT_DID_NOT_SANITIZE_CANONICAL_DATA '+product);
    assert(!c.internalPricing,'CLIENT_ADMIN_INTERNAL_PRICING_BRIDGE_LEAK '+product);
    if(product==='LPG')assert(a.points===4&&a.charts===c.charts,
      'LPG_GAP_SEGMENTS_NOT_CANONICAL '+JSON.stringify({admin:a.charts,client:c.charts,points:c.points}));
    console.log('APPROVED_ADMIN_CLIENT_EXACT_'+product+'=PASS');
  }
  assert(adminGets>0&&clientGets>0,'BOTH_ROLE_API_FETCHES_REQUIRED');
  const oldAdminGets=adminGets;
  clientFail=true;
  await client.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await client.waitForFunction(()=>
    document.querySelector('#rona-analytics-v2')?.dataset.ronaClientSourceSafe==='0',null,{timeout:6000});
  assert(adminGets===oldAdminGets,'CLIENT_ATTEMPTED_ADMIN_API_FETCH');
  console.log('CLIENT_CONTEXT_SWITCH_NO_DATA_LEAK=PASS');
  assert(errors.length===0,'BROWSER_SCRIPT_ERRORS '+JSON.stringify(errors.slice(0,5)));
  console.log('APPROVED_ADMIN_CLIENT_EXACT_SINGLE_ENGINE_V14=PASS');
}finally{
  if(browser)await browser.close();
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
}
