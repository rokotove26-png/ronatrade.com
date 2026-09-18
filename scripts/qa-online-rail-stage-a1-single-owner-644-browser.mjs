import http from 'node:http';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { onRequest as adminMainUi } from '../functions/portal/admin-main-ui-current.js';
import { onRequest as railRequest } from '../functions/portal/rail-current-v81-maplibre-ui.js';

const adminResponse=await adminMainUi({});
if(adminResponse.status!==200)throw new Error('ADMIN_MAIN_SOURCE_HTTP_'+adminResponse.status);
const adminScript=await adminResponse.text();
const railResponse=await railRequest({});
if(railResponse.status!==200)throw new Error('RAIL_SOURCE_HTTP_'+railResponse.status);
const railScript=await railResponse.text();
const watchdogScript=fs.readFileSync('assets/portal-admin-runtime-watchdog-v1.js','utf8');

const DEAL='11111111-1111-4111-8111-111111111111';
let bootstrapRequests=0;
let aiRequests=0;

function snapshot(){
  return {
    generatedAt:'2026-09-18T12:00:00.000Z',
    deals:[{deal_key:DEAL,deal_id:'DEAL-QA-A1',business_status:'ACTIVE'}],
    rail:[
      {rail_document_key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',rail_document_id:'QA-RAIL-A1',gu12_number:'QA-GU12-A1',document_number:'QA-GU12-A1',document_date:'2026-09-18',route_text:'QA origin -> QA destination',deal_id:'DEAL-QA-A1',wagons:[
        {wagonNumber:'QA000001',station:'QA Station',stationCode:'QA001',operation:'TRANSIT',status:'ACTIVE',lastPositionAt:null}
      ]}
    ],
    prices:[],applications:[],documents:[],payments:[],clients:[],agents:[],radio:[],analytics:[],
    exchange:{status:'HEALTHY',active_targets:0,conflicts:0,last_success:null},
    operations:{freshness:{source_as_of:'2026-09-18T12:00:00.000Z'}},
    plannedRouteByDeal:{}
  };
}
function aiSnapshot(){
  return {
    generatedAt:'2026-09-18T12:00:00.000Z',
    financeFragment:{sourceAsOf:'2026-09-18T12:00:00.000Z'},
    paymentsV7Projection:{deals:[],items:[]},
    tariffs:[],
    employees:[],
    conclusions:[]
  };
}

const pages=['home','prices','applications','deals','documents','payments','accounting','monitoring','messages','analytics','access','claims','agent-settlements','market-news'];
const labels={home:'Главная',prices:'Цены',applications:'Заявки',deals:'Сделки',documents:'Документы',payments:'Платежи',accounting:'Касса',monitoring:'Онлайн ЖД',messages:'Радиорубка',analytics:'Аналитика',access:'Управление доступом',claims:'Претензии','agent-settlements':'Расчёты агентов','market-news':'Новости рынка'};
const html=[
  '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>',
  'html,body{margin:0;min-height:100%;background:#06111c;color:#fff;font-family:Arial,sans-serif}',
  '#nav{display:flex;flex-wrap:wrap;gap:6px;padding:8px}.page{display:none;padding:10px}.page.active{display:block}',
  '.rona-owner-page-content{min-height:120px}.rona-owner-card{padding:10px;border:1px solid #345;border-radius:10px}',
  '</style><script>',
  'window.__RONA_ADMIN_BOOT_STATE__={ready:true};',
  'window.__RONA_ADMIN_LIVE_READY__=true;',
  'window.__RONA_ADMIN_SELECTED_PAGE__=()=>document.querySelector("#nav button[data-page].active")?.dataset?.page||document.documentElement.dataset.ronaAdminPage||"monitoring";',
  'document.documentElement.dataset.ronaAdminPage="monitoring";',
  '</script></head><body class="admin-auth-server-verified">',
  '<nav id="nav">',
  ...pages.map(p=>'<button data-page="'+p+'"'+(p==='monitoring'?' class="active" aria-current="page"':'')+'>'+labels[p]+'</button>'),
  '</nav>',
  ...pages.map(p=>'<section id="page-'+p+'" class="page'+(p==='monitoring'?' active':'')+'"><div class="rona-owner-page-content" data-owner-page="'+p+'"></div></section>'),
  '<script src="/portal/main-ui.js"></script>',
  '<script src="/portal/rail-current-v81-maplibre-ui.js"></script>',
  '<script src="/assets/portal-admin-runtime-watchdog-v1.js"></script>',
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
  if(u.pathname==='/portal/main-ui.js')return send(res,200,adminScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/portal/rail-current-v81-maplibre-ui.js')return send(res,200,railScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/assets/portal-admin-runtime-watchdog-v1.js')return send(res,200,watchdogScript,'application/javascript; charset=utf-8');

  if(u.pathname==='/portal/owner-api'){
    const path=u.searchParams.get('path')||'';
    if(path==='/admin/bootstrap'){bootstrapRequests++;return json(res,{ok:true,data:snapshot()})}
    if(path==='/admin/ai-sync'){aiRequests++;return json(res,{ok:true,data:aiSnapshot()})}
    if(path==='/agent/ai-sync')return json(res,{ok:true,data:{}});
    return json(res,{ok:true,data:{}});
  }
  if(u.pathname==='/portal/api/v1/admin/bootstrap')return json(res,{ok:true,data:snapshot()});
  if(u.pathname==='/qa/counts')return json(res,{bootstrapRequests,aiRequests});
  if(u.pathname.startsWith('/portal/map-assets/osm/'))return send(res,204,'','image/png');
  if((u.pathname.startsWith('/portal/')||u.pathname.startsWith('/assets/'))&&u.pathname.endsWith('.js'))return send(res,200,'','application/javascript; charset=utf-8');
  if(u.pathname.startsWith('/assets/'))return send(res,204,'','application/octet-stream');
  return send(res,404,'not found');
});

await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const close=(a,b,eps=1e-7)=>Math.abs(Number(a)-Number(b))<=eps;

async function counts(){return fetch(origin+'/qa/counts').then(r=>r.json())}
async function assertStable(page,label,expectedView){
  const s=await page.evaluate(()=>({
    rootSame:document.querySelector('#page-monitoring [data-rail-current-v4="ready"],#page-monitoring [data-rail-current-root="ready"]')===window.__A1_RAIL_ROOT__,
    hostSame:document.querySelector('#page-monitoring>.rona-owner-page-content')===window.__A1_RAIL_HOST__,
    dealLabel:document.querySelector('#page-monitoring .rona-rail-v6-select-label')?.textContent||'',
    legacyLabel:[...document.querySelectorAll('#page-monitoring .rona-owner-actions span')].some(x=>String(x.textContent||'').trim()==='ГУ-12'),
    legacyFunction:typeof window.renderRail==='function',
    view:window.__RONA_RAIL_MAP_ACTIVE_VIEW__?{...window.__RONA_RAIL_MAP_ACTIVE_VIEW__}:null,
    observer:{...window.__A1_RAIL_OBSERVER_STATE__},
    currentOwner:window.__RONA_RAIL_SINGLE_OWNER__||null
  }));
  assert(s.rootSame,label+': current Rail root identity changed');
  assert(s.hostSame,label+': monitoring host identity changed');
  assert(s.dealLabel==='Сделка',label+': Deal selector lost');
  assert(s.legacyLabel===false,label+': legacy GU-12 selector appeared');
  assert(s.legacyFunction===false,label+': legacy renderRail function became reachable');
  assert(s.observer.legacySeen===0,label+': observer saw legacy Rail takeover');
  assert(s.observer.rootReplaced===0,label+': observer saw current root replacement');
  assert(s.currentOwner==='stage-a1-current-only-v1',label+': single-owner marker missing');
  if(expectedView){
    assert(s.view&&s.view.zoom===expectedView.zoom&&close(s.view.lat,expectedView.lat)&&close(s.view.lng,expectedView.lng),label+': viewport changed');
  }
  return s;
}
async function railSync(page,label,expectedView){
  const before=await counts();
  await page.evaluate(()=>window.__RONA_RAIL_CURRENT_REPAIR__());
  const deadline=Date.now()+4000;
  while(Date.now()<deadline){
    const now=await counts();
    if(now.bootstrapRequests>before.bootstrapRequests){
      await assertStable(page,label,expectedView);
      return now;
    }
    await sleep(50);
  }
  throw new Error(label+': Rail sync did not perform bootstrap');
}
async function watchdogCycle(page,label,expectedView){
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rona:admin-single-owner-ready')));
  await sleep(900);
  const status=await page.evaluate(()=>window.__RONA_ADMIN_RUNTIME_RECOVERY__?.status||'');
  assert(/^READY:monitoring$/.test(status),label+': watchdog status '+status);
  await assertStable(page,label,expectedView);
}
async function adminRefresh(page,label,expectedView){
  await page.evaluate(async()=>{if(typeof window.__RONA_OWNER_ADMIN_REFRESH_TICK__!=='function')throw new Error('ownerAdminRefreshTick hook missing');await window.__RONA_OWNER_ADMIN_REFRESH_TICK__(true)});
  await assertStable(page,label,expectedView);
}
async function aiRefresh(page,label,expectedView){
  await page.evaluate(async()=>{if(typeof window.__RONA_OWNER_AI_REFRESH__!=='function')throw new Error('AI refresh hook missing');await window.__RONA_OWNER_AI_REFRESH__(false)});
  await assertStable(page,label,expectedView);
}

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{
    if(m.type()==='error'){
      const t=m.text();
      if(!/Failed to load resource/.test(t))errors.push(t);
    }
  });

  const started=Date.now();
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey&&document.querySelector('#page-monitoring .rona-rail-v7-map-viewport'),{timeout:12000});
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:12000});

  await page.waitForFunction(()=>typeof window.__RONA_OWNER_ADMIN_RENDER__==='function'&&typeof window.__RONA_OWNER_ADMIN_REFRESH_TICK__==='function'&&typeof window.__RONA_OWNER_AI_REFRESH__==='function',{timeout:12000});
  const runtimeFns=await page.evaluate(()=>({
    renderAdmin:typeof window.__RONA_OWNER_ADMIN_RENDER__,
    ownerAdminRefreshTick:typeof window.__RONA_OWNER_ADMIN_REFRESH_TICK__,
    aiRefresh:typeof window.__RONA_OWNER_AI_REFRESH__,
    legacyRenderRail:typeof window.renderRail,
    owner:window.__RONA_RAIL_SINGLE_OWNER__||null
  }));
  assert(runtimeFns.renderAdmin==='function','renderAdmin hook is not callable');
  assert(runtimeFns.ownerAdminRefreshTick==='function','Admin refresh hook is not callable');
  assert(runtimeFns.aiRefresh==='function','AI refresh hook is not callable');
  assert(runtimeFns.legacyRenderRail==='undefined','legacy renderRail is present in active runtime');
  assert(runtimeFns.owner==='stage-a1-current-only-v1','Stage A.1 owner marker missing');

  const plus=page.getByRole('button',{name:'Приблизить карту'});
  await plus.click();await plus.click();await plus.click();
  const viewport=page.locator('.rona-rail-v7-map-viewport');
  await viewport.focus();await viewport.press('ArrowRight');await viewport.press('ArrowDown');

  const baseline=await page.evaluate(()=>{
    const root=document.querySelector('#page-monitoring [data-rail-current-v4="ready"],#page-monitoring [data-rail-current-root="ready"]');
    const host=document.querySelector('#page-monitoring>.rona-owner-page-content');
    window.__A1_RAIL_ROOT__=root;
    window.__A1_RAIL_HOST__=host;
    window.__A1_RAIL_OBSERVER_STATE__={legacySeen:0,rootReplaced:0,mutations:0};
    window.__A1_RAIL_OBSERVER__=new MutationObserver(()=>{
      const s=window.__A1_RAIL_OBSERVER_STATE__;s.mutations++;
      const current=document.querySelector('#page-monitoring [data-rail-current-v4="ready"],#page-monitoring [data-rail-current-root="ready"]');
      if(current!==window.__A1_RAIL_ROOT__)s.rootReplaced++;
      const legacy=[...document.querySelectorAll('#page-monitoring .rona-owner-actions span')].some(x=>String(x.textContent||'').trim()==='ГУ-12');
      if(legacy)s.legacySeen++;
    });
    window.__A1_RAIL_OBSERVER__.observe(document.querySelector('#page-monitoring'),{childList:true,subtree:true});
    return {
      view:{...window.__RONA_RAIL_MAP_ACTIVE_VIEW__},
      dealLabel:document.querySelector('.rona-rail-v6-select-label')?.textContent||'',
      rootReady:!!root
    };
  });
  assert(baseline.rootReady&&baseline.dealLabel==='Сделка','Stage A root/Deal selector not ready');
  assert(baseline.view.zoom>=6,'map was not zoomed +3');
  assert(!close(baseline.view.lat,52.5)||!close(baseline.view.lng,68),'map was not panned');

  // Direct legacy trigger path: renderAdmin() repeatedly.
  for(let i=0;i<3;i++){
    await page.evaluate(()=>window.__RONA_OWNER_ADMIN_RENDER__());
    await assertStable(page,'renderAdmin-'+(i+1),baseline.view);
  }

  await adminRefresh(page,'admin-refresh-1',baseline.view);
  await aiRefresh(page,'ai-refresh-1',baseline.view);
  await railSync(page,'rail-sync-1',baseline.view);
  await watchdogCycle(page,'watchdog-1',baseline.view);

  // Let the runtime live; this window also allows the real AI-sync startup/interval path to execute.
  await sleep(30000);

  await page.evaluate(()=>window.__RONA_OWNER_ADMIN_RENDER__());
  await assertStable(page,'renderAdmin-t30',baseline.view);
  await railSync(page,'rail-sync-2',baseline.view);
  await watchdogCycle(page,'watchdog-2',baseline.view);

  // Required Rail -> Payments -> Rail navigation.
  await page.locator('#nav button[data-page="payments"]').click();
  await sleep(250);
  await page.locator('#nav button[data-page="monitoring"]').click();
  await sleep(600);
  await assertStable(page,'navigation-payments-rail',baseline.view);

  await sleep(30000);

  await adminRefresh(page,'admin-refresh-2',baseline.view);
  await aiRefresh(page,'ai-refresh-2',baseline.view);
  await page.evaluate(()=>window.__RONA_OWNER_ADMIN_RENDER__());
  await assertStable(page,'renderAdmin-t60',baseline.view);
  await railSync(page,'rail-sync-3',baseline.view);
  await watchdogCycle(page,'watchdog-3',baseline.view);

  // Neighbor smoke without mutations.
  for(const id of ['home','payments','deals','access','accounting']){
    await page.locator('#nav button[data-page="'+id+'"]').click();
    await sleep(180);
    const active=await page.evaluate(pageId=>document.getElementById('page-'+pageId)?.classList.contains('active')===true,id);
    assert(active,'neighbor page did not activate: '+id);
  }
  await page.locator('#nav button[data-page="monitoring"]').click();
  await sleep(600);
  await assertStable(page,'neighbor-smoke-return-rail',baseline.view);

  const elapsed=Date.now()-started;
  if(elapsed<92000)await sleep(92000-elapsed);

  const final=await assertStable(page,'final-90s',baseline.view);
  const requestCounts=await counts();
  const runtimeMs=Date.now()-started;
  assert(runtimeMs>=90000,'runtime proof shorter than 90 seconds: '+runtimeMs);
  assert(requestCounts.aiRequests>=2,'expected at least two AI refresh requests over 90s; got '+requestCounts.aiRequests);
  assert(requestCounts.bootstrapRequests>=5,'expected bootstrap/admin/rail refresh traffic; got '+requestCounts.bootstrapRequests);
  assert(final.observer.legacySeen===0&&final.observer.rootReplaced===0,'legacy takeover/root replacement observed');
  assert(errors.length===0,'browser errors: '+errors.join(' | '));

  console.log('ISSUE644_A1_ACTIVE_LEGACY_RENDERER_ABSENT=PASS');
  console.log('ISSUE644_A1_RENDER_ADMIN_SINGLE_OWNER=PASS');
  console.log('ISSUE644_A1_ADMIN_REFRESH_SINGLE_OWNER=PASS');
  console.log('ISSUE644_A1_AI_REFRESH_2X_SINGLE_OWNER=PASS');
  console.log('ISSUE644_A1_AI_REFRESH_90S_SINGLE_OWNER=PASS');
  console.log('ISSUE644_A1_RAIL_SYNC_3X_SINGLE_OWNER=PASS');
  console.log('ISSUE644_A1_WATCHDOG_3X_SINGLE_OWNER=PASS');
  console.log('ISSUE644_A1_NAV_PAYMENTS_RAIL_SINGLE_OWNER=PASS');
  console.log('ISSUE644_A1_VIEWPORT_PERSIST_90S=PASS');
  console.log('ISSUE644_A1_NEIGHBOR_SMOKE=PASS');
  console.log(JSON.stringify({runtimeMs,requestCounts,baseline,final,errors}));
  await context.close();
}catch(error){
  console.error('ISSUE644_STAGE_A1_SINGLE_OWNER_BROWSER_QA=FAIL',error?.stack||error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
