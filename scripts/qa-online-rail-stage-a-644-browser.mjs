import http from 'node:http';
import { chromium } from 'playwright';
import { onRequest as railRequest } from '../functions/portal/rail-current-v81-maplibre-ui.js';

const railResponse=await railRequest({});
if(railResponse.status!==200)throw new Error('RAIL_SOURCE_HTTP_'+railResponse.status+': '+await railResponse.text());
const railScript=await railResponse.text();

const DEAL_A='11111111-1111-4111-8111-111111111111';
const DEAL_B='22222222-2222-4222-8222-222222222222';
let bootstrapRequests=0;
let degradeRailReadModel=false;

function snapshot(){
  return {
    generatedAt:new Date().toISOString(),
    deals:[
      {deal_key:DEAL_A,deal_id:'DEAL-QA-A',business_status:'ACTIVE'},
      {deal_key:DEAL_B,deal_id:'DEAL-QA-B',business_status:'ACTIVE'}
    ],
    rail:[
      {rail_document_key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',rail_document_id:'QA-RAIL-A1',gu12_number:'QA-GU12-A1',document_number:'QA-GU12-A1',document_date:'2026-09-18',route_text:'QA A origin -> QA A destination',deal_id:'DEAL-QA-A',wagons:[{wagonNumber:'QA000001',station:'QA Station A',stationCode:'QA001',operation:'LOAD',status:'ACTIVE',lastPositionAt:null}]},
      {rail_document_key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',rail_document_id:'QA-RAIL-A2',gu12_number:'QA-GU12-A2',document_number:'QA-GU12-A2',document_date:'2026-09-18',route_text:'QA A origin -> QA A destination',deal_id:'DEAL-QA-A',wagons:[{wagonNumber:'QA000002',station:'QA Station A2',stationCode:'QA002',operation:'TRANSIT',status:'ACTIVE',lastPositionAt:null}]},
      {rail_document_key:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',rail_document_id:'QA-RAIL-B1',gu12_number:'QA-GU12-B1',document_number:'QA-GU12-B1',document_date:'2026-09-18',route_text:'QA B origin -> QA B destination',deal_id:'DEAL-QA-B',wagons:[]}
    ],
    railReadModel:{
      modelVersion:'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4',
      sourcePolicy:'QA_FIXTURE_ONLY',
      generatedAt:new Date().toISOString(),
      overlayMode:'DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1'
    },
    exchange:{status:'HEALTHY',active_targets:0,conflicts:0,last_success:null},
    plannedRouteByDeal:{
      [DEAL_B]:{
        points:[
          {lat:55.75,lng:37.62,station:'QA Route Start',stationCode:'QA100'},
          {lat:41.31,lng:69.28,station:'QA Route End',stationCode:'QA200'}
        ],
        geometry:{type:'LineString',coordinates:[[37.62,55.75],[69.28,41.31]]},
        provenance:{source:'QA_FIXTURE_ONLY',sourceRef:'issue-644-browser'}
      }
    }
  };
}

const html=[
'<!doctype html>',
'<html lang="ru"><head><meta charset="utf-8">',
'<style>',
'html,body{margin:0;min-height:100%;background:#06111c;color:#fff;font-family:Arial,sans-serif}',
'#nav{display:flex;gap:8px;padding:10px}',
'#nav button{padding:8px 12px}',
'.page{display:none;padding:12px}.page.active{display:block}',
'.rona-owner-page-content{width:100%;max-width:1200px;margin:auto}',
'.rona-owner-card{padding:14px;border:1px solid rgba(255,255,255,.15);border-radius:12px}',
'.rona-visual-hero{padding:14px}.rona-visual-title{font-size:24px;font-weight:800}',
'</style>',
'<script>',
'window.__RONA_OWNER_ADMIN_READY__=true;',
'window.__RONA_OWNER_ADMIN_SNAPSHOT__=null;',
'document.addEventListener("click",function(e){const b=e.target.closest&&e.target.closest("#nav button[data-page]");if(!b)return;const id=b.dataset.page;document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+id));document.querySelectorAll("#nav button[data-page]").forEach(x=>x.classList.toggle("active",x===b));document.documentElement.dataset.ronaAdminPage=id;});',
'</script></head><body class="admin-auth-server-verified">',
'<nav id="nav">',
'<button data-page="home">Главная</button>',
'<button data-page="payments">Платежи</button>',
'<button data-page="deals">Сделки</button>',
'<button data-page="access">Доступы</button>',
'<button data-page="accounting">Касса</button>',
'<button data-page="monitoring" class="active">Онлайн ЖД</button>',
'</nav>',
'<section id="page-home" class="page"><div class="rona-owner-page-content">HOME-QA</div></section>',
'<section id="page-payments" class="page"><div class="rona-owner-page-content">PAYMENTS-QA</div></section>',
'<section id="page-deals" class="page"><div class="rona-owner-page-content">DEALS-QA</div></section>',
'<section id="page-access" class="page"><div class="rona-owner-page-content">ACCESS-QA</div></section>',
'<section id="page-accounting" class="page"><div class="rona-owner-page-content">CASH-QA</div></section>',
'<section id="page-monitoring" class="page active"><div class="rona-owner-page-content" data-owner-page="monitoring"></div></section>',
'<script src="/portal/rail-current-v81-maplibre-ui.js"></script>',
'</body></html>'
].join('');

function send(res,status,body,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
  res.end(body);
}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}

const server=http.createServer((req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/admin')return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/portal/rail-current-v81-maplibre-ui.js')return send(res,200,railScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/portal/owner-api'&&u.searchParams.get('path')==='/admin/bootstrap'){
    bootstrapRequests++;
    const data=snapshot();
    if(degradeRailReadModel){
      delete data.railReadModel;
      delete data.plannedRouteByDeal;
      data.rail=data.rail.map(doc=>({...doc,wagons:[]}));
    }
    return json(res,{ok:true,data});
  }
  if(u.pathname==='/qa/degrade'){degradeRailReadModel=true;return json(res,{ok:true,degradeRailReadModel});}
  if(u.pathname==='/qa/restore'){degradeRailReadModel=false;return json(res,{ok:true,degradeRailReadModel});}
  if(u.pathname==='/qa/count')return json(res,{bootstrapRequests,degradeRailReadModel});
  if(u.pathname.startsWith('/portal/map-assets/osm/'))return send(res,204,'','image/png');
  return send(res,404,'not found');
});

await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const close=(a,b,eps=1e-7)=>Math.abs(Number(a)-Number(b))<=eps;

async function requestCount(){return (await fetch(origin+'/qa/count').then(r=>r.json())).bootstrapRequests}
async function repairAndWait(page){
  const before=await requestCount();
  await page.evaluate(()=>window.__RONA_RAIL_CURRENT_REPAIR__());
  const deadline=Date.now()+3000;
  while(Date.now()<deadline){
    const now=await requestCount();
    if(now>before)return now;
    await sleep(40);
  }
  throw new Error('rail repair did not perform bootstrap sync');
}

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text())});

  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey&&document.querySelector('.rona-rail-v7-map-viewport'),{timeout:6000});

  const selector=page.locator('.rona-rail-v6-select');
  assert(await page.locator('.rona-rail-v6-select-label').textContent()==='Сделка','selector label is not Сделка');
  const optionData=await selector.locator('option').evaluateAll(xs=>xs.map(x=>({value:x.value,text:x.textContent})));
  assert(optionData.length===2,'expected two canonical deal options');
  assert(optionData[0].value===DEAL_A&&optionData[0].text==='DEAL-QA-A','deal A option is not canonical');
  assert(optionData[1].value===DEAL_B&&optionData[1].text==='DEAL-QA-B','deal B option is not canonical');

  const initial=await page.evaluate(()=>({
    state:{...window.__RONA_RAIL_CURRENT_STATE__},
    selected:window.__RONA_RAIL_SELECTED_DEAL_KEY__,
    text:document.querySelector('#page-monitoring')?.textContent||'',
    contract:window.__RONA_RAIL_MAP_DATA_CONTRACT__,
    map:window.__RONA_RAIL_MAP_ACTIVE_VIEW__
  }));
  assert(initial.selected===DEAL_A,'initial selected deal key mismatch');
  assert(initial.state.railCount===2,'deal A must aggregate two GU-12 documents');
  assert(initial.state.wagonCount===2,'deal A must aggregate wagons across both GU-12 documents');
  assert(initial.text.includes('QA-GU12-A1')&&initial.text.includes('QA-GU12-A2'),'deal A GU-12 rows missing');
  assert(!initial.text.includes('QA-GU12-B1'),'deal B GU-12 leaked into deal A view');
  assert(initial.contract?.selectionKey==='deal_key','map contract does not use canonical deal key');
  assert(initial.contract?.wagonPositions?.sourcePolicy==='EXPEDITOR_XLSX_VIA_RAIL_AI','wrong wagon-position source policy');
  assert(initial.contract?.wagonPositions?.productionPolling===false,'production polling must remain disabled');

  const plus=page.getByRole('button',{name:'Приблизить карту'});
  await plus.click();await plus.click();await plus.click();
  const viewport=page.locator('.rona-rail-v7-map-viewport');
  await viewport.focus();
  await viewport.press('ArrowRight');
  await viewport.press('ArrowDown');
  const userView=await page.evaluate(()=>{
    window.__QA_RAIL_VIEWPORT_NODE__=document.querySelector('.rona-rail-v7-map-viewport');
    const v=window.__RONA_RAIL_MAP_ACTIVE_VIEW__;
    return v?{...v}:null;
  });
  console.log('ISSUE644_VIEWPORT_DEBUG='+JSON.stringify({initialMap:initial.map,userView}));
  assert(userView&&initial.map&&userView.zoom>=Number(initial.map.zoom)+3,'map did not zoom by at least 3 levels');
  assert(!close(userView.lat,52.5)||!close(userView.lng,68),'map center did not move');
  assert(userView.userTouched===true,'user map interaction was not persisted');

  for(let i=0;i<3;i++)await repairAndWait(page);
  const afterThreeRefresh=await page.evaluate(()=>({
    sameNode:document.querySelector('.rona-rail-v7-map-viewport')===window.__QA_RAIL_VIEWPORT_NODE__,
    view:{...window.__RONA_RAIL_MAP_ACTIVE_VIEW__},
    sync:{...window.__RONA_RAIL_CURRENT_SYNC_STATE__}
  }));
  assert(afterThreeRefresh.sameNode,'unchanged rail refresh recreated the viewport');
  assert(afterThreeRefresh.sync.mode==='DATA_CHANGE_ONLY','rail sync is not data-change-only');
  assert(afterThreeRefresh.view.zoom===userView.zoom&&close(afterThreeRefresh.view.lat,userView.lat)&&close(afterThreeRefresh.view.lng,userView.lng),'three rail refreshes changed user viewport');

  await page.locator('#nav button[data-page="home"]').click();
  await page.locator('#nav button[data-page="monitoring"]').click();
  await sleep(500);
  const afterNavigation=await page.evaluate(()=>({
    sameNode:document.querySelector('.rona-rail-v7-map-viewport')===window.__QA_RAIL_VIEWPORT_NODE__,
    view:{...window.__RONA_RAIL_MAP_ACTIVE_VIEW__}
  }));
  assert(afterNavigation.sameNode,'navigation away/back recreated an intact rail viewport');
  assert(afterNavigation.view.zoom===userView.zoom&&close(afterNavigation.view.lat,userView.lat)&&close(afterNavigation.view.lng,userView.lng),'navigation away/back changed viewport state');

  await page.evaluate(()=>{
    const host=document.querySelector('#page-monitoring>.rona-owner-page-content');
    host.replaceChildren(document.createElement('div'));
    window.__RONA_RAIL_CURRENT_REPAIR__();
  });
  await page.waitForFunction(()=>document.querySelector('.rona-rail-v7-map-viewport')&&window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey===window.__RONA_RAIL_SELECTED_DEAL_KEY__,{timeout:5000});
  const afterRecreate=await page.evaluate(()=>({...window.__RONA_RAIL_MAP_ACTIVE_VIEW__}));
  assert(afterRecreate.zoom===userView.zoom&&close(afterRecreate.lat,userView.lat)&&close(afterRecreate.lng,userView.lng),'DOM recreation did not restore persisted viewport');

  await page.getByRole('button',{name:'Показать Россию и СНГ'}).click();
  const homeView=await page.evaluate(()=>({...window.__RONA_RAIL_MAP_ACTIVE_VIEW__}));
  assert(homeView.zoom===3&&close(homeView.lat,52.5)&&close(homeView.lng,68),'СНГ/Home did not explicitly reset default viewport');

  await selector.selectOption(DEAL_B);
  await page.waitForFunction(key=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey===key&&window.__RONA_RAIL_MAP_ACTIVE_VIEW__?.dealKey===key,DEAL_B,{timeout:5000});
  const dealB=await page.evaluate(()=>({
    state:{...window.__RONA_RAIL_CURRENT_STATE__},
    view:{...window.__RONA_RAIL_MAP_ACTIVE_VIEW__},
    store:JSON.parse(JSON.stringify(window.__RONA_RAIL_MAP_VIEWPORT_STATE__)),
    text:document.querySelector('#page-monitoring')?.textContent||''
  }));
  assert(dealB.state.railCount===1&&dealB.state.wagonCount===0,'deal B context did not own rail KPIs');
  assert(dealB.text.includes('QA-GU12-B1')&&!dealB.text.includes('QA-GU12-A1'),'deal B document scope incorrect');
  const bStore=dealB.store.views['DEAL:'+DEAL_B];
  assert(bStore?.routeFitApplied===true&&bStore?.reason==='ROUTE_FIT','new deal did not receive one-time planned-route fit');
  assert(dealB.view.zoom!==3||!close(dealB.view.lat,52.5)||!close(dealB.view.lng,68),'route fit fell back to global default despite plannedRoute source');

  await page.getByRole('button',{name:'Приблизить карту'}).click();
  await page.locator('.rona-rail-v7-map-viewport').focus();
  await page.locator('.rona-rail-v7-map-viewport').press('ArrowLeft');
  const dealBUser=await page.evaluate(()=>({...window.__RONA_RAIL_MAP_ACTIVE_VIEW__}));
  await repairAndWait(page);
  const dealBAfter=await page.evaluate(()=>({...window.__RONA_RAIL_MAP_ACTIVE_VIEW__}));
  assert(dealBAfter.zoom===dealBUser.zoom&&close(dealBAfter.lat,dealBUser.lat)&&close(dealBAfter.lng,dealBUser.lng),'background refresh overrode manual deal B pan/zoom');

  await selector.selectOption(DEAL_A);
  await page.waitForFunction(key=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey===key,DEAL_A,{timeout:5000});
  const beforeDegradedRefresh=await page.evaluate(()=>({
    state:{...window.__RONA_RAIL_CURRENT_STATE__},
    text:document.querySelector('#page-monitoring')?.textContent||'',
    node:document.querySelector('.rona-rail-v7-map-viewport')
  }));
  assert(beforeDegradedRefresh.state.railCount===2&&beforeDegradedRefresh.state.wagonCount===2,'precondition: authoritative deal A projection missing');

  await fetch(origin+'/qa/degrade').then(r=>r.json());
  await repairAndWait(page);
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_SYNC_STATE__?.mode==='PRESERVE_LAST_GOOD_ON_DEGRADED_READ_MODEL'&&window.__RONA_RAIL_CURRENT_V4_ERROR__==='RAIL_READ_MODEL_DEGRADED',{timeout:3000});
  const afterDegradedRefresh=await page.evaluate(()=>({
    state:{...window.__RONA_RAIL_CURRENT_STATE__},
    text:document.querySelector('#page-monitoring')?.textContent||'',
    sync:{...window.__RONA_RAIL_CURRENT_SYNC_STATE__},
    error:window.__RONA_RAIL_CURRENT_V4_ERROR__,
    sameNode:document.querySelector('.rona-rail-v7-map-viewport')===window.__QA_RAIL_VIEWPORT_NODE__
  }));
  assert(afterDegradedRefresh.state.railCount===2&&afterDegradedRefresh.state.wagonCount===2,'degraded bootstrap erased the last authoritative Rail projection');
  assert(afterDegradedRefresh.text.includes('QA000001')&&afterDegradedRefresh.text.includes('QA000002'),'degraded bootstrap erased visible wagon state');
  assert(afterDegradedRefresh.sync.mode==='PRESERVE_LAST_GOOD_ON_DEGRADED_READ_MODEL','degraded refresh was not fail-closed');
  assert(afterDegradedRefresh.error==='RAIL_READ_MODEL_DEGRADED','degraded read-model condition was not surfaced');
  await fetch(origin+'/qa/restore').then(r=>r.json());

  assert(errors.length===0,'browser errors: '+errors.join(' | '));
  console.log('ISSUE644_DEAL_OWNER=PASS');
  console.log('ISSUE644_MAP_PERSIST_3_REFRESH=PASS');
  console.log('ISSUE644_NAVIGATION_RESTORE=PASS');
  console.log('ISSUE644_DOM_RECREATE_RESTORE=PASS');
  console.log('ISSUE644_HOME_RESET=PASS');
  console.log('ISSUE644_ONE_TIME_ROUTE_FIT=PASS');
  console.log('ISSUE644_MAP_DATA_CONTRACT=PASS');
  console.log('ISSUE644_DEGRADED_READ_MODEL_PRESERVE=PASS');
  console.log(JSON.stringify({bootstrapRequests,initialState:initial.state,userView,afterThreeRefresh,afterRecreate,homeView,dealBState:dealB.state,dealBUser,dealBAfter}));
  await context.close();
}catch(error){
  console.error('ISSUE644_STAGE_A_BROWSER_QA=FAIL',error?.stack||error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
