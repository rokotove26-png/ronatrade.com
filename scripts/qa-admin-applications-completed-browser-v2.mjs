import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const completed={
  application_id:'TEST-IN-DONE',client_id:'TEST-C-DONE',legal_name:'Завершённый клиент',contract_id:'TEST-CTR-DONE',deal_id:'TEST-DEAL-DONE',deal_status:'EXECUTING',
  product:'Завершённый товар',quantity_tonnes:25,delivery_period_from:'2026-09-10',delivery_period_to:'2026-09-30',delivery_basis:'CPT',destination:'Тестовая станция',delivery_method:'RAIL',payment_terms:'100% предоплата',price_mode:'CLIENT_PRICE',proposed_price:725,proposed_currency:'USD',status:'DEAL_REGISTERED',owner_status:'DEAL',lifecycle_state:'ARCHIVED'
};
const active={application_id:'TEST-IN-ACTIVE',client_id:'TEST-C-ACTIVE',legal_name:'Активный клиент',contract_id:'TEST-CTR-ACTIVE',deal_id:null,product:'Активный товар',quantity_tonnes:10,status:'ACCEPTED_AWAITING_DEAL_REGISTRATION',owner_status:'SUPPLIER_APPROVED',lifecycle_state:'ACTIVE'};
const fresh={application_id:'TEST-IN-NEW',client_id:'TEST-C-NEW',legal_name:'Новый клиент',contract_id:'TEST-CTR-NEW',deal_id:null,product:'Новый товар',quantity_tonnes:5,status:'NEW',owner_status:'NEW',lifecycle_state:'ACTIVE'};
const decision={application_id:'TEST-IN-DECISION',client_id:'TEST-C-DECISION',legal_name:'Клиент на решении',contract_id:'TEST-CTR-DECISION',deal_id:'TEST-DEAL-PENDING',deal_status:'SUPPLIER_PENDING',product:'Товар на решении',quantity_tonnes:15,status:'DEAL_REGISTERED',owner_status:'SUPPLIER_PENDING',lifecycle_state:'ACTIVE'};
const adminData={generatedAt:'2026-09-12T00:00:00.000Z',applications:[fresh,active,decision,completed],clients:[],agents:[],prices:[],deals:[],dealDocuments:[],paymentPlan:[],paymentTotals:{received:0,planned:0},cash:[],rail:[],operationalConflicts:[],radio:[],analytics:[],news:[]};
const core={
  applications:[{...completed,current_external_contract_number:'HIST-CONTRACT-77'}],
  client_intake:[{authority_target_id:'TEST-IN-DONE',event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'APPLICATION',authority_target_type:'APPLICATION',payload:{message_type:'APPLICATION_DETAILS_V5',product:'Завершённый товар',quantity_tonnes:25,comment:'Исторический комментарий клиента',railway:{special_statements:'Исторические особые условия'}}}],
  contracts:[],deals:[],clients:[]
};

const BOOTSTRAP_DELAY_MS=700;
const SNAPSHOT_DELAY_MS=5000;
const CORE_DELAY_MS=900;
let shell=await readFile('portal-src/current/admin.html','utf8');
shell=shell.replace(/<script id="rona-[^>]+src="[^"]+"[^>]*><\/script>\s*/g,'');
shell=shell.replace('</body>','<script src="/portal/main-ui"></script></body>');
const mainResponse=await serveAdminMainUi({});
assert.equal(mainResponse.status,200,'main UI handler must materialize');
const mainScript=await mainResponse.text();

let completedBootstrapHits=0,coreHits=0,applicationPostHits=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);
  const send=(status,type,body,headers={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)};
  if(url.pathname==='/portal/admin')return send(200,'text/html; charset=utf-8',shell);
  if(url.pathname==='/portal/main-ui')return send(200,'application/javascript; charset=utf-8',mainScript,{'x-rona-admin-completed-applications':'owner-r1-server-v2'});
  if(url.pathname==='/portal/admin-completed-bootstrap'){
    completedBootstrapHits++;
    if(!String(req.headers.cookie||'').includes('rona_portal_at=runtime-admin-token'))return send(401,'application/json',JSON.stringify({ok:false,code:'PORTAL_ACCESS_DENIED'}));
    return setTimeout(()=>send(200,'application/json',JSON.stringify({ok:true,data:adminData}),{'x-rona-admin-completed-applications':'owner-r1-server-v2','x-rona-admin-completed-restored':'1'}),BOOTSTRAP_DELAY_MS);
  }
  if(url.pathname==='/portal/api/v1/admin/bootstrap'){
    coreHits++;
    return setTimeout(()=>send(200,'application/json',JSON.stringify({ok:true,data:core})),CORE_DELAY_MS);
  }
  if(url.pathname==='/portal/owner-api'){
    if(String(req.method||'GET').toUpperCase()==='POST'&&String(url.searchParams.get('path')||'').startsWith('/admin/applications/'))applicationPostHits++;
    return send(200,'application/json',JSON.stringify({ok:true,data:{generatedAt:'2026-09-12T00:00:00.000Z',financeFragment:null,homeCoordination:null,agentRewardsFragment:{rows:[]}}}));
  }
  return send(404,'text/plain','not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
await context.addCookies([{name:'rona_portal_at',value:'runtime-admin-token',url:origin,httpOnly:true,sameSite:'Lax'}]);
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.message||error)));
await page.addInitScript(delay=>{
  let pendingSnapshot;
  let timer=null;
  Object.defineProperty(window,'__RONA_OWNER_ADMIN_SNAPSHOT__',{
    configurable:true,
    get(){return undefined},
    set(value){
      pendingSnapshot=value;
      window.__RONA_TEST_OWNER_SNAPSHOT_PENDING__=true;
      if(timer)return;
      timer=setTimeout(()=>{
        Object.defineProperty(window,'__RONA_OWNER_ADMIN_SNAPSHOT__',{configurable:true,writable:true,value:pendingSnapshot});
        window.__RONA_TEST_OWNER_SNAPSHOT_PENDING__=false;
        window.__RONA_TEST_OWNER_SNAPSHOT_MATERIALIZED__=true;
      },delay);
    }
  });
},SNAPSHOT_DELAY_MS);

const filterByText=text=>page.locator('#page-applications .rona-app-filter button').filter({hasText:text});
const completedRow=()=>page.locator('#page-applications table tbody tr').filter({hasText:'TEST-IN-DONE'});
const completedOpen=()=>completedRow().locator('button[data-rona-app-passport-open="TEST-IN-DONE"]');

async function enterApplicationsImmediately(){
  await page.click('#nav button[data-page="applications"]');
  const completedFilter=filterByText('Завершённые');
  await completedFilter.waitFor({state:'visible',timeout:12000});
  assert.match(await completedFilter.textContent(),/Завершённые\s*·\s*1/,'completed bucket must contain the historical row');
  await filterByText('Новые').click();
  await page.locator('#page-applications table tbody tr').filter({hasText:'TEST-IN-NEW'}).waitFor({state:'visible',timeout:5000});
  await filterByText('В работе').click();
  await page.locator('#page-applications table tbody tr').filter({hasText:'TEST-IN-ACTIVE'}).waitFor({state:'visible',timeout:5000});
  await completedFilter.click();
  const row=completedRow();
  await row.waitFor({state:'visible',timeout:5000});
  const snapshotState=await page.evaluate(()=>({ready:window.__RONA_OWNER_ADMIN_READY__===true,snapshot:!!window.__RONA_OWNER_ADMIN_SNAPSHOT__,pending:window.__RONA_TEST_OWNER_SNAPSHOT_PENDING__===true}));
  assert.equal(snapshotState.snapshot,false,'race fixture must keep owner snapshot unavailable when completed row first becomes visible');
  assert.equal(snapshotState.pending,true,'race fixture must prove delayed owner snapshot');
  const open=completedOpen();
  assert.equal(await open.count(),1,'completed row must have exactly one passport action in its first visible render');
  assert.equal(await open.isVisible(),true,'passport action must be visible in the same lifecycle as the completed row');
  assert.equal(await open.textContent(),'Открыть','completed first render must never expose a dash in the action cell');
  assert.match(await row.textContent(),/TEST-DEAL-DONE/,'completed row must preserve registered Deal ID');
  return {row,open};
}

async function provePassportExactApplication(){
  const open=completedOpen();
  await open.click();
  assert.equal(await open.isVisible(),true,'button must remain present while authoritative passport sources resolve');
  const dialog=page.locator('.rona-app-passport-modal');
  await dialog.waitFor({state:'visible',timeout:12000});
  const text=await dialog.textContent();
  assert.match(text,/Паспорт заявки/);
  assert.match(text,/Завершённый товар/,'passport must resolve the exact completed application');
  assert.match(text,/725 USD/,'historical proposed price must be preserved');
  assert.match(text,/100% предоплата/,'historical payment terms must be preserved');
  assert.match(text,/HIST-CONTRACT-77/,'authoritative core application fields must be preserved');
  assert.match(text,/Исторический комментарий клиента/,'authoritative historical intake fields must be preserved');
  await page.locator('.rona-app-passport-head button').click();
}

async function proveOtherActionsAndRefresh(){
  await filterByText('В работе').click();
  const activeRow=page.locator('#page-applications table tbody tr').filter({hasText:'TEST-IN-ACTIVE'});
  await activeRow.waitFor({state:'visible',timeout:5000});
  const sendToDeals=activeRow.getByRole('button',{name:'Отправить в сделки'});
  assert.equal(await sendToDeals.count(),1,'supplier-approved application action must not regress');
  const beforeRefresh=completedBootstrapHits;
  const refreshResponse=page.waitForResponse(response=>response.url().includes('/portal/admin-completed-bootstrap')&&response.request().method()==='GET'&&response.ok(),{timeout:12000});
  await sendToDeals.click();
  await refreshResponse;
  assert.ok(completedBootstrapHits>beforeRefresh,'application action must execute canonical refreshAdmin bootstrap');
  assert.ok(applicationPostHits>=1,'existing application POST action must remain wired');

  const filters=page.locator('#page-applications .rona-app-filter button');
  let decisionFound=false;
  for(let i=0,n=await filters.count();i<n;i++){
    await filters.nth(i).click();
    const decisionRow=page.locator('#page-applications table tbody tr').filter({hasText:'TEST-IN-DECISION'});
    if(await decisionRow.count()&&await decisionRow.isVisible()){
      assert.equal(await decisionRow.getByRole('button',{name:'Ресурс одобрен'}).count(),1,'supplier approval action must remain available');
      assert.equal(await decisionRow.getByRole('button',{name:'В ресурсе отказано'}).count(),1,'supplier rejection action must remain available');
      decisionFound=true;
      break;
    }
  }
  assert.equal(decisionFound,true,'decision application must remain reachable through existing application filters');

  await filterByText('Завершённые').click();
  await completedRow().waitFor({state:'visible',timeout:5000});
  assert.equal(await completedOpen().count(),1,'refreshAdmin/re-render must not duplicate passport actions');
  assert.equal(await completedOpen().isVisible(),true,'passport action must survive refreshAdmin/re-render');
}

async function proveOtherAdminSections(){
  for(const id of ['home','prices','deals']){
    await page.click(`#nav button[data-page="${id}"]`);
    assert.equal(await page.locator(`#page-${id}`).evaluate(node=>node.classList.contains('active')),true,`Admin section ${id} must remain routable`);
  }
}

async function proveColdOrHardLoad(kind){
  if(kind==='cold')await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  else await page.reload({waitUntil:'domcontentloaded'});
  await enterApplicationsImmediately();
  await provePassportExactApplication();
  await proveOtherActionsAndRefresh();
  await proveOtherAdminSections();
  await page.click('#nav button[data-page="applications"]');
  await filterByText('Завершённые').click();
  await completedRow().waitFor({state:'visible',timeout:5000});
  assert.equal(await completedOpen().count(),1,`${kind} load repeated render must retain exactly one action`);
}

try{
  await proveColdOrHardLoad('cold');
  const hitsAfterCold={bootstrap:completedBootstrapHits,core:coreHits};
  assert.ok(hitsAfterCold.bootstrap>=3,'cold path must exercise delayed initial bootstrap, passport owner bootstrap and refreshAdmin');
  assert.ok(hitsAfterCold.core>=1,'cold path must exercise delayed authoritative passport/core source');
  await proveColdOrHardLoad('hard');
  assert.ok(completedBootstrapHits>hitsAfterCold.bootstrap,'hard reload must repeat canonical bootstrap path');
  assert.ok(coreHits>hitsAfterCold.core,'hard reload must repeat authoritative core path');
  assert.deepEqual(errors,[],'browser runtime must not throw page errors');
  console.log(`ADMIN_APPLICATIONS_COMPLETED_BROWSER_V3=PASS cold_load=true first_render_open=true delayed_bootstrap=${BOOTSTRAP_DELAY_MS} delayed_snapshot=${SNAPSHOT_DELAY_MS} delayed_core=${CORE_DELAY_MS} hard_reload=true filter_switch=true refresh_admin=true repeated_render=true no_duplicates=true exact_application=true other_actions=true other_admin_sections=true bootstrap_hits=${completedBootstrapHits} core_hits=${coreHits}`);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
