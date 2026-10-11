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
    DT:{name:'ДТ',dates:[],values:[]},LPG:{name:'СУГ',dates:[],values:[]}}};
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
   noProduct.conclusion.includes('Данные по выбранному продукту не опубликованы'),
   'Missing-product selection revived stale archived fixtures: '+JSON.stringify(noProduct));
 await page.evaluate(()=>window.RONA_ANALYTICS_VIEW.setProduct('AI92'));
 await page.waitForFunction(()=>window.RONA_ANALYTICS_VIEW?.getState?.()?.product==='AI92'&&
   document.querySelector('#rona-analytics-v2 [data-chart-stage]')?.textContent?.includes('USD'),{timeout:10000});
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
