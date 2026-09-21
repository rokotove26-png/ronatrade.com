// #670 frontend-only fixture regression harness. It does NOT prove backend acceptance.
// Backend acceptance is owned by issue670-client-rail-real-integration.yml.
import http from 'node:http';
import { chromium } from 'playwright';
import { onRequest as clientRailRequest } from '../functions/portal/client-rail-current-ui.js';

const response=await clientRailRequest({});
if(response.status!==200)throw new Error('CLIENT_RAIL_SOURCE_HTTP_'+response.status+': '+await response.text());
const clientRailScript=await response.text();

const DEAL_A='11111111-1111-4111-8111-111111111111';
const DEAL_B='22222222-2222-4222-8222-222222222222';
const DEAL_C='33333333-3333-4333-8333-333333333333';
let requests=0;
let degraded=false;

function route(points,status){return{status,points,geometry:null,provenance:{source:'ISSUE670_QA_FIXTURE'}}}
function dataFor(clientId,contractId){
  const defs=clientId==='CLIENT-B'?[{key:DEAL_C,id:'DEAL-QA-C',station:'Context C',code:'300003'}]:[
    {key:DEAL_A,id:'DEAL-QA-A',station:'Context A',code:'100001'},
    {key:DEAL_B,id:'DEAL-QA-B',station:'Context B',code:'200002'}
  ];
  const deals=defs.map(d=>({deal_key:d.key,deal_id:d.id,business_status:'DEAL',lifecycle_state:'ACTIVE',client_id:clientId,contract_id:contractId}));
  const rail=defs.map((d,i)=>({
    rail_document_key:(i===0?'aaaaaaaa':'bbbbbbbb')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    rail_document_id:'RAIL-'+d.id,
    gu12_number:'GU12-'+d.id,
    document_number:'GU12-'+d.id,
    document_date:'2026-09-19',
    route_text:'Origin -> '+d.station,
    deal_id:d.id,
    deal_key:d.key,
    wagons:[{wagonNumber:'9000000'+(i+1),station:d.station,stationCode:d.code,operation:'RAW_ONLY',status:'TRUSTED',positionStatus:'TRUSTED',effectiveResolutionStatus:'MATCHED',eventAtLocal:'2026-09-19T12:30:00',lastPositionAt:'2026-09-19T12:30:00',trustedCoordinates:{lat:53+i,lng:27+i,trusted:true,stationCode:d.code}}]
  }));
  const plannedRouteByDeal={},actualRouteByDeal={},remainingRouteByDeal={},routeProgressByDeal={},routeStationsByDeal={},routeAssignmentByDeal={};
  for(const [i,d] of defs.entries()){
    const planned=route([{lat:54+i,lng:26+i,station:'Origin',stationCode:'010101'},{lat:53+i,lng:27+i,station:d.station,stationCode:d.code}], 'PUBLIC_SOURCE_ROUTE_RESOLVED');
    const actual=route([{lat:54+i,lng:26+i,station:'Origin',stationCode:'010101'},{lat:53.5+i,lng:26.5+i,station:'Observed',stationCode:'020202'}], 'OBSERVED_HISTORY');
    const remaining=route([{lat:53.5+i,lng:26.5+i,station:'Observed',stationCode:'020202'},{lat:53+i,lng:27+i,station:d.station,stationCode:d.code}], 'ROUTE_REMAINDER');
    for(const key of [d.key,d.id]){plannedRouteByDeal[key]=planned;actualRouteByDeal[key]=actual;remainingRouteByDeal[key]=remaining;routeProgressByDeal[key]={state:'OBSERVED_AND_MATCHED'};routeStationsByDeal[key]=planned.points;routeAssignmentByDeal[key]={resolutionState:'RESOLVED'}}
  }
  return {
    contract:'RONA_CLIENT_RAIL_ADMIN_PARITY_V1',
    generatedAt:new Date().toISOString(),deals,rail,
    exchange:{active_targets:defs.length,conflicts:0,by_deal:{}},
    plannedRouteByDeal,actualRouteByDeal,remainingRouteByDeal,routeProgressByDeal,routeStationsByDeal,routeAssignmentByDeal,
    railReadModel:{modelVersion:'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4',sourcePolicy:'PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1',generatedAt:new Date().toISOString(),overlayMode:'DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1',authorityScope:'AUTHENTICATED_CLIENT_CONTRACT',clientId,contractId},
    clientRailAuthority:{scope:'AUTHENTICATED_CLIENT_CONTRACT',serverDerived:true,queryValuesUsedAsAuthorization:false}
  };
}

const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#07131f;color:#fff;font-family:Arial,sans-serif}#page-monitoring{padding:12px}.rona-owner-page-content{width:100%}</style><script>
window.__qaCtx={client_id:'CLIENT-A',contract_id:'CONTRACT-A'};
window.__qaSubscriber=null;
window.RONA_CLIENT_CONTEXT={getCurrentContext(){return window.__qaCtx},async whenReady(){return window.__qaCtx},subscribe(fn){window.__qaSubscriber=fn;return()=>{}}};
window.__qaSetContext=function(next){window.__qaCtx=next;if(window.__qaSubscriber)window.__qaSubscriber(next)};
const __nativeSetInterval=window.setInterval.bind(window);window.setInterval=function(fn,ms){return __nativeSetInterval(fn,ms===30000?180:ms)};
</script></head><body><section id="page-monitoring" class="active"><div class="rona-owner-page-content"></div></section><script src="/portal/client-rail-current-ui.js"></script></body></html>`;

function send(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body)}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}
const server=http.createServer((req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/client')return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/portal/client-rail-current-ui.js')return send(res,200,clientRailScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/portal/api/v1/client/rail-canonical'){
    requests++;
    const clientId=u.searchParams.get('clientId'),contractId=u.searchParams.get('contractId');
    if(degraded)return json(res,{ok:false,code:'CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE'},503);
    if(clientId==='CLIENT-A'&&contractId==='CONTRACT-A')return json(res,{ok:true,data:dataFor(clientId,contractId)});
    if(clientId==='CLIENT-B'&&contractId==='CONTRACT-B')return json(res,{ok:true,data:dataFor(clientId,contractId)});
    return json(res,{ok:false,code:'CONTEXT_NOT_FOUND'},404);
  }
  if(u.pathname==='/qa/degrade'){degraded=true;return json(res,{ok:true})}
  if(u.pathname==='/qa/restore'){degraded=false;return json(res,{ok:true})}
  if(u.pathname==='/qa/state')return json(res,{requests,degraded});
  if(u.pathname.startsWith('/portal/map-assets/osm/'))return send(res,204,'','image/png');
  return send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;
const assert=(value,message)=>{if(!value)throw new Error(message)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text())});
  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey&&document.querySelector('.rona-rail-v6-select'),{timeout:8000});
  await page.waitForFunction(()=>document.querySelectorAll('.rona-client-rail-route-overlay-v3 polyline').length>=2&&window.__RONA_CLIENT_RAIL_MAP_PARITY_STATE__?.plannedPoints>=2&&window.__RONA_CLIENT_RAIL_ROUTE_OVERLAY_STATE__?.renderedPointCount>=2,{timeout:8000});

  let options=await page.locator('.rona-rail-v6-select option').evaluateAll(xs=>xs.map(x=>({value:x.value,text:x.textContent})));
  assert(options.length===2&&options[0].value===DEAL_A&&options[1].value===DEAL_B,'server-derived deal selector mismatch '+JSON.stringify(options));
  let view=await page.evaluate(()=>{const lines=[...document.querySelectorAll('.rona-client-rail-route-overlay-v3 polyline')],pins=[...document.querySelectorAll('.rona-client-rail-route-pin')],wagonMarker=document.querySelector('.rona-rail-v7-marker'),wagonStyle=wagonMarker?getComputedStyle(wagonMarker):null;return{state:{...window.__RONA_RAIL_CURRENT_STATE__},text:document.querySelector('#page-monitoring')?.textContent||'',authority:{...window.__RONA_CLIENT_RAIL_AUTHORITY_STATE__},routeParity:{...window.__RONA_CLIENT_RAIL_ROUTE_PARITY__},mapParity:{...window.__RONA_CLIENT_RAIL_MAP_PARITY_STATE__},overlay:{...window.__RONA_CLIENT_RAIL_ROUTE_OVERLAY_STATE__},routeLines:lines.length,visibleRouteLines:lines.filter(n=>{const cs=getComputedStyle(n);return cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity||'1')>0&&cs.stroke!=='none'&&parseFloat(cs.strokeWidth||'0')>0}).length,routePins:pins.length,legacyRouteNodes:document.querySelectorAll('.rona-client-rail-route-overlay-v3 .rona-rail-v7-route-node').length,pinRoles:pins.map(n=>n.getAttribute('data-route-role')),wagonMarker:wagonStyle?{height:wagonStyle.height,borderRadius:wagonStyle.borderRadius,backgroundImage:wagonStyle.backgroundImage}:null,workColumns:getComputedStyle(document.querySelector('.rona-rail-v4-work')).gridTemplateColumns,leftRows:getComputedStyle(document.querySelector('.rona-rail-v4-left')).gridTemplateRows}});
  assert(view.state.railCount===1&&view.state.wagonCount===1,'initial deal state not ready '+JSON.stringify(view.state));
  assert(view.text.includes('GU12-DEAL-QA-A')&&view.text.includes('90000001'),'initial canonical Rail content missing');
  assert(!view.text.includes('GU12-DEAL-QA-B'),'other own deal leaked before selector switch');
  assert(view.authority.source==='AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1','wrong client authority source');
  assert(view.routeParity.version==='CLIENT_ADMIN_ROUTE_PARITY_V2'&&view.routeParity.routeReadyDeals===2,'route parity normalization missing '+JSON.stringify(view.routeParity));
  assert(view.mapParity.version==='CLIENT_ADMIN_ROUTE_PARITY_V4'&&view.mapParity.plannedPoints>=2,'map route parity state missing '+JSON.stringify(view.mapParity));
  assert(view.overlay.version==='CLIENT_RAIL_ROUTE_OVERLAY_V4'&&view.overlay.renderedPointCount>=2,'production route overlay state missing '+JSON.stringify(view.overlay));
  assert(view.routeLines>=2&&view.visibleRouteLines>=2,'Admin route geometry was not visibly rendered '+JSON.stringify(view));
  assert(view.routePins>=2&&view.legacyRouteNodes===0,'premium route pins were not rendered '+JSON.stringify(view));
  assert(view.pinRoles.includes('origin')&&view.pinRoles.includes('destination'),'premium endpoint roles missing '+JSON.stringify(view));
  assert(view.wagonMarker&&view.wagonMarker.height==='24px'&&view.wagonMarker.borderRadius==='7px','wagon marker did not leave circular legacy style '+JSON.stringify(view));
  assert(view.workColumns&&!view.workColumns.includes('1.55fr'),'Client-only operational grid override survived '+JSON.stringify(view));
  assert(view.leftRows!=='1fr 1fr','Client-only equal-height left rows survived '+JSON.stringify(view));
  assert(!view.text.includes('Получаем актуальные ГУ-12 и позиции вагонов.'),'loading shell survived successful load');
  assert(!view.text.includes('Матрица ЖД-тарифов'),'tariff matrix returned');

  await page.locator('.rona-rail-v6-select').selectOption(DEAL_B);
  await page.waitForFunction(key=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey===key,DEAL_B);
  await page.waitForFunction(key=>window.__RONA_CLIENT_RAIL_MAP_PARITY_STATE__?.dealKey===key&&window.__RONA_CLIENT_RAIL_ROUTE_OVERLAY_STATE__?.dealKey===key&&document.querySelectorAll('.rona-client-rail-route-overlay-v3 polyline').length>=2,DEAL_B,{timeout:5000});
  view=await page.evaluate(()=>({state:{...window.__RONA_RAIL_CURRENT_STATE__},text:document.querySelector('#page-monitoring')?.textContent||'',map:{...window.__RONA_RAIL_MAP_ACTIVE_VIEW__},mapParity:{...window.__RONA_CLIENT_RAIL_MAP_PARITY_STATE__},overlay:{...window.__RONA_CLIENT_RAIL_ROUTE_OVERLAY_STATE__},routeLines:document.querySelectorAll('.rona-client-rail-route-overlay-v3 polyline').length}));
  assert(view.text.includes('GU12-DEAL-QA-B')&&!view.text.includes('GU12-DEAL-QA-A'),'deal switch inherited another deal');
  assert(view.mapParity.dealKey===DEAL_B&&view.overlay.dealKey===DEAL_B&&view.routeLines>=2,'route geometry did not follow deal switch '+JSON.stringify(view));

  const beforeAuto=(await fetch(origin+'/qa/state').then(r=>r.json())).requests;
  await sleep(520);
  const afterAuto=(await fetch(origin+'/qa/state').then(r=>r.json())).requests;
  assert(afterAuto>beforeAuto,'30s auto-refresh source did not schedule recurring canonical reload');

  await fetch(origin+'/qa/degrade');
  const beforeDegraded=await page.locator('#page-monitoring').textContent();
  await page.evaluate(()=>window.__RONA_CLIENT_RAIL_REFRESH__());
  await sleep(250);
  const afterDegraded=await page.locator('#page-monitoring').textContent();
  assert(afterDegraded.includes('GU12-DEAL-QA-B')&&afterDegraded===beforeDegraded,'degraded refresh erased last good client Rail view');
  await fetch(origin+'/qa/restore');

  await page.evaluate(()=>window.__qaSetContext({client_id:'CLIENT-B',contract_id:'CONTRACT-B'}));
  await page.waitForFunction(key=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey===key,DEAL_C,{timeout:5000});
  view=await page.evaluate(()=>({state:{...window.__RONA_RAIL_CURRENT_STATE__},text:document.querySelector('#page-monitoring')?.textContent||'',ctx:window.__RONA_CLIENT_RAIL_CONTEXT_KEY__}));
  assert(view.ctx==='CLIENT-B|CONTRACT-B','client context did not switch');
  assert(view.text.includes('GU12-DEAL-QA-C')&&!view.text.includes('DEAL-QA-A')&&!view.text.includes('DEAL-QA-B'),'prior client context leaked after context switch');

  await page.evaluate(()=>window.__qaSetContext({client_id:'CLIENT-TAMPER',contract_id:'CONTRACT-TAMPER'}));
  await sleep(350);
  view=await page.evaluate(()=>({text:document.querySelector('#page-monitoring')?.textContent||'',ctx:window.__RONA_CLIENT_RAIL_CONTEXT_KEY__,selected:window.__RONA_RAIL_SELECTED_DEAL_KEY__}));
  assert(view.ctx==='CLIENT-TAMPER|CONTRACT-TAMPER','tampered context not attempted');
  assert(!view.text.includes('GU12-DEAL-QA-C')&&!view.text.includes('90000001'),'unauthorized context retained prior Rail data');
  assert(view.selected===null,'unauthorized context retained selected deal');

  assert(errors.length===0,'browser errors: '+errors.join(' | '));
  console.log('ISSUE670_HARD_RELOAD_READY=PASS');
  console.log('ISSUE670_SERVER_DEAL_SELECTOR=PASS');
  console.log('ISSUE670_ADMIN_ROUTE_GEOMETRY=PASS');
  console.log('ISSUE670_ROUTE_OVERLAY_V4_VISIBLE=PASS');
  console.log('ISSUE670_PREMIUM_MAP_MARKERS=PASS');
  console.log('ISSUE670_ADMIN_OPERATIONAL_LAYOUT_INHERITED=PASS');
  console.log('ISSUE670_DEAL_SWITCH_ISOLATION=PASS');
  console.log('ISSUE670_BACKGROUND_REFRESH=PASS');
  console.log('ISSUE670_DEGRADED_REFRESH_PRESERVE=PASS');
  console.log('ISSUE670_CONTEXT_SWITCH_NO_INHERITANCE=PASS');
  console.log('ISSUE670_TAMPER_FAIL_CLOSED=PASS');
  console.log('ISSUE670_NO_TARIFF_MATRIX=PASS');
}catch(error){console.error('ISSUE670_CLIENT_BROWSER_QA=FAIL',error?.stack||error);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));}
