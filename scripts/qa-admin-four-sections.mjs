import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { onRequest as mainUiRequest } from '../functions/portal/main-ui.js';
import { onRequest as pricesUiRequest } from '../functions/portal/prices-current-ui.js';
import { onRequest as analyticsUiRequest } from '../functions/portal/analytics-v2-ui.js';
import { onRequest as railStableRequest } from '../functions/portal/rail-current-stable-ui.js';

const ROOT=process.cwd(),DIST=join(ROOT,'dist'),now=new Date().toISOString();
const ONE_PIXEL=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const adminBootstrap={
  clients:[{client_id:'RONA-QA-C001',legal_name:'QA Client',contract_id:'RONA-QA-CTR-001',current_external_contract_number:'QA-001',agent_person_id:'RONA-QA-A001'}],
  companies:[{client_id:'RONA-QA-C001',legal_name:'QA Client',contract_id:'RONA-QA-CTR-001',current_external_contract_number:'QA-001',agent_person_id:'RONA-QA-A001'}],
  agents:[{agent_person_id:'RONA-QA-A001',agent_name:'QA Agent'}],
  prices:[
    {product:'СУГ',producer:'АО «Мозырский НПЗ»',supplier:'RONA Trade',final_station:'Наушки',basis:'CPT Наушки',sale_price:702,currency:'USD',business_status:'PUBLISHED',commercial_terms:'Период поставки: сентябрь 2026',payment_terms:'100% предоплата'},
    {product:'СУГ',producer:'АО «Мозырский НПЗ»',supplier:'RONA Trade',final_station:'Сарыагаш',basis:'CPT Сарыагаш',sale_price:730,currency:'USD',business_status:'PUBLISHED',commercial_terms:'Период поставки: сентябрь 2026',payment_terms:'100% предоплата'}
  ],
  applications:[],deals:[],documents:[],payments:[],cash:[],claims:[],publications:[],operationalConflicts:[],radio:[],
  exchange:{active_targets:1,conflicts:0},
  rail:[{gu12_number:'GU12-QA-001',document_number:'GU12-QA-001',status:'ACTIVE',wagons:[{wagonNumber:'QA-12345678',lastPositionAt:now,station:'Алматы',latitude:43.238949,longitude:76.889709}]}],
  agentRewards:[]
};
const authority={
  accessUsers:[],
  contracts:[{contractId:'RONA-QA-CTR-001',id:'RONA-QA-CTR-001',contractStatus:'ACTIVE',status:'ACTIVE',clientId:'RONA-QA-C001',company:'QA Client',externalContractNumber:'QA-001'}],
  signedContractGate:{contracts:[{contractId:'RONA-QA-CTR-001',bilateralSignedConfirmed:false,serverConfirmed:false}]}
};
const readiness={matrixReady:true,profiles:[{agentPersonId:'RONA-QA-A001',displayAlias:'QA Agent'}]};
const updates={generatedAt:now,currentPublicationId:'RONA-PRICE-LIST-2026-09-R4',clientEnabled:true,agentEnabled:true,proposals:[],history:[],agentCommercialProposals:[],updateAvailableCount:0};
const zero={sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0};
const aiSync={generatedAt:now,marketAnalystFragment:{generatedAt:now,analytics:[],news:[],currentPublications:[]},homeCoordination:{generatedAt:now,totals:{TODAY:zero,'7D':zero,'30D':zero,ALL:zero},periods:{TODAY:[],'7D':[],'30D':[],ALL:[]},recent:[]},agentRewardsFragment:{generatedAt:now,rows:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'qa'}};

const responseText=async response=>{if(!response||response.status!==200)throw new Error(`UI_RESPONSE_${response?.status||'NULL'}`);return response.text()};
const mainUi=await responseText(await mainUiRequest());
const pricesUi=await responseText(await pricesUiRequest());
const analyticsUi=await responseText(await analyticsUiRequest());
const railUi=await responseText(await railStableRequest({}));

function send(res,status,body,type='text/plain; charset=utf-8',headers={}){res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}
function safeDistPath(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':'application/octet-stream'}
async function serveFile(res,path,type){try{const b=await readFile(path);send(res,200,b,type||mime(path));return true}catch{return false}}
const blankUi=new Set(['/portal/deals-current-state-ui','/portal/deals-r1-r11-ui','/portal/cash-r2-ui','/portal/applications-total-kpi-ui']);
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1'),p=u.pathname;
  if(p==='/favicon.ico')return send(res,204,'');
  if(p.startsWith('/portal/map-assets/osm/'))return send(res,200,ONE_PIXEL,'image/png');
  if(p==='/portal/admin')return void await serveFile(res,join(DIST,'portal','admin.html'),'text/html; charset=utf-8');
  if(p==='/portal/main-ui')return send(res,200,mainUi,'application/javascript; charset=utf-8');
  if(p==='/portal/prices-current-ui')return send(res,200,pricesUi,'application/javascript; charset=utf-8');
  if(p==='/portal/analytics-v2-ui')return send(res,200,analyticsUi,'application/javascript; charset=utf-8');
  if(p==='/portal/rail-current-stable-ui')return send(res,200,railUi,'application/javascript; charset=utf-8');
  if(p==='/portal/rail-current-v81-maplibre-ui')return send(res,200,"window.__RONA_QA_OLD_RAIL_LOADER__='non-rendering';",'application/javascript; charset=utf-8');
  if(p==='/portal/clients-agents-current-ui'||p==='/portal/claims-r2-ui'||p==='/portal/remaining-sections-ui')return void await serveFile(res,join(DIST,p),'application/javascript; charset=utf-8');
  if(blankUi.has(p))return send(res,200,'/* QA optional current module */','application/javascript; charset=utf-8');
  if(p==='/portal/api/session/me')return json(res,{ok:true,user:{roles:['ADMIN'],display_name:'QA Admin'}});
  if(p==='/portal/api/v1/admin/bootstrap')return json(res,{ok:true,data:adminBootstrap});
  if(p==='/portal/logout')return json(res,{ok:true});
  if(p==='/portal/admin-authority/bootstrap')return json(res,{ok:true,data:authority});
  if(p==='/portal/admin-authority/agent-readiness')return json(res,{ok:true,data:readiness});
  if(p.startsWith('/portal/admin-authority/'))return json(res,{ok:true,data:{}});
  if(p==='/portal/owner-api'){
    const op=u.searchParams.get('path')||'';
    if(op==='/admin/bootstrap')return json(res,{ok:true,data:adminBootstrap});
    if(op==='/admin/ai-sync')return json(res,{ok:true,data:aiSync});
    if(op==='/admin/claims')return json(res,{ok:true,data:{claims:[]}});
    if(op==='/admin/analytics-bootstrap')return json(res,{ok:true,data:{generatedAt:now,marketNewsFeed:[]}});
    return json(res,{ok:true,data:{}});
  }
  if(p==='/portal/price-updates-api'){
    const op=u.searchParams.get('op')||'';
    if(op==='bootstrap')return json(res,{ok:true,data:updates});
    if(op==='cp-bootstrap')return json(res,{ok:false,code:'Could not find the function public.owner_agent_cp_owner_gate_bootstrap with parameters in the schema cache'},409);
    return json(res,{ok:true,data:{}});
  }
  const f=safeDistPath(p);if(f&&await serveFile(res,f))return;send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;
const failures=[];const assert=(v,m)=>{if(!v)throw new Error(m)};const compact=v=>String(v||'').replace(/\s+/g,' ').trim();
async function click(page,key){const b=page.locator(`#nav button[data-page="${key}"]`);await b.waitFor({state:'visible',timeout:10000});await b.click();await page.locator(`#page-${key}.active`).waitFor({state:'visible',timeout:10000});await page.waitForTimeout(500);const selected=await page.evaluate(()=>document.documentElement.dataset.ronaAdminPage||'');assert(selected===key,`${key}: router switched to ${selected}`)}
let browser;
try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1920,height:1080}});const page=await context.newPage();
  page.on('pageerror',e=>failures.push(`pageerror:${String(e.message||e)}`));
  page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400&&!(r.url().includes('op=cp-bootstrap')&&r.status()===409))failures.push(`http:${r.status()}:${r.url()}`)});
  page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))failures.push(`console:${m.text()}`)});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__RONA_ADMIN_FOUR_SECTIONS_RECOVERY__==='20260826-v1',{timeout:10000});
  await page.waitForFunction(()=>window.__RONA_ADMIN_CURRENT_NAV_OWNER_GUARD__==='20260826-v1',{timeout:10000});
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});

  await click(page,'prices');
  await page.locator('#page-prices #rona-prices-current').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>window.__RONA_PRICES_CURRENT_ERROR__===null,{timeout:10000});
  const priceText=await page.locator('#page-prices').innerText();
  assert(priceText.includes('Цены и маржа'),'prices: canonical title missing');
  assert(priceText.includes('RONA-PRICE-LIST-2026-09-R4'),'prices: R4 publication missing');
  assert(priceText.includes('702'),'prices: current Naushki price missing');
  assert(!priceText.includes('временно недоступен'),'prices: error placeholder visible');
  assert(await page.evaluate(()=>window.__RONA_AGENT_CP_OWNER_GATE_RETIRED__===true),'prices: retired CP bridge not exercised');

  await click(page,'monitoring');
  await page.waitForFunction(()=>!!window.__RONA_RAIL_CURRENT_STATE__,{timeout:10000});
  const railText=await page.locator('#page-monitoring').innerText();
  assert(railText.includes('Онлайн ЖД'),'rail: title missing');
  assert(railText.includes('GU12-QA-001')||railText.includes('QA-12345678'),'rail: functional rail data missing');

  await click(page,'access');
  await page.locator('#page-access [data-rona-create-access="primary"]').waitFor({state:'visible',timeout:10000});
  await page.locator('#page-access [data-rona-create-access="primary"]').click();
  const modal=page.locator('.rona-access-full');await modal.waitFor({state:'visible',timeout:5000});
  const accessText=compact(await modal.innerText());
  for(const marker of ['Тип доступа','Ф.И.О.','Телефон','Роль привязки','Компании и договоры клиента','Открыть без контракта','Загрузить договор'])assert(accessText.includes(marker),`access: missing ${marker}`);
  assert(await modal.locator('input[placeholder="Единый логин"]').count()===1,'access: separate login missing');
  assert(await modal.locator('input[type="email"]').count()===1,'access: separate email missing');
  assert(await page.locator('.ca-modal').count()===0,'access: simplified competing modal opened');
  await modal.locator('select').first().selectOption('Агент');await page.waitForTimeout(100);
  assert(compact(await modal.innerText()).includes('Профиль агента'),'access: agent profile missing');
  await modal.locator('button:has-text("Отмена")').click();

  await click(page,'analytics');
  await page.locator('#page-analytics #rona-analytics-v2').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>window.__RONA_ANALYTICS_V2_READY__===true,{timeout:10000});
  const analyticsText=await page.locator('#page-analytics #rona-analytics-v2').innerText();
  for(const marker of ['Аналитика','Динамика АИ-92','Прогноз рынка','Возможные цены RONA Trade','Комментарий Коммерческого директора'])assert(analyticsText.includes(marker),`analytics: missing ${marker}`);
  const analyticsVisible=await page.locator('#page-analytics #rona-analytics-v2').evaluate(n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden');
  assert(analyticsVisible,'analytics: canonical visual owner hidden');
  assert(failures.length===0,'browser errors: '+failures.join(' | '));
  console.log('ADMIN_FOUR_SECTIONS_QA=PASS');
  console.log(JSON.stringify({origin,prices:true,rail:true,fullAccess:true,analytics:true,failures}));
  await context.close();
}catch(e){console.error('ADMIN_FOUR_SECTIONS_QA=FAIL',e?.stack||e);if(failures.length)console.error(JSON.stringify({failures}));process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}