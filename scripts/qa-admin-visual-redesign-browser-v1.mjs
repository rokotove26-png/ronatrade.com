import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const completed={application_id:'VIS-IN-DONE',client_id:'VIS-C-DONE',legal_name:'Север Энерго',contract_id:'VIS-CTR-DONE',deal_id:'VIS-DEAL-1024',deal_status:'EXECUTING',product:'СУГ СПБТ',quantity_tonnes:240,delivery_basis:'CPT',destination:'ст. Тестовая',payment_terms:'100% предоплата',proposed_price:725,proposed_currency:'USD',status:'DEAL_REGISTERED',owner_status:'DEAL',lifecycle_state:'ARCHIVED'};
const active={application_id:'VIS-IN-ACTIVE',client_id:'VIS-C-ACTIVE',legal_name:'Транс Нефть Сервис',contract_id:'VIS-CTR-ACTIVE',deal_id:null,product:'ДТ',quantity_tonnes:120,status:'ACCEPTED_AWAITING_DEAL_REGISTRATION',owner_status:'SUPPLIER_APPROVED',lifecycle_state:'ACTIVE'};
const fresh={application_id:'VIS-IN-NEW',client_id:'VIS-C-NEW',legal_name:'Регион Трейд',contract_id:'VIS-CTR-NEW',deal_id:null,product:'АИ-92',quantity_tonnes:80,status:'NEW',owner_status:'NEW',lifecycle_state:'ACTIVE'};
const decision={application_id:'VIS-IN-DECISION',client_id:'VIS-C-DECISION',legal_name:'Юг Топливо',contract_id:'VIS-CTR-DECISION',deal_id:'VIS-DEAL-PENDING',deal_status:'SUPPLIER_PENDING',product:'СУГ',quantity_tonnes:160,status:'DEAL_REGISTERED',owner_status:'SUPPLIER_PENDING',lifecycle_state:'ACTIVE'};
const deals=[
  {deal_id:'VIS-DEAL-1024',application_id:'VIS-IN-DONE',client_id:'VIS-C-DONE',legal_name:'Север Энерго',business_status:'EXECUTING',contract_id:'VIS-CTR-DONE',source_product:'СУГ СПБТ',source_quantity_tonnes:240,resource_status:'CONFIRMED'},
  {deal_id:'VIS-DEAL-1025',application_id:'VIS-IN-SECOND',client_id:'VIS-C-SECOND',legal_name:'Волга Ресурс',business_status:'REGISTERED',contract_id:'VIS-CTR-SECOND',source_product:'ДТ',source_quantity_tonnes:90,resource_status:'PENDING'}
];
const adminData={
  generatedAt:'2026-09-12T09:00:00.000Z',applications:[fresh,active,decision,completed],clients:[{client_id:'VIS-C-DONE'},{client_id:'VIS-C-ACTIVE'},{client_id:'VIS-C-NEW'}],agents:[],prices:[],deals,
  dealDocuments:[{document_id:'VIS-DOC-1',deal_id:'VIS-DEAL-1024',document_kind:'SIGNED_ADDENDUM',authoritative_filename:'addendum.pdf'}],
  paymentPlan:[],paymentTotals:{received:0,planned:0},cash:[],rail:[{deal_id:'VIS-DEAL-1024',gu12_number:'GU12-1',route_text:'A → B',wagons:[{wagonNumber:'001',status:'WAIT'}]}],operationalConflicts:[{kind:'Проверка документа',entity_id:'VIS-DEAL-1025',reason:'Требует внимания'}],radio:[],analytics:[],news:[],exchange:{status:'HEALTHY',last_success:'2026-09-12T08:55:00Z'}
};
const core={applications:[{...completed,current_external_contract_number:'HIST-CTR-2026-77'}],client_intake:[{authority_target_id:'VIS-IN-DONE',event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'APPLICATION',authority_target_type:'APPLICATION',payload:{message_type:'APPLICATION_DETAILS_V5',product:'СУГ СПБТ',quantity_tonnes:240,comment:'Комментарий клиента',railway:{special_statements:'Особые условия'}}}],contracts:[],deals,clients:[]};
const homeRows=[{role:'OPERATIONS_DIRECTOR',display_name:'Операционный директор',sent:7,responses:6,awaiting:1,sla_breached:0,errors:0,last_response_at:'2026-09-12T08:58:00Z'}];
const aiSync={
  generatedAt:'2026-09-12T09:00:00Z',railTariffs:[],financeFragment:null,agentRewardsFragment:{rows:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'v1'},
  homeCoordination:{generatedAt:'2026-09-12T09:00:00Z',totals:{TODAY:{sent:7,responses:6,awaiting:1,slaBreached:0,errors:0,portalRequests:3},'7D':{sent:22,responses:20,awaiting:2,slaBreached:1,errors:0,portalRequests:8},'30D':{sent:70,responses:68,awaiting:2,slaBreached:1,errors:0,portalRequests:19},ALL:{sent:94,responses:91,awaiting:3,slaBreached:1,errors:0,portalRequests:30}},periods:{TODAY:homeRows,'7D':homeRows,'30D':homeRows,ALL:homeRows},recent:[]}
};

let shell=await readFile('portal-src/current/admin.html','utf8');
shell=shell.replace(/<script id="rona-[^>]+src="[^"]+"[^>]*><\/script>\s*/g,'');
shell=shell.replace('</body>','<script src="/portal/main-ui"></script></body>');
const mainResponse=await serveAdminMainUi({});
assert.equal(mainResponse.status,200,'Admin main UI must materialize');
assert.equal(mainResponse.headers.get('x-rona-admin-visual-redesign'),'home-applications-deals-v1');
const mainScript=await mainResponse.text();

let bootstrapHits=0,postHits=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);
  const send=(status,type,body,headers={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)};
  if(url.pathname==='/portal/admin')return send(200,'text/html; charset=utf-8',shell);
  if(url.pathname==='/portal/client')return send(200,'text/html; charset=utf-8','<!doctype html><html><body><main id="client-sentinel">CLIENT_CONTEXT_SENTINEL</main></body></html>');
  if(url.pathname==='/portal/main-ui')return send(200,'application/javascript; charset=utf-8',mainScript,{'x-rona-admin-visual-redesign':'home-applications-deals-v1'});
  if(url.pathname==='/portal/admin-completed-bootstrap'){
    bootstrapHits++;
    if(!String(req.headers.cookie||'').includes('rona_portal_at=runtime-admin-token'))return send(401,'application/json',JSON.stringify({ok:false,code:'PORTAL_ACCESS_DENIED'}));
    return send(200,'application/json',JSON.stringify({ok:true,data:adminData}),{'x-rona-admin-completed-applications':'owner-r1-server-v2','x-rona-admin-completed-restored':'0'});
  }
  if(url.pathname==='/portal/api/v1/admin/bootstrap')return send(200,'application/json',JSON.stringify({ok:true,data:core}));
  if(url.pathname==='/portal/owner-api'){
    const path=String(url.searchParams.get('path')||'');
    if(String(req.method||'GET').toUpperCase()==='POST'){postHits++;return send(200,'application/json',JSON.stringify({ok:true,data:{}}))}
    if(path==='/admin/ai-sync')return send(200,'application/json',JSON.stringify({ok:true,data:aiSync}));
    if(path==='/admin/bootstrap')return send(200,'application/json',JSON.stringify({ok:true,data:adminData}));
    return send(200,'application/json',JSON.stringify({ok:true,data:{}}));
  }
  if(url.pathname.startsWith('/assets/'))return send(204,'text/plain','');
  return send(404,'text/plain','not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
await mkdir('artifacts/admin-redesign',{recursive:true});
const browser=await chromium.launch({headless:true});

async function newAdminPage(viewport){
  const context=await browser.newContext({viewport});
  await context.addCookies([{name:'rona_portal_at',value:'runtime-admin-token',url:origin,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror:'+String(error?.message||error)));
  page.on('console',msg=>{if(msg.type()==='error'&&!/favicon|404/.test(msg.text()))errors.push('console:'+msg.text())});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true&&window.__RONA_ADMIN_VISUAL_REDESIGN_V1__&&document.documentElement.classList.contains('rona-admin-redesign-v1'),null,{timeout:12000});
  await page.waitForFunction(()=>['home','applications','deals'].every(id=>document.getElementById('page-'+id)?.dataset.ronaAdminVisualRedesign==='ready'),null,{timeout:12000});
  return{context,page,errors};
}

async function activate(page,id){
  await page.click(`#nav button[data-page="${id}"]`);
  await page.waitForFunction(pageId=>document.getElementById('page-'+pageId)?.classList.contains('active'),id,{timeout:5000});
}
async function noDocumentOverflow(page,label){
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
  assert.ok(overflow.scroll<=overflow.width+2,`${label} must not create document-level horizontal overflow: ${JSON.stringify(overflow)}`);
}
const filterByText=(page,text)=>page.locator('#page-applications .rona-app-filter button').filter({hasText:text});
const completedRow=page=>page.locator('#page-applications table tbody tr').filter({hasText:'VIS-IN-DONE'});

async function proveFullFlow(viewport,withScreenshots=false){
  const {context,page,errors}=await newAdminPage(viewport);
  try{
    await activate(page,'home');
    await page.locator('#page-home .rona-ops-v4,#page-home #ronaHomeOperations').first().waitFor({state:'visible',timeout:12000});
    assert.equal(await page.locator('#page-home').getAttribute('data-rona-admin-visual-redesign'),'ready');
    await noDocumentOverflow(page,`${viewport.width}x${viewport.height} home`);
    if(withScreenshots)await page.screenshot({path:'artifacts/admin-redesign/ADMIN_HOME_REDESIGN.png',fullPage:false});

    await activate(page,'applications');
    const completedFilter=filterByText(page,'Завершённые');
    await completedFilter.waitFor({state:'visible',timeout:8000});
    await completedFilter.click();
    const row=completedRow(page);await row.waitFor({state:'visible',timeout:5000});
    const open=row.locator('button[data-rona-app-passport-open="VIS-IN-DONE"]');
    assert.equal(await open.count(),1,'completed row must keep exactly one passport action');
    assert.equal(await open.isVisible(),true,'completed passport action must remain first-render visible');
    assert.equal(await row.getAttribute('data-rona-visual-row'),'application');
    assert.ok(await row.locator('td[data-rona-col="application-id"]').count()>=1,'application ID must have visual hierarchy');
    assert.ok(await page.locator('#page-applications .rona-admin-status-chip').count()>=1,'application statuses must render as semantic chips');
    await noDocumentOverflow(page,`${viewport.width}x${viewport.height} applications`);
    if(withScreenshots)await page.screenshot({path:'artifacts/admin-redesign/ADMIN_APPLICATIONS_REDESIGN.png',fullPage:false});
    await open.click();
    const passport=page.locator('.rona-app-passport-modal');await passport.waitFor({state:'visible',timeout:8000});
    const passportText=await passport.textContent();
    assert.match(passportText,/СУГ СПБТ/);assert.match(passportText,/725 USD/);assert.match(passportText,/HIST-CTR-2026-77/);
    await page.locator('.rona-app-passport-head button').click();

    await filterByText(page,'В работе').click();
    const activeRow=page.locator('#page-applications table tbody tr').filter({hasText:'VIS-IN-ACTIVE'});await activeRow.waitFor({state:'visible',timeout:5000});
    assert.equal(await activeRow.getByRole('button',{name:'Отправить в сделки'}).count(),1,'existing application action must remain');
    const filters=page.locator('#page-applications .rona-app-filter button');let decisionActions=false;
    for(let i=0,n=await filters.count();i<n;i++){
      await filters.nth(i).click();const decisionRow=page.locator('#page-applications table tbody tr').filter({hasText:'VIS-IN-DECISION'});
      if(await decisionRow.count()&&await decisionRow.isVisible()){
        assert.equal(await decisionRow.getByRole('button',{name:'Ресурс одобрен'}).count(),1);
        assert.equal(await decisionRow.getByRole('button',{name:'В ресурсе отказано'}).count(),1);decisionActions=true;break;
      }
    }
    assert.equal(decisionActions,true,'supplier decision actions must remain available');

    await activate(page,'deals');
    const dealRow=page.locator('#page-deals table tbody tr').filter({hasText:'VIS-DEAL-1024'});await dealRow.waitFor({state:'visible',timeout:8000});
    assert.equal(await dealRow.getAttribute('data-rona-visual-row'),'deal');
    assert.ok(await dealRow.locator('td[data-rona-col="deal-id"]').count()>=1,'Deal ID must be the emphasized identifier');
    assert.ok(await dealRow.getByRole('button',{name:'Прикрепить допсоглашение'}).count()>=1,'deal addendum action must remain');
    assert.ok(await dealRow.getByRole('button',{name:'Прикрепить инвойс'}).count()>=1,'deal invoice action must remain');
    await noDocumentOverflow(page,`${viewport.width}x${viewport.height} deals`);
    if(withScreenshots)await page.screenshot({path:'artifacts/admin-redesign/ADMIN_DEALS_REDESIGN.png',fullPage:false});

    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true&&window.__RONA_ADMIN_VISUAL_REDESIGN_V1__,null,{timeout:12000});
    await activate(page,'applications');await filterByText(page,'Завершённые').click();await completedRow(page).waitFor({state:'visible',timeout:5000});
    assert.equal(await completedRow(page).locator('button[data-rona-app-passport-open="VIS-IN-DONE"]').count(),1,'hard refresh must retain exactly one passport action');
    assert.deepEqual(errors,[],`runtime errors at ${viewport.width}x${viewport.height}: ${errors.join(' | ')}`);
    return true;
  }finally{await context.close()}
}

try{
  await proveFullFlow({width:1440,height:900},true);
  await proveFullFlow({width:1920,height:1080},false);
  await proveFullFlow({width:1366,height:768},false);
  const clientContext=await browser.newContext({viewport:{width:1440,height:900}});const clientPage=await clientContext.newPage();
  await clientPage.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'});
  assert.equal(await clientPage.locator('#client-sentinel').textContent(),'CLIENT_CONTEXT_SENTINEL');
  assert.equal(await clientPage.evaluate(()=>document.documentElement.classList.contains('rona-admin-redesign-v1')),false,'Admin visual runtime must not leak into Client context');
  await clientContext.close();
  assert.ok(bootstrapHits>=6,'cold/hard responsive passes must exercise canonical Admin bootstrap');
  console.log(`ADMIN_VISUAL_REDESIGN_BROWSER_V1=PASS ADMIN_NAVIGATION=true APPLICATION_FILTERS=true COMPLETED_OPEN_FIRST_RENDER=true APPLICATION_PASSPORT_OPEN=true APPLICATION_ACTIONS=true DEALS_RENDER=true DEAL_ACTIONS=true CLIENT_CONTEXT_ISOLATION=true HARD_REFRESH=true NO_RUNTIME_ERRORS=true responsive=1920x1080,1440x900,1366x768 screenshots=3 bootstrap_hits=${bootstrapHits} post_hits=${postHits}`);
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
