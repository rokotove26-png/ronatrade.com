import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';
import {onRequest as serveDealsCurrentUi} from '../functions/portal/deals-current-state-ui.js';

const completed={application_id:'VIS-IN-DONE',client_id:'VIS-C-DONE',legal_name:'Север Энерго',contract_id:'VIS-CTR-DONE',deal_id:'VIS-DEAL-1024',deal_status:'EXECUTING',product:'СУГ СПБТ',quantity_tonnes:240,delivery_basis:'CPT',destination:'ст. Тестовая',payment_terms:'100% предоплата',proposed_price:725,proposed_currency:'USD',status:'DEAL_REGISTERED',owner_status:'DEAL',lifecycle_state:'ARCHIVED'};
const active={application_id:'VIS-IN-ACTIVE',client_id:'VIS-C-ACTIVE',legal_name:'Транс Нефть Сервис',contract_id:'VIS-CTR-ACTIVE',deal_id:null,product:'ДТ',quantity_tonnes:120,status:'ACCEPTED_AWAITING_DEAL_REGISTRATION',owner_status:'SUPPLIER_APPROVED',lifecycle_state:'ACTIVE'};
const fresh={application_id:'VIS-IN-NEW',client_id:'VIS-C-NEW',legal_name:'Регион Трейд',contract_id:'VIS-CTR-NEW',deal_id:null,product:'АИ-92',quantity_tonnes:80,status:'NEW',owner_status:'NEW',lifecycle_state:'ACTIVE'};
const decision={application_id:'VIS-IN-DECISION',client_id:'VIS-C-DECISION',legal_name:'Юг Топливо',contract_id:'VIS-CTR-DECISION',deal_id:'VIS-DEAL-PENDING',deal_status:'SUPPLIER_PENDING',product:'СУГ',quantity_tonnes:160,status:'DEAL_REGISTERED',owner_status:'SUPPLIER_PENDING',lifecycle_state:'ACTIVE'};
const deals=[
  {deal_id:'VIS-DEAL-1024',application_id:'VIS-IN-DONE',client_id:'VIS-C-DONE',legal_name:'Север Энерго',business_status:'EXECUTING',contract_id:'VIS-CTR-DONE',source_product:'СУГ СПБТ',source_quantity_tonnes:240,resource_status:'CONFIRMED'},
  {deal_id:'VIS-DEAL-1025',application_id:'VIS-IN-SECOND',client_id:'VIS-C-SECOND',legal_name:'Волга Ресурс',business_status:'REGISTERED',contract_id:'VIS-CTR-SECOND',source_product:'ДТ',source_quantity_tonnes:90,resource_status:'PENDING'}
];
const adminData={generatedAt:'2026-09-12T09:00:00.000Z',applications:[fresh,active,decision,completed],clients:[{client_id:'VIS-C-DONE'},{client_id:'VIS-C-ACTIVE'},{client_id:'VIS-C-NEW'}],agents:[],prices:[],deals,dealDocuments:[{document_id:'VIS-DOC-1',deal_id:'VIS-DEAL-1024',document_kind:'SIGNED_ADDENDUM',authoritative_filename:'signed-addendum.pdf'}],paymentPlan:[],paymentTotals:{received:0,planned:0},cash:[],rail:[{deal_id:'VIS-DEAL-1024',gu12_number:'GU12-1',route_text:'A → B',wagons:[{wagonNumber:'001',status:'WAIT'}]}],operationalConflicts:[{kind:'Проверка документа',entity_id:'VIS-DEAL-1025',reason:'Требует внимания'}],radio:[],analytics:[],news:[],exchange:{status:'HEALTHY',last_success:'2026-09-12T08:55:00Z'}};
const core={applications:[{...completed,current_external_contract_number:'HIST-CTR-2026-77'}],client_intake:[],contracts:[],deals,clients:[]};
const currentDealsData={generatedAt:'2026-09-12T09:00:00.000Z',deals:[
  {deal_id:'VIS-DEAL-1024',application_id:'VIS-IN-DONE',client_id:'VIS-C-DONE',legal_name:'Север Энерго',business_status:'EXECUTING',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',contract_id:'VIS-CTR-DONE',contract_status:'ACTIVE',contract_client_conflict:false,source_product:'СУГ СПБТ',product_value:'СУГ СПБТ',producer_value:'Производитель',product_confirmed_at:'2026-09-11T10:00:00Z',source_quantity_tonnes:240,quantity_tonnes_value:240,quantity_confirmed_at:'2026-09-11T10:00:00Z',delivery_basis:'CPT, Incoterms 2020',obligation_amount:174000,received_amount:170000,client_remaining_amount:4000,finance_currency:'USD',finance_status:'DUE',accounting_status:'OPEN',payment_expectation_state:'ACTIVE',payment_handoff_state:'NOT_SENT'},
  {deal_id:'VIS-DEAL-1025',application_id:'VIS-IN-SECOND',client_id:'VIS-C-SECOND',legal_name:'Волга Ресурс',business_status:'REGISTERED',lifecycle_state:'ACTIVE',cancellation_state:'ACTIVE',contract_id:'VIS-CTR-SECOND',contract_status:'ACTIVE',contract_client_conflict:false,source_product:'ДТ',source_quantity_tonnes:90,delivery_basis:'FCA',obligation_amount:90000,received_amount:0,client_remaining_amount:90000,finance_currency:'USD',finance_status:'NOT_DUE',accounting_status:'OPEN',payment_expectation_state:'INACTIVE',payment_handoff_state:'NOT_SENT'}
],documents:[{document_id:'VIS-ADD-1',deal_id:'VIS-DEAL-1024',document_kind:'ADDENDUM',authoritative_filename:'addendum.pdf'},{document_id:'VIS-INV-1',deal_id:'VIS-DEAL-1024',document_kind:'INVOICE',authoritative_filename:'invoice.pdf'},{document_id:'VIS-SIGNED-1',deal_id:'VIS-DEAL-1024',document_kind:'SIGNED_ADDENDUM',authoritative_filename:'signed-addendum.pdf'}],rail:[{deal_id:'VIS-DEAL-1024',gu12_number:'GU12-1',route_text:'A → B',wagons:[{wagonNumber:'001',status:'WAIT'}]}],dataConflicts:[]};
const homeRows=[{role:'OPERATIONS_DIRECTOR',display_name:'Операционный директор',sent:7,responses:6,awaiting:1,sla_breached:0,errors:0,last_response_at:'2026-09-12T08:58:00Z'}];
const aiSync={generatedAt:'2026-09-12T09:00:00Z',railTariffs:[],financeFragment:null,agentRewardsFragment:{rows:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'v1'},homeCoordination:{generatedAt:'2026-09-12T09:00:00Z',totals:{TODAY:{sent:7,responses:6,awaiting:1,slaBreached:0,errors:0,portalRequests:3},'7D':{sent:22,responses:20,awaiting:2,slaBreached:1,errors:0,portalRequests:8},'30D':{sent:70,responses:68,awaiting:2,slaBreached:1,errors:0,portalRequests:19},ALL:{sent:94,responses:91,awaiting:3,slaBreached:1,errors:0,portalRequests:30}},periods:{TODAY:homeRows,'7D':homeRows,'30D':homeRows,ALL:homeRows},recent:[]}};

let shell=await readFile('portal-src/current/admin.html','utf8');
shell=shell.replace(/<script id="rona-[^>]+src="[^"]+"[^>]*><\/script>\s*/g,'');
shell=shell.replace('</body>','<script src="/portal/main-ui"></script><script src="/portal/deals-current-state-ui"></script></body>');
const mainResponse=await serveAdminMainUi({});
assert.equal(mainResponse.status,200);
assert.equal(mainResponse.headers.get('x-rona-admin-visual-revision'),'silver-steel-v2');
const mainScript=await mainResponse.text();
const dealsResponse=await serveDealsCurrentUi({});assert.equal(dealsResponse.status,200);const dealsScript=await dealsResponse.text();
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);const send=(status,type,body,headers={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)};
  if(url.pathname==='/portal/admin')return send(200,'text/html; charset=utf-8',shell);
  if(url.pathname==='/portal/main-ui')return send(200,'application/javascript; charset=utf-8',mainScript);
  if(url.pathname==='/portal/deals-current-state-ui')return send(200,'application/javascript; charset=utf-8',dealsScript);
  if(url.pathname==='/portal/admin-completed-bootstrap')return send(200,'application/json',JSON.stringify({ok:true,data:adminData}));
  if(url.pathname==='/portal/api/v1/admin/bootstrap')return send(200,'application/json',JSON.stringify({ok:true,data:core}));
  if(url.pathname==='/portal/owner-api'){
    const path=String(url.searchParams.get('path')||'');
    if(path==='/admin/ai-sync')return send(200,'application/json',JSON.stringify({ok:true,data:aiSync}));
    if(path==='/admin/bootstrap')return send(200,'application/json',JSON.stringify({ok:true,data:adminData}));
    if(path==='/admin/workflow-bootstrap')return send(200,'application/json',JSON.stringify({ok:true,data:currentDealsData}));
    return send(200,'application/json',JSON.stringify({ok:true,data:{}}));
  }
  if(url.pathname.startsWith('/assets/'))return send(204,'text/plain','');
  return send(404,'text/plain','not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([{name:'rona_portal_at',value:'runtime-admin-token',url:origin,httpOnly:true,sameSite:'Lax'}]);
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errors.push(m.text())});
const px=s=>Number.parseFloat(String(s||'0'))||0;
async function activate(id){await page.click(`#nav button[data-page="${id}"]`);await page.waitForFunction(x=>document.getElementById('page-'+x)?.classList.contains('active'),id)}
try{
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true&&window.__RONA_ADMIN_VISUAL_REVISION_V2__&&window.__RONA_ADMIN_VISUAL_REVISION_V2_POLISH__&&document.documentElement.classList.contains('rona-admin-visual-v2'),null,{timeout:12000});
  await page.waitForFunction(()=>window.__RONA_DEALS_CURRENT_STATE__&&document.documentElement.classList.contains('rona-deals-current-ready'),null,{timeout:12000});
  await activate('home');
  const homeTitle=page.locator('#ronaAdminV2HomeTitle h1');await homeTitle.waitFor({state:'visible',timeout:8000});assert.equal((await homeTitle.textContent())?.trim(),'Главная');
  assert.ok(px(await homeTitle.evaluate(el=>getComputedStyle(el).fontSize))>=40,'Home title typography must be visibly primary');
  const homeBg=await page.locator('#page-home').evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(homeBg,/radial-gradient/);assert.match(homeBg,/linear-gradient/);
  const homeKpi=page.locator('#page-home .rona-ops-v4-metric__value').first();await homeKpi.waitFor({state:'visible',timeout:8000});assert.ok(px(await homeKpi.evaluate(el=>getComputedStyle(el).fontSize))>=38,'Home KPI values must be amplified');

  await activate('applications');
  const appHero=page.locator('#page-applications .rona-admin-v2-hero').first();await appHero.waitFor({state:'visible',timeout:8000});
  const appHeroBg=await appHero.evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(appHeroBg,/radial-gradient/);assert.match(appHeroBg,/linear-gradient/);
  assert.ok(px(await appHero.locator('h1').evaluate(el=>getComputedStyle(el).fontSize))>=40,'Applications page title must be amplified');
  const appId=page.locator('#page-applications tbody [data-rona-col="application-id"]').first();await appId.waitFor({state:'visible',timeout:8000});assert.ok(px(await appId.evaluate(el=>getComputedStyle(el).fontSize))>=13,'Application ID must be visually emphasized');
  const appCellBg=await appId.evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(appCellBg,/linear-gradient/,'Applications row must use steel gradient hierarchy');

  await activate('deals');
  const dealHero=page.locator('#page-deals .rona-admin-v2-hero').first();await dealHero.waitFor({state:'visible',timeout:8000});
  const dealHeroBg=await dealHero.evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(dealHeroBg,/radial-gradient/);assert.match(dealHeroBg,/linear-gradient/);
  assert.ok(px(await dealHero.locator('h1').evaluate(el=>getComputedStyle(el).fontSize))>=40,'Deals page title must be amplified');
  const dealId=page.locator('#page-deals tbody [data-rona-col="deal-id"],#page-deals .rona-current-deal-table tbody td:first-child').first();await dealId.waitFor({state:'visible',timeout:8000});assert.ok(px(await dealId.evaluate(el=>getComputedStyle(el).fontSize))>=13,'Deal ID must remain primary');
  const dealCellBg=await dealId.evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(dealCellBg,/linear-gradient/,'Deals row must use steel gradient hierarchy');
  const dealKpi=page.locator('#page-deals .rona-current-deal-kpi .rona-owner-kpi').first();if(await dealKpi.count())assert.ok(px(await dealKpi.evaluate(el=>getComputedStyle(el).fontSize))>=34,'Deals KPI must be amplified');
  assert.deepEqual(errors,[],'V2 visual runtime must not add browser errors');
  console.log('ADMIN_VISUAL_REVISION_V2_BROWSER=PASS HOME_TITLE_VISIBLE=PASS SILVER_GRAPHITE_PALETTE=PASS TYPOGRAPHY_HIERARCHY=PASS KPI_VISUAL_HIERARCHY=PASS APPLICATIONS_VISUAL_HIERARCHY=PASS DEALS_VISUAL_HIERARCHY=PASS viewport=1440x900 runtime_errors=0');
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve))}
