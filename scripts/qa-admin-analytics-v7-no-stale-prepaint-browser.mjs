import http from 'node:http';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {onRequest as serveAnalytics} from '../functions/portal/analytics-v2-ui.js';

const assert=(v,m)=>{if(!v)throw Error(m)};
const js=await (await serveAnalytics({})).text();
let mode='DELAY',requests=0;
const now=new Date(),format=d=>[String(d.getUTCDate()).padStart(2,'0'),String(d.getUTCMonth()+1).padStart(2,'0'),d.getUTCFullYear()].join('.');
const label=d=>format(d).slice(0,5);
const last=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
const prev=new Date(last.getTime()-86400000);
const dateNow=format(last),dates=[label(prev),label(last)];
const fore=(x)=>({month:(last.getUTCFullYear()+((last.getUTCMonth()+1)===12?1:0))+'-'+String(((last.getUTCMonth()+2)%12)||12).padStart(2,'0'),
  low:x-30,base:x,high:x+30,forward:x,reference:x,
  sourceRef:'https://t.me/platts_digits/7510',direction:'РОСТ',curveType:'PLATTS_NOV'});
const product=(name,x)=>({name,dates,values:[x-12,x],forecast:fore(x),
  basis:'Platts verified physical USD/т',rona:{reference:x,bases:[['CPT Озинки',x+90]]}});
const payload={version:'RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',cutoff:dateNow,latestTradeDate:dateNow,
  products:{AI92:product('АИ-92',1280),AI95:product('АИ-95',1320),
    DT:{name:'ДТ',dates:[],values:[]},
    LPG:{...product('СУГ',725),rona:{reference:null,
      bases:[['CPT Озинки',610],['CPT Сарыагаш',745]]},
      dailyMonitor:{version:'RONA_MARKET_OBSERVED_DAILY_V1',granularity:'OBSERVATION_DATE',
        sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',noInterpolation:true,
        notMonthlyMaturityCurve:true,observationCount:2,availableTotal:2,
        observedDates:[prev.toISOString().slice(0,10),last.toISOString().slice(0,10)],
        segmentIds:[0,0],segmentCount:1,
        gapBeforeDays:[0,1],sourceGap:false,status:'VERIFIED_DAILY_OBSERVATIONS',
        firstAsOf:format(prev),lastAsOf:format(last)}}}};
const html='<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><main class="page active" id="page-analytics"></main><script src="/analytics.js"></script></body></html>';
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 res.setHeader('cache-control','no-store');
 if(u.pathname==='/portal/admin'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);}
 if(u.pathname==='/analytics.js'){res.setHeader('content-type','application/javascript; charset=utf-8');return res.end(js);}
 if(u.pathname==='/portal/api/v1/admin/analytics'){
   requests++;res.setHeader('content-type','application/json');
   if(mode==='DELAY')return setTimeout(()=>{res.statusCode=502;res.end(JSON.stringify({ok:false,code:'DELAYED_502'}))},1100);
   if(mode==='ERROR'){res.statusCode=502;return res.end(JSON.stringify({ok:false,code:'API_UNAVAILABLE'}));}
   return res.end(JSON.stringify({ok:true,data:{canonicalAnalytics:payload}}));
 }
 res.statusCode=404;res.end('Not Found');
});
await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done)});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1480,height:920}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/portal/admin',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#page-analytics > #rona-analytics-v2',{state:'attached',timeout:10000});
 const inspect=()=>page.evaluate(()=>{
   const root=document.querySelector('#page-analytics > #rona-analytics-v2');
   const page=document.querySelector('#page-analytics');
   return {state:document.documentElement.dataset.ronaAnalyticsData,
     visibility:getComputedStyle(root).visibility,opacity:getComputedStyle(root).opacity,
     loading:getComputedStyle(page,'::before').content,
     source:Array.from(root.querySelectorAll('[data-chart-stage]')).map(x=>x.innerText).join(' '),
     prepaint:window.__RONA_ANALYTICS_CURRENT_SOURCE_PREPAINT_V7__,
     style:!!document.getElementById('rona-analytics-source-only-prepaint-v7'),
     marker:window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__,
     oldFixtureInJS:!!window.RONA_ANALYTICS_VIEW};});
 const pending=await inspect();
 assert(pending.state==='SOURCE_PENDING','Initial render did not fail closed: '+JSON.stringify(pending));
 assert(pending.visibility==='hidden','Static August old chart became visible before source:'+JSON.stringify(pending));
 assert(pending.prepaint==='source-only-v7'&&pending.loading.includes('Загрузка подтверждённых котировок'),'No source-only screen');
 await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='SOURCE_UNAVAILABLE',{timeout:10000});
 const failed=await inspect();
 assert(failed.visibility==='hidden'&&failed.loading.includes('Архивные значения скрыты'),'Outage visibly resurrected August chart: '+JSON.stringify(failed));
 mkdirSync('.qa-artifacts',{recursive:true});
 await page.screenshot({path:'.qa-artifacts/analytics-v7-no-archived-fallback.png'});
 mode='OK';
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v3',{timeout:10000});
 const live=await inspect();
 assert(live.visibility==='visible'&&live.state==='canonical-daily-live-v3','Current source cannot unlock R4 visual: '+JSON.stringify(live));
 assert(!live.source.includes('21.08')&&!live.source.includes('24.08'),'Old August fixture still on live chart');
 // Partial authoritative replies must not revive the old August fixture for
 // a product whose verified observations/forecast are absent.
 await page.evaluate(()=>window.RONA_ANALYTICS_VIEW.setProduct('DT'));
 await page.waitForFunction(()=>{
   const r=document.querySelector('#rona-analytics-v2');
   return window.RONA_ANALYTICS_VIEW?.getState()?.product==='DT'&&
     r?.querySelector('[data-chart-stage]')?.textContent?.includes('Нет актуального подтверждённого ряда')&&
     r?.querySelector('.an2-market-forecast')?.textContent?.includes('Прогноз недоступен');
 },{timeout:10000});
 const noProduct=await page.evaluate(()=>{
   const r=document.querySelector('#rona-analytics-v2');
   return {visible:getComputedStyle(r).visibility,
     stage:r.querySelector('[data-chart-stage]')?.textContent,
     forecast:r.querySelector('.an2-market-forecast')?.textContent,
     conclusion:r.querySelector('.an2-comment')?.textContent};
 });
 assert(noProduct.visible==='visible'&&!noProduct.stage.includes('21.08')&&
   noProduct.forecast.includes('Прогноз недоступен')&&
   noProduct.conclusion.includes('Подтверждённый ряд котировок по ДТ недоступен'),
   'Missing-product selection revived stale archived fixtures: '+JSON.stringify(noProduct));
 // V8: verified Platts forecast and CPT quote prices alone are not enough.
 // Never substitute a different financial/physical/regional market benchmark
 // into the missing market reference or show historical R4 derived prices.
 await page.evaluate(()=>window.RONA_ANALYTICS_VIEW.setProduct('LPG'));
 await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset?.ronaPricingReadiness==='V12_REFERENCE_UNVERIFIED',
   {timeout:10000});
 const pricingGap=await page.evaluate(()=>{
   const root=document.querySelector('#rona-analytics-v2');
   const note=root.querySelector('.an2-model-note');
   return {state:root.dataset.ronaPricingReadiness,
      note:note?.textContent||'',
      noteHidden:!!note&&getComputedStyle(note).display==='none',
      cards:[...root.querySelectorAll('.an2-price-card')].map(card=>{
        const range=card.querySelector('.an2-price-range');
        const info=card.querySelector('.an2-price-current');
        return {value:card.querySelector('.an2-price-base')?.textContent?.trim(),
          range:range?.textContent?.trim(),text:info?.textContent?.trim(),
          rangeHidden:!!range&&getComputedStyle(range).display==='none',
          textHidden:!!info&&getComputedStyle(info).display==='none'};
      })};
 });
 assert(pricingGap.state==='V12_REFERENCE_UNVERIFIED'&&pricingGap.note===''&&
   pricingGap.noteHidden&&pricingGap.cards.length>0&&
   pricingGap.cards.every(card=>card.value==='—'&&card.range===''&&card.text===''&&
     card.rangeHidden&&card.textHidden),
   'V12 must mask stale rail or under-price comment without matching source: '+JSON.stringify(pricingGap));
 console.log('ANALYTICS_V12_UNVERIFIED_NEVER_SHOW_DOUBLE_RAIL_OR_NARRATIVE=PASS');
 // Verify the REAL initial production condition in an isolated browser:
 // approved bridge already supplied by secured Admin API before first render.
 // Reusing a previously loaded view could legitimately show cached source.
 const lpgForecast=payload.products.LPG.forecast;
 payload.products.LPG.rona.netbackTariffBridges={
   'CPT Сарыагаш':{
     model:'PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1',
     railUsdT:137.24,route:'Озинки → Сарыагаш',
     tariffKey:'LPG-KZH-OZINKI-SARYAGASH',
     sourceProvider:'ТОО Orient Logistic',
     sourceRefs:['OWNER_APPROVAL_2026-08-23_ORIENT_LOGISTIC_KZH_UTI'],
     tariffStatus:'WORKING_CONFIRMED',approvedAt:'2026-08-22T21:38:22Z',
     marketSourceRef:lpgForecast.sourceRef,marketMonth:lpgForecast.month,
     commercialComponent:'NOT_INCLUDED'
   }
 };
 const positivePage=await browser.newPage({viewport:{width:1480,height:920}});
 const positiveErrors=[];positivePage.on('pageerror',e=>positiveErrors.push(e.message));
 try {
   await positivePage.goto('http://127.0.0.1:'+server.address().port+'/portal/admin',{waitUntil:'domcontentloaded'});
   await positivePage.waitForFunction(()=>
     document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v3',
     null,{timeout:12000});
   await positivePage.evaluate(()=>window.RONA_ANALYTICS_VIEW.setProduct('LPG'));
   await positivePage.waitForFunction(()=>
     document.querySelector('#rona-analytics-v2')?.dataset?.ronaPricingReadiness==='V12_REFERENCE_UNVERIFIED',
     null,{timeout:5000});
   const positive=await positivePage.evaluate(()=>{
     const root=document.querySelector('#rona-analytics-v2');
     return {note:root.querySelector('.an2-model-note')?.textContent||'',
       prices:[...root.querySelectorAll('.an2-price-card')].map(card=>({
         basis:card.querySelector('h3')?.textContent?.trim(),
         base:card.querySelector('.an2-price-base')?.textContent?.trim(),
         range:card.querySelector('.an2-price-range')?.textContent?.trim(),
         rail:card.querySelector('.an2-price-current')?.textContent?.trim()
       }))};
   });
   const target=positive.prices.find(x=>x.basis==='CPT Сарыагаш');
   const missing=positive.prices.find(x=>x.basis==='CPT Озинки');
   assert(target?.base==='—'&&missing?.base==='—'&&positive.note==='',
     'V12 must not revive V9 Platts + KZH tariff when same-source market delta is missing: '+JSON.stringify(positive));
   assert(positiveErrors.length===0,'Unexpected browser execution errors: '+positiveErrors.join('; '));
   console.log('ANALYTICS_V12_SUPERSEDES_V9_DOUBLE_RAIL_ON_MISSING_SPREAD=PASS',JSON.stringify(positive));
 } finally {
   await positivePage.close();
 }
 // V11 Chromium: new source-backed five-CPT Admin output (synthetic fixture only).
 payload.products.LPG.rona.bases=[
   ['CPT Озинки',610],['CPT Сарыагаш',745],['CPT Турксиб',790],
   ['CPT Уртааул',780],['CPT Маргилан',795]];
 const sourceFixtureV11=(base,rail,legs)=>({
   mode:'OCTOBER_TARIFF_CARRY_FORWARD_SCENARIO_NOT_NOV_APPROVED',
   railUsdT:rail,scenarioLowUsdT:base-26.5,scenarioBaseUsdT:base,
   scenarioHighUsdT:base+50,novemberTariffApproved:false,legs});
 payload.products.LPG.rona.octoberRateCarryForwardScenarioV11={
   version:'LPG_SOURCE_LOCKED_SCENARIO_V11',
   forecastMonth:lpgForecast.month,novemberTariffsConfirmed:false,
   fxRubPerUsd:84.9048,fxAsOf:'2026-10-11',
   scenarios:{
     'CPT Озинки':sourceFixtureV11(872.59,147.5924,['RF_P03']),
     'CPT Сарыагаш':sourceFixtureV11(1009.83,284.8324,['RF_P03','KZH']),
     'CPT Уртааул':sourceFixtureV11(1042.92,317.9158,['RF_P03','KZH','UTI']),
     'CPT Маргилан':sourceFixtureV11(1057.98,332.9793,['RF_P03','KZH','UTI']),
     'CPT Турксиб':{mode:'PUBLISHED_R12_REFERENCE_ONLY',
       publishedR12UsdT:790,novemberTariffApproved:false,fullCommercialPrice:false}
   }
 };
 // V12 MUST override deliberately wrong V11 rail scenarios (fixture above).
 const r12Bases=payload.products.LPG.rona.bases;
 payload.products.LPG.rona.referenceSpreadV12={
   version:'RONA_LPG_PUBLISHED_CPT_PLUS_SAME_PLATTS_FORWARD_DELTA_V12',
   forecastMonth:lpgForecast.month,marketSourceRef:lpgForecast.sourceRef,
   marketAsOf:'07.10.2026',marketDeltaUsdT:-50,
   tariffsReaddedUsdT:0,technicalProjectionOnly:true,commercialOffer:false,
   publishedSourceReference:'RONA-PRICE-LIST-2026-09-R12',
   prices:Object.fromEntries(r12Bases.map(([basis,reference])=>[basis,{
     marketAdjustedPriceUsdT:reference-50,
     publishedReferenceUsdT:reference,
     marketDeltaUsdT:-50,marketAnchorUsdT:775,
     forecastBaseUsdT:lpgForecast.base,
     tariffsReaddedUsdT:0,officialPriceMutation:false
   }]))
 };
 const v12Page=await browser.newPage({viewport:{width:1480,height:920}});
 const v12Errors=[];v12Page.on('pageerror',e=>v12Errors.push(e.message));
 try{
   await v12Page.goto('http://127.0.0.1:'+server.address().port+'/portal/admin',{waitUntil:'domcontentloaded'});
   await v12Page.waitForFunction(()=>
     document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v3',
     null,{timeout:12000});
   await v12Page.evaluate(()=>window.RONA_ANALYTICS_VIEW.setProduct('LPG'));
   await v12Page.waitForFunction(()=>
     document.querySelector('#rona-analytics-v2')?.dataset?.ronaV12PriceCards==='5',
     null,{timeout:10000});
   const actual=await v12Page.evaluate(()=>{
     const root=document.querySelector('#rona-analytics-v2');
     const note=root.querySelector('.an2-model-note');
     return {count:root.dataset.ronaV12PriceCards,
       doubleRail:root.dataset.ronaV12DoubleRail,
       note:note?.textContent?.trim()||'',
       noteHidden:!!note&&getComputedStyle(note).display==='none',
       cards:[...root.querySelectorAll('.an2-price-card')].map(card=>{
         const range=card.querySelector('.an2-price-range');
         const info=card.querySelector('.an2-price-current');
         return {basis:card.querySelector('h3')?.textContent?.trim()||'',
           value:card.querySelector('.an2-price-base')?.textContent?.trim()||'',
           range:range?.textContent?.trim()||'',
           info:info?.textContent?.trim()||'',
           rangeHidden:!!range&&getComputedStyle(range).display==='none',
           infoHidden:!!info&&getComputedStyle(info).display==='none',
           mode:card.dataset.pricingMode||''};
       })};
   });
   const byBasis=Object.fromEntries(actual.cards.map(x=>[x.basis,x]));
   assert(actual.cards.length===5&&new Set(actual.cards.map(x=>x.basis)).size===5,
     'V12 must render five canonical CPT cards: '+JSON.stringify(actual));
   const normalized=x=>String(x).replace(/[^0-9,]/g,'');
   for(const [basis,value] of [['CPT Озинки','560,00'],['CPT Сарыагаш','695,00'],
     ['CPT Турксиб','740,00'],['CPT Уртааул','730,00'],['CPT Маргилан','745,00']]){
     const card=byBasis[basis];
     assert(card&&normalized(card.value)===value&&
       card.mode==='PUBLISHED_R12_PLUS_PLATTS_DELTA_V12'&&
       card.range===''&&card.info===''&&card.rangeHidden&&card.infoHidden,
       'V12 doubled rail or unwanted under-price commentary: '+basis+' '+JSON.stringify(card));
   }
   assert(actual.count==='5'&&actual.doubleRail==='0'&&actual.note===''&&
     actual.noteHidden&&v12Errors.length===0,
     'V12 missing commentary guard or unexpected browser error: '+
     JSON.stringify({actual,errors:v12Errors}));
   await v12Page.screenshot({path:'.qa-artifacts/analytics-v12-five-cpt-no-double-rail.png'});
   console.log('ANALYTICS_V12_FIVE_CPT_NO_DOUBLE_RAIL_NO_UNREQUESTED_NOTES=PASS',JSON.stringify(actual));
 }finally{await v12Page.close();}
 delete payload.products.LPG.rona.octoberRateCarryForwardScenarioV11;
 delete payload.products.LPG.rona.referenceSpreadV12;
 payload.products.LPG.rona.bases=[['CPT Озинки',610],['CPT Сарыагаш',745]];
 delete payload.products.LPG.rona.netbackTariffBridges;
 await page.evaluate(()=>window.RONA_ANALYTICS_VIEW.setProduct('AI92'));
 await page.waitForFunction(month=>
   window.RONA_ANALYTICS_VIEW?.getState?.()?.product==='AI92'&&
   document.querySelector('#rona-analytics-v2 .an2-market-forecast')?.textContent?.includes(month),
   payload.products.AI92.forecast.month,{timeout:10000});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rona:admin-pagechange',{detail:{page:'analytics'}})));
 // The capture-phase V7 listener hides original frozen rendering while
 // same-signature authenticated source is being revalidated.
 await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='canonical-daily-live-v3',{timeout:10000});
 const restored=await inspect();
 assert(restored.visibility==='visible'&&!restored.source.includes('21.08'),'Same-signature nav showed historical sample');
 mode='ERROR';
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.documentElement.dataset.ronaAnalyticsData==='SOURCE_UNAVAILABLE',{timeout:10000});
 const outage=await inspect();
 assert(outage.visibility==='hidden'&&outage.loading.includes('Архивные значения скрыты'),'Source outage again revealed stale chart');
 assert(errors.length===0,'Browser errors '+errors.join('; '));
 console.log('ANALYTICS_V7_NO_HISTORICAL_BOOTSTRAP=PASS',JSON.stringify({initial:pending.state,unavailable:failed.visibility,verified:live.visibility,reNavigation:restored.visibility,afterOutage:outage.visibility,requests,errors:errors.length}));
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
