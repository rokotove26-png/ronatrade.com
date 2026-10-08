import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const assert=(condition,why)=>{if(!condition)throw Error(why)};
const script=await readFile('dist/assets/portal-runtime/client-market-intelligence-v1.js','utf8');
const stamp='2026-10-08T22:42:00Z';
const headline='Проверенная опубликованная аналитика';
const row=(product,freshness='CURRENT',value=1261.75)=>({
  publication_id:'PUBLISHED-CLIENT-ANALYTICS',
  publication_item_id:product+'-001',
  published_at:stamp,product,headline:product+' · '+headline,
  analytics_as_of:'2026-10-07T00:00:00Z',
  content_text:'Котировка опубликована в разрешённом клиентском контуре.',
  public_chart:{type:'FORECAST_RANGE',unit:'USD/т',source_freshness_state:freshness,
    labels:['ФАКТ','MTD','FORWARD 11.2026'],values:[value,1269.94,1097.75]}
});
const operations={
  publication_id:'PUBLISHED-CLIENT-ANALYTICS',publication_item_id:'LOGISTICS-001',
  published_at:stamp,product:'Логистика',headline:'Подтверждённые показатели логистики',
  analytics_as_of:stamp,content_text:'Публикация для всех клиентов',
  public_chart:{type:'CONTROL_COUNTS',unit:'входов',
    labels:['ПОДТВЕРЖДЕНО','К ПРОВЕРКЕ'],values:[5,1]}
};
let payload={version:'RONA_CLIENT_MARKET_INTELLIGENCE_V1',generated_at:stamp,
  server_date:'2026-10-09',timezone:'Europe/Moscow',analytics:[operations,row('АИ-92','STALE_SOURCE')],news:[]};
let mode='OK',latencyMs=240,requests=0;
const html='<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head>'+
'<body><main id="page-analytics" class="page active"><div id="legacy-static-analytics">'+
'<div>Platts 21.08.2026</div><div>Прогноз 09.2026</div><div>Старые коммерческие цены 1 111 USD/т</div></div></main>'+
'<script src="/client-analytics.js" defer></script></body></html>';
const server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('cache-control','no-store');
  if(path==='/portal/client'){res.setHeader('content-type','text/html; charset=utf-8');res.end(html);return}
  if(path==='/client-analytics.js'){res.setHeader('content-type','application/javascript; charset=utf-8');res.end(script);return}
  if(path==='/portal/api/v1/client/market-intelligence'){
    requests++;
    const status=mode,urlPayload=structuredClone(payload);
    const send=()=>{if(res.destroyed)return;res.setHeader('content-type','application/json');
      if(status==='ERROR'){res.statusCode=503;res.end(JSON.stringify({ok:false,code:'CLIENT_MARKET_FEED_FAILED'}))}
      else res.end(JSON.stringify({ok:true,data:urlPayload}))};
    setTimeout(send,latencyMs);return;
  }
  res.statusCode=404;res.end('not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#page-analytics')?.dataset.ronaClientAnalyticsMigrated==='v3',{timeout:8000});
  const legacyHidden=await page.locator('#legacy-static-analytics').isHidden();
  assert(legacyHidden,'Legacy August/September snapshot was visible while loading client publication');
  await page.waitForFunction(()=>document.querySelector('[data-rona-client-market-intelligence-owner="analytics"]')?.dataset.renderState==='PUBLISHED_CURRENT_ONLY',{timeout:10000});
  assert(await page.locator('#page-analytics [data-product="АИ-92"][data-client-source-status="NO_CURRENT_PUBLICATION"]').count()===1,'STALE_SOURCE product was not omitted');
  assert(await page.locator('#page-analytics [data-product="ДТ"][data-client-source-status="NO_CURRENT_PUBLICATION"]').count()===1,'Missing DT has no explicit unavailable state');
  const initial=await page.locator('#page-analytics').innerText();
  assert(!initial.includes('21.08.2026')&&!initial.includes('Прогноз 09.2026')&&!initial.includes('1 111'),'Archived initial prices leaked visibly');
  assert(initial.includes('Подтверждённые показатели логистики'),'Verified published logistics material was removed');

  payload={...payload,analytics:[operations,row('АИ-92','CURRENT',1280.25)]};
  latencyMs=300;
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>document.querySelector('[data-rona-client-market-intelligence-owner="analytics"]')?.dataset.renderState==='LOADING',{timeout:5000});
  assert(!await page.locator('#page-analytics').innerText().then(t=>t.includes('Подтверждённые показатели логистики')),'Old client content persisted during context change');
  await page.waitForFunction(()=>document.querySelector('#page-analytics [data-product="АИ-92"]')?.dataset.clientSourceStatus==='PUBLISHED_CURRENT',{timeout:6000});
  assert((await page.locator('[data-product="АИ-92"][data-client-source-status="PUBLISHED_CURRENT"]').innerText()).includes('1\u00a0280')||
    (await page.locator('[data-product="АИ-92"][data-client-source-status="PUBLISHED_CURRENT"]').innerText()).includes('1 280'),'Current approved client chart missing value');

  const before=await page.locator('[data-product="АИ-92"][data-client-source-status="PUBLISHED_CURRENT"]').innerText();
  payload={...payload,analytics:[operations,row('АИ-92','CURRENT',1290.75)]};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('[data-product="АИ-92"]')?.textContent?.includes('290'),{timeout:6000});
  assert(before!==await page.locator('[data-product="АИ-92"][data-client-source-status="PUBLISHED_CURRENT"]').innerText(),'Publication change with same ID/as-of was not hydrated');

  mode='ERROR';latencyMs=50;
  await page.evaluate(()=>document.dispatchEvent(new Event('rona:client:context-changed')));
  await page.waitForFunction(()=>document.querySelector('[data-rona-client-market-intelligence-owner="analytics"]')?.dataset.renderState==='ERROR_NO_ARCHIVE',{timeout:6000});
  const error=await page.locator('#page-analytics').innerText();
  assert(error.includes('Архивные котировки и прогнозы скрыты'),'Error did not fail closed');
  assert(!error.includes('290,75')&&!error.includes('09.2026'),'Previous tenant price remained visible after HTTP failure');
  assert(errors.length===0,'Uncaught JS errors: '+errors.join('; '));
  assert(!script.includes('setInterval('),'Client Analytics unexpectedly polls forbidden background timers');
  console.log(JSON.stringify({result:'PASS',browser:'chromium',legacy_hidden_while_loading:legacyHidden,
    market_stale_suppressed:true,valid_published_accepted:true,context_switch_isolated:true,
    change_same_publication_id_updated:true,api_error_fail_closed:true,
    current_only_gate:'CLIENT',page_errors:errors.length,requests}));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
