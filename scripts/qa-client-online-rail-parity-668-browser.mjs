import http from 'node:http';
import { chromium } from 'playwright';
import { onRequest as clientRailRequest } from '../functions/portal/client-rail-current-ui.js';

const railResponse=await clientRailRequest({});
if(railResponse.status!==200)throw new Error('CLIENT_RAIL_SOURCE_HTTP_'+railResponse.status+' '+await railResponse.text());
const railScript=await railResponse.text();

const CLIENT_ID='CLIENT-QA-668';
const CONTRACT_ID='CONTRACT-QA-668';
const DEAL_A_KEY='11111111-1111-4111-8111-111111111111';
const DEAL_B_KEY='22222222-2222-4222-8222-222222222222';
const DEAL_C_KEY='33333333-3333-4333-8333-333333333333';

let degraded=false;
let includeNewDeal=false;
let railRequests=0;

const point=(station,stationCode,lat,lng,sequence)=>({station,stationCode,lat,lng,sequence,trusted:true,trust:'CONFIRMED',provenance:{identityBasis:'ESR_CODE',sourceSystem:'QA_FIXTURE_ONLY'}});
const routeA=[point('QA A Start','QA1001',53.9,30.3,1),point('QA A Current','QA1002',51.4,46.08,2),point('QA A End','QA1003',40.44,71.81,3)];
const routeB=[point('QA B Start','QB2001',55.75,37.62,1),point('QA B End','QB2002',41.31,69.28,2)];
const routeC=[point('QA C Start','QC3001',50.1,40.1,1),point('QA C End','QC3002',42.1,68.1,2)];

function deal(dealKey,dealId){return{deal_key:dealKey,deal_id:dealId,business_status:'EXECUTING',lifecycle_state:'ACTIVE'}}

function buildData(){
  const deals=[deal(DEAL_A_KEY,'DEAL-QA-668-A'),deal(DEAL_B_KEY,'DEAL-QA-668-B')];
  if(includeNewDeal)deals.push(deal(DEAL_C_KEY,'DEAL-QA-668-C'));
  const rail=[
    {
      rail_document_key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      rail_document_id:'RAIL-QA-A',
      gu12_number:'GU12-QA-A',
      document_number:'GU12-QA-A',
      document_date:'2026-09-19',
      route_text:'QA A Start -> QA A End',
      deal_key:DEAL_A_KEY,
      deal_id:'DEAL-QA-668-A',
      wagons:[
        {wagonNumber:'QA000001',station:'QA A Current',stationCode:'QA1002',operation:'TRANSIT',lastPositionAt:'2026-09-19T12:00:00Z',eventAtLocal:'2026-09-19 15:00',status:'TRUSTED',positionStatus:'TRUSTED',trustedCoordinates:{lat:51.4,lng:46.08,trusted:true,trust:'CONFIRMED',stationCode:'QA1002'}},
        {wagonNumber:'QA000002',station:'QA A Current',stationCode:'QA1002',operation:'TRANSIT',lastPositionAt:'2026-09-19T12:01:00Z',eventAtLocal:'2026-09-19 15:01',status:'TRUSTED',positionStatus:'TRUSTED',trustedCoordinates:{lat:51.4,lng:46.08,trusted:true,trust:'CONFIRMED',stationCode:'QA1002'}}
      ]
    },
    {
      rail_document_key:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      rail_document_id:'RAIL-QA-B',
      gu12_number:'GU12-QA-B',
      document_number:'GU12-QA-B',
      document_date:'2026-09-19',
      route_text:'QA B Start -> QA B End',
      deal_key:DEAL_B_KEY,
      deal_id:'DEAL-QA-668-B',
      wagons:[
        {wagonNumber:'QB000001',station:'QA B Start',stationCode:'QB2001',operation:'LOAD',lastPositionAt:'2026-09-19T12:10:00Z',eventAtLocal:'2026-09-19 15:10',status:'TRUSTED',positionStatus:'TRUSTED',trustedCoordinates:{lat:55.75,lng:37.62,trusted:true,trust:'CONFIRMED',stationCode:'QB2001'}}
      ]
    }
  ];
  if(includeNewDeal){
    rail.push({
      rail_document_key:'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      rail_document_id:'RAIL-QA-C',
      gu12_number:'GU12-QA-C',
      document_number:'GU12-QA-C',
      document_date:'2026-09-19',
      route_text:'QA C Start -> QA C End',
      deal_key:DEAL_C_KEY,
      deal_id:'DEAL-QA-668-C',
      wagons:[]
    });
  }
  const plannedRouteByDeal={},actualRouteByDeal={},remainingRouteByDeal={},routeProgressByDeal={},routeStationsByDeal={},routeAssignmentByDeal={};
  function publish(key,id,route,currentIndex){
    const planned={status:'PUBLIC_SOURCE_ROUTE_RESOLVED',points:route,geometry:null,provenance:{routeSource:'QA_FIXTURE_ONLY'}};
    const actual={status:'OBSERVED_HISTORY',points:route.slice(0,currentIndex+1)};
    const remaining={status:'ROUTE_REMAINDER',points:route.slice(currentIndex)};
    const progress={state:'OBSERVED_AND_MATCHED',routeNodeCount:route.length,furthestMatchedSequence:currentIndex+1,historyStationCount:Math.max(0,currentIndex),actualPoints:actual.points,remainingPoints:remaining.points};
    const assignment={resolutionState:'RESOLVED',originEsr:route[0].stationCode,destinationEsr:route[route.length-1].stationCode,routeHopCount:route.length-1};
    for(const target of [[plannedRouteByDeal,planned],[actualRouteByDeal,actual],[remainingRouteByDeal,remaining],[routeProgressByDeal,progress],[routeStationsByDeal,route],[routeAssignmentByDeal,assignment]]){
      target[0][key]=target[1];target[0][id]=target[1];
    }
  }
  publish(DEAL_A_KEY,'DEAL-QA-668-A',routeA,1);
  publish(DEAL_B_KEY,'DEAL-QA-668-B',routeB,0);
  if(includeNewDeal)publish(DEAL_C_KEY,'DEAL-QA-668-C',routeC,0);

  return{
    projection_contract:'CLIENT_RAIL_ADMIN_PARITY_V1',
    generated_at:new Date().toISOString(),
    deals,
    rail,
    exchange:{active_targets:2,conflicts:0,by_deal:{
      [DEAL_A_KEY]:{active_targets:1,conflicts:0},
      'DEAL-QA-668-A':{active_targets:1,conflicts:0},
      [DEAL_B_KEY]:{active_targets:1,conflicts:0},
      'DEAL-QA-668-B':{active_targets:1,conflicts:0}
    }},
    plannedRouteByDeal,actualRouteByDeal,remainingRouteByDeal,routeProgressByDeal,routeStationsByDeal,routeAssignmentByDeal,
    railReadModel:{
      modelVersion:'RONA_CLIENT_RAIL_DEAL_MAP_READ_MODEL_V1',
      sourcePolicy:'AUTHORIZED_CLIENT_DEALS_PLUS_TRUSTED_RAIL_EVIDENCE_V1',
      generatedAt:new Date().toISOString(),
      overlayMode:'DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1'
    },
    clientRailScope:{clientId:CLIENT_ID,contractId:CONTRACT_ID,dealCount:deals.length}
  };
}

const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
html,body{margin:0;min-height:100%;background:#06111c;color:#eef7fb;font-family:Arial,sans-serif}
#page-monitoring{display:block;padding:20px}.rona-owner-page-content{display:block}
</style><script>
window.__qaClientContext={client_id:'${CLIENT_ID}',contract_id:'${CONTRACT_ID}'};
window.RONA_CLIENT_CONTEXT={
  getCurrentContext:function(){return window.__qaClientContext},
  whenReady:async function(){return window.__qaClientContext},
  subscribe:function(fn){window.__qaClientContextSubscriber=fn;return function(){}}
};
</script></head><body><section id="page-monitoring" data-rona-client-rail-admin-canonical-mount="v1"></section>
<script src="/portal/client-rail-current-ui"></script></body></html>`;

function send(res,status,body,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
  res.end(body);
}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}

const server=http.createServer((req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/client')return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/portal/client-rail-current-ui')return send(res,200,railScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/portal/api/v1/client/rail'){
    railRequests++;
    if(u.searchParams.get('clientId')!==CLIENT_ID||u.searchParams.get('contractId')!==CONTRACT_ID)return json(res,{ok:false,code:'CONTEXT_NOT_FOUND'},404);
    if(degraded)return json(res,{ok:true,data:{projection_contract:'CLIENT_RAIL_ADMIN_PARITY_V1',deals:[],rail:[],exchange:{active_targets:0,conflicts:0}}});
    return json(res,{ok:true,data:buildData()});
  }
  if(u.pathname==='/qa/degrade'){degraded=true;return json(res,{ok:true,degraded})}
  if(u.pathname==='/qa/restore'){degraded=false;return json(res,{ok:true,degraded})}
  if(u.pathname==='/qa/add-deal'){includeNewDeal=true;return json(res,{ok:true,includeNewDeal})}
  if(u.pathname==='/qa/state')return json(res,{railRequests,degraded,includeNewDeal});
  if(u.pathname.startsWith('/portal/map-assets/osm/'))return send(res,204,'','image/png');
  if(u.pathname.startsWith('/assets/')&&u.pathname.endsWith('.js'))return send(res,200,'','application/javascript; charset=utf-8');
  if(u.pathname.startsWith('/assets/'))return send(res,204,'','application/octet-stream');
  return send(res,404,'not found');
});

await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};

async function refresh(page){
  await page.evaluate(async()=>{if(typeof window.__RONA_CLIENT_RAIL_REFRESH__!=='function')throw new Error('client refresh hook missing');await window.__RONA_CLIENT_RAIL_REFRESH__()});
  await sleep(120);
}
async function selectedState(page){
  return await page.evaluate(()=>({
    state:{...(window.__RONA_RAIL_CURRENT_STATE__||{})},
    authority:{...(window.__RONA_CLIENT_RAIL_AUTHORITY_STATE__||{})},
    sync:{...(window.__RONA_RAIL_CURRENT_SYNC_STATE__||{})},
    error:window.__RONA_RAIL_CURRENT_V4_ERROR__||null,
    map:{...(window.__RONA_RAIL_MAP_DATA__||{})},
    text:document.querySelector('#page-monitoring')?.textContent||'',
    optionLabels:[...document.querySelectorAll('#page-monitoring .rona-rail-v6-select option')].map(o=>o.textContent.trim()),
    visualRoot:!!document.querySelector('#page-monitoring .rona-rail-v4-root'),
    hero:!!document.querySelector('#page-monitoring .rona-rail-v4-hero'),
    work:!!document.querySelector('#page-monitoring .rona-rail-v4-work'),
    realMap:!!document.querySelector('#page-monitoring .rona-rail-v7-real'),
    tariffText:(document.querySelector('#page-monitoring')?.textContent||'').includes('Матрица ЖД-тарифов'),
    customHero:!!document.querySelector('.rona-client-rail-hero-actions')
  }));
}

let browser;
try{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1600,height:1100}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text())});

  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealId&&document.querySelector('#page-monitoring .rona-rail-v6-select'),{timeout:12000});
  let a=await selectedState(page);

  assert(a.visualRoot&&a.hero&&a.work&&a.realMap,'Admin visual contract not fully rendered in Client');
  assert(a.customHero===false,'custom Client hero still overrides Admin visual');
  assert(a.tariffText===false,'Rail tariff matrix reappeared in Client');
  assert(a.optionLabels.length===2&&a.optionLabels.includes('DEAL-QA-668-A')&&a.optionLabels.includes('DEAL-QA-668-B'),'client selector does not contain exact authorized deals');
  assert(!a.optionLabels.some(x=>/OTHER|CROSS|ADMIN/.test(x)),'cross-client deal leaked into selector');
  assert(a.authority.source==='AUTHORIZED_CLIENT_RAIL_READ_MODEL'&&a.authority.client_id===CLIENT_ID&&a.authority.contract_id===CONTRACT_ID,'client authority/context mismatch');
  assert(a.state.selectedDealId==='DEAL-QA-668-A'&&a.state.wagonCount===2,'deal A initial projection wrong');
  assert(a.text.includes('QA000001')&&a.text.includes('QA000002')&&!a.text.includes('QB000001'),'deal A wagon isolation failed');
  assert(a.map.dealId==='DEAL-QA-668-A'&&a.map.actualRoute?.points?.length===2&&a.map.remainingRoute?.points?.length===2,'deal A route actual/remaining projection wrong');

  const selector=page.locator('#page-monitoring .rona-rail-v6-select');
  await selector.selectOption(DEAL_B_KEY);
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealId==='DEAL-QA-668-B',{timeout:5000});
  let b=await selectedState(page);
  assert(b.state.wagonCount===1&&b.text.includes('QB000001')&&!b.text.includes('QA000001'),'deal B inherited deal A wagon state');
  assert(b.map.dealId==='DEAL-QA-668-B'&&b.map.actualRoute?.points?.length===1&&b.map.remainingRoute?.points?.length===2,'deal B inherited wrong route state');

  await selector.selectOption(DEAL_A_KEY);
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealId==='DEAL-QA-668-A',{timeout:5000});
  const beforeDegrade=await selectedState(page);
  await fetch(origin+'/qa/degrade').then(r=>r.json());
  await refresh(page);
  const afterDegrade=await selectedState(page);
  assert(afterDegrade.state.selectedDealId===beforeDegrade.state.selectedDealId&&afterDegrade.state.wagonCount===beforeDegrade.state.wagonCount,'degraded refresh erased selected Client Rail state');
  assert(afterDegrade.text.includes('QA000001')&&afterDegrade.text.includes('QA000002'),'degraded refresh erased visible client wagons');
  assert(afterDegrade.error!==null,'degraded Client Rail refresh was not surfaced');
  await fetch(origin+'/qa/restore').then(r=>r.json());
  await refresh(page);

  await fetch(origin+'/qa/add-deal').then(r=>r.json());
  await refresh(page);
  await page.waitForFunction(()=>[...document.querySelectorAll('#page-monitoring .rona-rail-v6-select option')].some(o=>o.textContent.trim()==='DEAL-QA-668-C'),{timeout:5000});
  const afterAdd=await selectedState(page);
  assert(afterAdd.optionLabels.length===3&&afterAdd.optionLabels.includes('DEAL-QA-668-C'),'new authorized deal did not auto-discover after refresh');

  await selector.selectOption(DEAL_C_KEY);
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealId==='DEAL-QA-668-C',{timeout:5000});
  const c=await selectedState(page);
  assert(c.state.selectedDealId==='DEAL-QA-668-C'&&c.state.wagonCount===0,'new deal context not isolated');
  assert(c.map.dealId==='DEAL-QA-668-C','new deal route context missing');

  for(const key of [DEAL_A_KEY,DEAL_B_KEY,DEAL_C_KEY,DEAL_A_KEY]){
    await selector.selectOption(key);
    await sleep(80);
    await refresh(page);
  }
  const final=await selectedState(page);
  assert(final.state.selectedDealId==='DEAL-QA-668-A'&&final.state.wagonCount===2,'repeated switching/refresh destabilized Client Rail state');
  assert(final.tariffText===false&&final.customHero===false,'retired Client-only UI reappeared');
  assert(errors.length===0,'browser errors: '+errors.join(' | '));

  console.log('CLIENT668_VISUAL_PARITY=PASS');
  console.log('CLIENT668_CONTEXT_ISOLATION=PASS');
  console.log('CLIENT668_BACKGROUND_REFRESH_PRESERVE=PASS');
  console.log('CLIENT668_NEW_DEAL_AUTO_DISCOVERY=PASS');
  console.log('CLIENT668_MULTI_SWITCH_STABILITY=PASS');
  console.log(JSON.stringify({railRequests,initial:a.state,dealB:b.state,newDeal:c.state,final:final.state}));
  await context.close();
}catch(error){
  console.error('CLIENT668_BROWSER_QA=FAIL',error?.stack||error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
