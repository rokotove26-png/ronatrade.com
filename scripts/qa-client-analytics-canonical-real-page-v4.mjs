import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,normalize,extname} from 'node:path';
import {chromium} from 'playwright';

const ROOT=process.cwd(),DIST=join(ROOT,'dist');
const html=await readFile(join(DIST,'portal/client.html'),'utf8');
const portalServer=await readFile(join(ROOT,'functions/portal/[[path]].js'),'utf8');
if(!portalServer.includes(".on('head',new HeadPrepend(bridge))")||
   portalServer.includes('CLIENT_ANALYTICS_HEAD_BOOT'))
  throw Error('ADMIN_IMPERSONATION_HEAD_BRIDGE_AUTHORITY_CHANGED');
const headers=await readFile(join(DIST,'_headers'),'utf8');
if(!headers.includes('/assets/portal-runtime/client-market-intelligence-v1.js\n  Cache-Control: no-store, no-cache, must-revalidate, max-age=0'))
  throw Error('CLIENT_MARKET_RUNTIME_NO_STORE_MISSING');
const marker='20261009-client-analytics-admin-canonical-parity-v10';
const bridge='<script id="rona-client-market-intelligence-v1"';
const report={
  hasBridge:html.includes(bridge),
  markerRef:html.includes('client-market-intelligence-v1.js?v=20261009-client-analytics-admin-canonical-parity-v10'),
  rootStatic:/id=["']page-analytics["']/.test(html),
  analyticsNodeMatch:html.match(/.{0,180}id=["']page-analytics["'].{0,280}/)?.[0]||'not found',
  possibleIds:([...html.matchAll(/id=["']([^"']*analytic[^"']*)["']/gi)]).map(x=>x[1]).slice(0,30),
  matchesOldText:html.includes('21.08.2026')||html.includes('09.2026')
};
console.log('CLIENT_REAL_CANONICAL_HTML',JSON.stringify(report));
const canonicalMethods={};for(const key of ['const DATA=','DATA.products','function updateKpis(', 'function updateForecast(', 'function updateRona(', 'function updateCommentary(', 'function showSeries(', 'function showUnavailable(', 'function render()', 'function rebuildControls(']){
  const index=html.indexOf(key);canonicalMethods[key]=index<0?null:html.slice(index,index+2350);
}
console.log('CLIENT_CANONICAL_ORIGINAL_DATA_CONTRACT',JSON.stringify(canonicalMethods));

const payload={ok:true,data:{version:'RONA_CLIENT_MARKET_INTELLIGENCE_V1',generated_at:'2026-10-09T00:01:00Z',analytics:[],news:[]}};
const MIME={'.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const srv=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    res.setHeader('cache-control','no-store');
    if(u.pathname==='/portal/client'){
      res.setHeader('content-type','text/html; charset=utf-8');res.end(html);return;
    }
    if(u.pathname==='/portal/api/v1/client/market-intelligence'){
      res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(payload));return;
    }
    if(u.pathname.startsWith('/portal/api/')){
      res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,code:'CANONICAL_QA_NO_AUTH'}));return;
    }
    const clean=normalize(u.pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/,'');
    const file=join(DIST,clean);
    if(file.startsWith(DIST)){try{if((await stat(file)).isFile()){res.setHeader('content-type',MIME[extname(file).toLowerCase()]||'application/octet-stream');res.end(await readFile(file));return;}}catch{}}
    res.statusCode=404;res.end('not found');
  }catch(e){res.statusCode=500;res.end(String(e))}
});
await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+srv.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1400,height:850}});
  const errors=[],requestFail=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  page.on('requestfailed',r=>{if(requestFail.length<30)requestFail.push({url:r.url(),failure:r.failure()})});
  await page.goto(origin+'/portal/client?impSession=00000000-0000-4000-8000-000000000001',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(3000);
  const canonicalProbe=await page.evaluate(()=>{
    const root=document.querySelector('#rona-analytics-v2'),parent=document.querySelector('#page-analytics');
    const inspect=n=>n?{tag:n.tagName,id:n.id,classes:String(n.className).slice(0,95),hidden:n.hidden,display:getComputedStyle(n).display,
      children:n.childElementCount,rect:{w:Math.round(n.getBoundingClientRect().width),h:Math.round(n.getBoundingClientRect().height)},
      attrs:[...n.attributes].filter(x=>/data-/.test(x.name)).map(x=>[x.name,x.value]).slice(0,7)}:null;
    if(!root)return{missing:true};
    const structure=[...root.querySelectorAll('section,div,canvas,svg,iframe,button,select,[role=tab],[data-chart-stage],[data-chart-title],h1,h2,h3,h4')].map(n=>({
      depth:(()=>{let d=0,x=n;while(x&&x!==root&&d<11){d++;x=x.parentElement}return d})(),
      tag:n.tagName,id:n.id,cls:String(n.className).slice(0,80),
      dt:[...n.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name).slice(0,5),
      role:n.getAttribute('role'),text:/^H[1-4]$|^BUTTON$|^OPTION$/.test(n.tagName)?String(n.textContent||'').trim().slice(0,65):'',
      shown:getComputedStyle(n).display!=='none'
    }));
    const blocks=[...root.children].map(n=>({node:inspect(n),descendants:n.querySelectorAll('*').length}));
    const numerical=[...root.querySelectorAll('[class*="kpi"],[class*="chart"],[class*="forecast"],[class*="price"],canvas,iframe')].slice(0,55).map(inspect);
    const av=window.RONA_ANALYTICS_VIEW;
    const source=k=>String(av?.[k]?.toString?.()||'').slice(0,2200);
    let viewState=null;try{viewState=av?.getState?.()}catch(e){viewState={error:String(e)}}
    const views={analyticsView:typeof av,
      api:Object.keys(av||{}).slice(0,30),
      runtime:typeof window.RONA_ANALYTICS_RUNTIME,
      controllers:[...Object.keys(window)].filter(s=>/analyti|chart/i.test(s)).slice(0,22),
      getState:viewState?JSON.stringify(viewState).slice(0,2600):null,
      setPayloadCode:source('setPayload'),setProductCode:source('setProduct'),
      updateProductCode:source('updateProduct'),setSourceCode:source('setSource'),
      renderCode:source('render'),chartCode:String(window.renderClientMainChart||'').slice(0,1700)};
    const chartSvg=root.querySelector('[data-chart-svg]');
    const chartNodes=chartSvg?[...chartSvg.children].slice(0,35).map(n=>({tag:n.tagName,cls:n.getAttribute('class'),
      id:n.id?.baseVal||n.id||'',role:n.getAttribute('role'),
      text:n.tagName.toLowerCase()==='text'?String(n.textContent||'').slice(0,28):'',
      d:n.getAttribute('d')?.slice(0,75)||null})):null;
    const controls=[...root.querySelectorAll('[data-an2-product],[data-an2-source]')].map(n=>({name:n.textContent.trim(),product:n.getAttribute('data-an2-product'),source:n.getAttribute('data-an2-source'),active:n.className}));
    const stateSlots=[...root.querySelectorAll('.an2-market-forecast,.an2-mf-title,.an2-mf-row,.an2-rona-head,.an2-model-note,.an2-comment')].map(n=>({cls:n.className,parts:[...n.children].slice(0,4).map(z=>({tag:z.tagName,cls:z.className})),head:String(n.textContent||'').trim().slice(0,110)}));
    return{root:inspect(root),page:inspect(parent),htmlSize:root.outerHTML.length,blocks,structure:structure.slice(0,120),numeric:numerical,views,chartNodes,controls,stateSlots};
  });
  console.log('CLIENT_CANONICAL_ORIGINAL_VISUAL_CONTRACT',JSON.stringify(canonicalProbe));

  const snapshot=()=>page.evaluate(()=>{
    const pageRoot=document.querySelector('#page-analytics');
    const owner=pageRoot?.querySelector(':scope > #rona-analytics-v2');
    const r=n=>{const b=n?.getBoundingClientRect();return b?{x:b.x,y:b.y,width:b.width,height:b.height,display:getComputedStyle(n).display}:null};
    const safeSvg=owner?.querySelector('[data-chart-svg]');
    const empty=owner?.querySelector('[data-rona-client-canonical-empty="v7"]');
    const structure=['.rona-analytics-hero','.an2-kpis','.an2-controls','.an2-main',
      '.rona-market-chart-stage','.an2-market-forecast','.an2-rona-grid','.an2-comment']
      .map(selector=>({selector,count:owner?.querySelectorAll(selector).length||0}));
    const text=owner?.innerText||'';
    const heading=owner?.querySelector('h1')?.getBoundingClientRect();
    const hit=heading?document.elementFromPoint(Math.min(innerWidth-2,Math.max(2,heading.left+heading.width/2)),
      Math.min(innerHeight-2,Math.max(2,heading.top+heading.height/2))):null;
    return{
      runtime:window.__RONA_CLIENT_MARKET_INTELLIGENCE__||null,
      root:r(pageRoot),owner:r(owner),ownerHidden:owner?.hidden??true,
      nativeView:typeof window.RONA_ANALYTICS_VIEW?.getState==='function',
      nativeProduct:window.RONA_ANALYTICS_VIEW?.getState?.()?.product||null,
      visualOwner:owner?.dataset.ronaClientAnalyticsVisualOwner||null,
      sourceSafe:owner?.dataset.ronaClientSourceSafe||null,
      renderState:owner?.dataset.renderState||null,
      substituteCount:pageRoot?.querySelectorAll('[data-rona-client-market-intelligence-owner="analytics"]').length||0,
      controlProducts:[...owner?.querySelectorAll('[data-an2-product]')||[]].map(n=>n.getAttribute('data-an2-product')),
      structure,svgHidden:safeSvg?getComputedStyle(safeSvg).visibility==='hidden':null,emptyVisible:!!empty&&!empty.hidden,
      staleExposed:text.includes('21.08.2026')||text.includes('09.2026')||text.includes('725–780'),
      headHit:!!owner&&!!hit&&(owner===hit||owner.contains(hit)),
      prepaintStyle:!!document.getElementById('rona-client-analytics-canonical-prepaint-v7')
    };
  });
  const nav=async section=>{
    await page.evaluate(name=>{
      const b=[...document.querySelectorAll('[data-page]')].find(n=>n.tagName==='BUTTON'&&n.dataset.page===name);
      if(!b)throw Error('CANONICAL_NAVIGATION_MISSING:'+name);
      b.click();
    },section);
    await page.waitForTimeout(700);
  };
  await nav('analytics');
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset.ronaClientSourceSafe==='1',null,{timeout:6500});
  const initial=await snapshot();
  console.log('CLIENT_CANONICAL_VISUAL_RESTORED_V7_INITIAL',JSON.stringify(initial));
  if(initial.runtime!==marker||!initial.nativeView||initial.visualOwner!=='canonical-v7'||initial.substituteCount!==0||
     initial.ownerHidden||initial.owner?.display==='none'||initial.owner?.height<450||
     !initial.headHit||initial.staleExposed||!initial.emptyVisible||!initial.svgHidden||!initial.prepaintStyle||
     initial.controlProducts.length!==4||initial.structure.some(n=>n.count<1))
    throw Error('CANONICAL_VISUAL_RESTORATION_FAILED: '+JSON.stringify(initial));
  await page.setViewportSize({width:1170,height:657});
  await page.waitForTimeout(750);
  const split=await snapshot();
  console.log('CLIENT_CANONICAL_VISUAL_RESTORED_V7_SPLIT_VIEW',JSON.stringify(split));
  if(!split.headHit||split.owner?.width<700||split.owner?.height<450||split.staleExposed||split.substituteCount)
    throw Error('CLIENT_CANONICAL_SPLIT_VIEW_NOT_RESTORED: '+JSON.stringify(split));
  // Actual full frozen canonical HTML: price values must occupy its existing primary
  // display slot (not only a tiny caption) and vanish on a tenant/context switch.
  await page.evaluate(()=>{
    window.RONA_CLIENT_CONTEXT={getCurrentContext:()=>({client_id:'QA-C1',contract_id:'QA-D1'})};
    window.__RONA_CLIENT_PRICE_SYNC_STATE__={authority:'SERVER_AUTHORITATIVE_PRICE_PROJECTION',
      context:{client_id:'QA-C1',contract_id:'QA-D1'},loadedAt:new Date().toISOString(),
      prices:[{product:'АИ-92 К5',basis:'CPT Озинки',price:1242.75,currency:'USD'},
              {product:'АИ-92 К5',basis:'CPT Сарыагаш',price:1379.95,currency:'USD'}]};
    window.dispatchEvent(new Event('rona:client-prices-updated'));
  });
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2 .an2-price-base')?.textContent?.includes('242,75'),null,{timeout:7000});
  const published=await page.evaluate(()=>{
    const owner=document.querySelector('#rona-analytics-v2');
    const cards=[...owner.querySelectorAll('.an2-price-card')].map(card=>({
      basis:card.querySelector('h3')?.textContent,
      amount:card.querySelector('.an2-price-base')?.textContent,
      caption:card.querySelector('.an2-price-current')?.textContent,
      range:card.querySelector('.an2-price-range')?.textContent,
      source:card.dataset.ronaClientPriceSource||null}));
    return{title:owner.querySelector('.an2-rona-head h2')?.textContent,cards,
      badge:owner.querySelector('.an2-rona-head .rona-fin-pill')?.textContent,
      substituteCount:document.querySelectorAll('[data-rona-client-market-intelligence-owner="analytics"]').length};
  });
  console.log('CLIENT_CANONICAL_PUBLISHED_PRICES_PROMINENT_V9',JSON.stringify(published));
  if(!published.title?.includes('Опубликованные цены RONA Trade')||published.substituteCount||
     !published.cards?.[0]?.amount?.includes('242,75')||
     !published.cards?.[1]?.amount?.includes('379,95')||
     published.cards?.[2]?.amount!=='—'||
     !published.cards?.[0]?.caption?.includes('Опубликованная цена')||
     published.cards.some(x=>x.range&&!x.range.includes('LOW —')))
    throw Error('CLIENT_CANONICAL_PRICE_PROMINENCE_FAILED '+JSON.stringify(published));
  await page.evaluate(()=>{
    window.RONA_CLIENT_CONTEXT={getCurrentContext:()=>({client_id:'QA-C2',contract_id:'QA-D2'})};
    window.dispatchEvent(new Event('rona:client-prices-updated'));
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('#rona-analytics-v2 .an2-price-base')]
    .every(card=>card.textContent==='—'),null,{timeout:7000});
  console.log('CLIENT_CANONICAL_PRICE_TENANT_SWITCH_V9=PASS');

  // Existing canonical controls must work with source-safe model, not a substitute card UI.
  await page.evaluate(()=>document.querySelector('#rona-analytics-v2 [data-an2-product="LPG"]')?.click());
  await page.waitForTimeout(700);
  const lpg=await snapshot();
  if(lpg.nativeProduct!=='LPG'||lpg.staleExposed||lpg.substituteCount)
    throw Error('CANONICAL_PRODUCT_CONTROL_UNSAFE: '+JSON.stringify(lpg));
  await page.evaluate(()=>document.querySelector('#rona-analytics-v2 [data-an2-product="AI92"]')?.click());
  const currentRow={publication_id:'PUB-TEST-1',publication_item_id:'PUB-TEST-AI92',
    published_at:'2026-10-09T00:01:00Z',product:'АИ-92',
    headline:'Проверенный опубликованный ряд',analytics_as_of:'2026-10-09T00:01:00Z',
    content_text:'Опубликованный текущий ряд только для теста',
    public_chart:{type:'DAILY_SERIES',unit:'USD/т',source_freshness_state:'CURRENT',
      labels:['2026-10-07','2026-10-08','2026-10-09'],values:[1100,1110,1120]}};
  payload.data={...payload.data,analytics:[currentRow],clientCanonicalAnalytics:{"version":"RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1","projection":"CLIENT_ADMIN_PARITY_SOURCE_LOCKED_V10","cutoff":"09.10.2026","latestTradeDate":"09.10.2026","products":{"AI92":{"name":"АИ-92","basis":"Platts Source Confirmed","dates":["07.10","08.10","09.10"],"values":[1081,1092,1103],"forecast":{"month":"2026-11","low":1027,"base":1097.75,"high":1195,"forward":1097.75,"sourceRef":"QA-SOURCE-20261009"}},"AI95":{"name":"АИ-95","dates":[],"values":[]},"DT":{"name":"ДТ","dates":[],"values":[]},"LPG":{"name":"СУГ","dates":[],"values":[]}}},generated_at:'2026-10-09T00:02:00Z'};
  await page.evaluate(()=>window.dispatchEvent(new Event('rona:client-market-intelligence-invalidated')));
  await page.waitForFunction(()=>document.querySelector('#rona-analytics-v2')?.dataset.renderState==='PUBLISHED_CURRENT_ONLY'&&
    getComputedStyle(document.querySelector('#rona-analytics-v2 [data-chart-svg]')).visibility!=='hidden',null,{timeout:6500});
  const live=await snapshot();
  console.log('CLIENT_CANONICAL_LIVE_PUBLISHED_V7',JSON.stringify(live));
  if(live.visualOwner!=='canonical-v7'||live.substituteCount||live.svgHidden||live.staleExposed)
    throw Error('CLIENT_CANONICAL_LIVE_PUBLICATION_FAILED: '+JSON.stringify(live));
  payload.data={...payload.data,analytics:[],clientCanonicalAnalytics:null,generated_at:'2026-10-09T00:03:00Z'};
  await page.evaluate(()=>window.dispatchEvent(new Event('rona:client-market-intelligence-invalidated')));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#rona-analytics-v2 [data-chart-svg]')).visibility==='hidden',null,{timeout:6500});
  await nav('home');
  await nav('analytics');
  const back=await snapshot();
  console.log('CLIENT_CANONICAL_VISUAL_REENTRY_V7',JSON.stringify(back));
  if(back.owner?.display==='none'||back.substituteCount||back.staleExposed||!back.emptyVisible||back.visualOwner!=='canonical-v7')
    throw Error('CLIENT_CANONICAL_VISUAL_REENTRY_REGRESSION: '+JSON.stringify(back));
  if(errors.length||requestFail.length)
    console.log('CLIENT_CANONICAL_DIAGNOSTIC_ERRORS',JSON.stringify({errors:errors.slice(0,7),failed:requestFail.slice(0,7)}));
  console.log('CLIENT_CANONICAL_ANALYTICS_VISUAL_V7=PASS');
  console.log('CLIENT_CANONICAL_REAL_PAGE_ANALYTICS_BOOT=PASS');
}finally{if(browser)await browser.close();srv.closeAllConnections?.();await new Promise(resolve=>srv.close(resolve));}
