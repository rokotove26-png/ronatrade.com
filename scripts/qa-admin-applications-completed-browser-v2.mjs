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
const adminData={generatedAt:'2026-09-10T00:00:00.000Z',applications:[active,completed],clients:[],agents:[],prices:[],deals:[],dealDocuments:[],paymentPlan:[],paymentTotals:{received:0,planned:0},cash:[],rail:[],operationalConflicts:[],radio:[],analytics:[],news:[]};
const core={applications:[completed],client_intake:[],contracts:[],deals:[],clients:[]};

let shell=await readFile('portal-src/current/admin.html','utf8');
shell=shell.replace(/<script id="rona-[^>]+src="[^"]+"[^>]*><\/script>\s*/g,'');
shell=shell.replace('</body>',`<script>window.__RONA_ADMIN_LIVE_READY__=true;window.__RONA_ADMIN_LIVE_SNAPSHOT__={core:${JSON.stringify(core)}};</script><script src="/portal/main-ui"></script></body>`);
const mainResponse=await serveAdminMainUi({});
assert.equal(mainResponse.status,200,'main UI handler must materialize');
const mainScript=await mainResponse.text();

let completedBootstrapHits=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);
  const send=(status,type,body,headers={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)};
  if(url.pathname==='/portal/admin')return send(200,'text/html; charset=utf-8',shell);
  if(url.pathname==='/portal/main-ui')return send(200,'application/javascript; charset=utf-8',mainScript,{'x-rona-admin-completed-applications':'owner-r1-server-v2'});
  if(url.pathname==='/portal/admin-completed-bootstrap'){
    completedBootstrapHits++;
    if(!String(req.headers.cookie||'').includes('rona_portal_at=runtime-admin-token'))return send(401,'application/json',JSON.stringify({ok:false,code:'PORTAL_ACCESS_DENIED'}));
    return send(200,'application/json',JSON.stringify({ok:true,data:adminData}),{'x-rona-admin-completed-applications':'owner-r1-server-v2','x-rona-admin-completed-restored':'1'});
  }
  if(url.pathname==='/portal/api/v1/admin/bootstrap')return send(200,'application/json',JSON.stringify({ok:true,data:core}));
  if(url.pathname==='/portal/owner-api')return send(200,'application/json',JSON.stringify({ok:true,data:{generatedAt:'2026-09-10T00:00:00.000Z',financeFragment:null,homeCoordination:null,agentRewardsFragment:{rows:[]}}}));
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

async function proveCompletedUi(){
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:20000});
  await page.click('#nav button[data-page="applications"]');
  const completedFilter=page.locator('#page-applications .rona-app-filter button').filter({hasText:'Завершённые'});
  await completedFilter.waitFor({state:'visible',timeout:10000});
  assert.match(await completedFilter.textContent(),/Завершённые\s*·\s*1/,'completed bucket must contain restored row before user opens it');
  await completedFilter.click();
  const row=page.locator('#page-applications table tbody tr').filter({hasText:'TEST-IN-DONE'});
  await row.waitFor({state:'visible',timeout:10000});
  assert.equal(await row.count(),1,'completed application must render exactly once');
  assert.match(await row.textContent(),/TEST-DEAL-DONE/,'completed row must preserve registered Deal ID');
  const open=row.locator('button[data-rona-app-passport-open="TEST-IN-DONE"]');
  await open.waitFor({state:'visible',timeout:10000});
  assert.equal(await open.textContent(),'Открыть','existing passport action must remain bound');
  await open.click();
  const dialog=page.locator('.rona-app-passport-modal');
  await dialog.waitFor({state:'visible',timeout:10000});
  const text=await dialog.textContent();
  assert.match(text,/Паспорт заявки/);
  assert.match(text,/Завершённый товар/,'existing passport must open historical application conditions');
  assert.match(text,/725 USD/,'existing passport must preserve historical proposed price');
  await page.locator('.rona-app-passport-head button').click();
}

try{
  await proveCompletedUi();
  await page.reload({waitUntil:'domcontentloaded'});
  await proveCompletedUi();
  assert.ok(completedBootstrapHits>=2,'server-materialized bootstrap must be used again after reload');
  assert.deepEqual(errors,[],'browser runtime must not throw page errors');
  console.log(`ADMIN_APPLICATIONS_COMPLETED_BROWSER_V2=PASS authenticated_cookie=true completed=1 open=passport reload=true bootstrap_hits=${completedBootstrapHits}`);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
