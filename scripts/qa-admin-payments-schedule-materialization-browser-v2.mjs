import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { onRequest as mainUiRequest } from '../functions/portal/main-ui/index.js';
import { onRequest as paymentScheduleRequest } from '../functions/portal/payment-schedule-current.js';

const DIST=join(process.cwd(),'dist');
let revision=1,syncCalls=0,scheduleCalls=0,browser;
const errors=[];
const now=()=>new Date().toISOString();
const z={sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0};
const payment=(id,currency,amount)=>({payment_id:id,payment_at:now(),amount,currency,payer_name:'QA payer',bank_transaction_reference:'QA-'+id,bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'});
const allocation=(id,deal,currency,amount)=>({payment_id:id,currency,client_id:'QA-CLIENT',legal_name:'QA Client',deal_id:deal,allocated_amount:amount,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'});
const sched=(dealId,currency,obligation,received,remaining,currentDue,deferred,state,trigger,financeStatus='NOT_DUE')=>({dealId,currency,obligationAmount:obligation,verifiedReceivedAmount:received,remainingAmount:remaining,currentDueAmount:currentDue,deferredNotDueAmount:deferred,scheduleState:state,triggerState:trigger,nextTrancheCondition:state==='PAID'?'NO_FURTHER_TRANCHE':'AFTER_AUTHORITATIVE_GU_CONFIRMATION_BEFORE_SHIPMENT',financeStatus,accountingClosureStatus:'OPEN',outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',sourceKind:'QA_FINANCE_CURRENT_STATE',sourceRecordId:'QA-'+dealId,authorityState:'FINANCE_CURRENT_STATE'});

function bootstrap(){return{clients:[{client_id:'RONA-C002',legal_name:'FARGONA'},{client_id:'RONA-C003',legal_name:'SOLARIS'},{client_id:'RONA-C005',legal_name:'GazOne'}],companies:[],agents:[],applications:[],documents:[],payments:[],cash:[],rail:[],publications:[],operationalConflicts:[],claims:[],deals:[
  {deal_id:'DEAL-2026-004',client_id:'RONA-C002',client_name:'FARGONA',business_status:'EXECUTING',finance_status:'PAID',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'},
  {deal_id:'DEAL-2026-005',client_id:'RONA-C003',client_name:'SOLARIS — URTAUL',business_status:'EXECUTING',finance_status:revision>=3?'DUE':'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'},
  {deal_id:'DEAL-2026-006',client_id:'RONA-C003',client_name:'SOLARIS — MARGILAN',business_status:'EXECUTING',finance_status:revision>=3?'DUE':'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'},
  {deal_id:'DEAL-2026-009',client_id:'RONA-C005',client_name:'GazOne',business_status:'EXECUTING',finance_status:'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'}]}}

function finance(){
  const extra=revision>=2,triggered=revision>=3,reconciled=revision>=4,received005=201750+(extra?50000:0),remaining005=672500-received005;
  const incomingPayments=[payment('PAY-QA-004','USD',236250),payment('PAY-QA-005','USD',201750),payment('PAY-QA-006','USD',49320),payment('PAY-QA-UNALLOCATED','USD',11800)];
  const incomingPaymentAllocations=[allocation('PAY-QA-004','DEAL-2026-004','USD',236250),allocation('PAY-QA-005','DEAL-2026-005','USD',201750),allocation('PAY-QA-006','DEAL-2026-006','USD',49320)];
  if(extra){incomingPayments.push(payment('PAY-QA-005-EXTRA','USD',50000));incomingPaymentAllocations.push(allocation('PAY-QA-005-EXTRA','DEAL-2026-005','USD',50000))}
  const dealAllocationTotals=[{deal_id:'DEAL-2026-004',currency:'USD',allocated_amount:236250},{deal_id:'DEAL-2026-005',currency:'USD',allocated_amount:received005},{deal_id:'DEAL-2026-006',currency:'USD',allocated_amount:49320}];
  const paymentSchedules=[
    sched('DEAL-2026-004','USD',236250,236250,0,0,0,'PAID','NOT_APPLICABLE','PAID'),
    sched('DEAL-2026-005','USD',672500,received005,remaining005,triggered?remaining005:0,triggered?0:remaining005,triggered?'DUE':'DEFERRED_NOT_DUE',triggered?'CONFIRMED':'NOT_CONFIRMED',triggered?'DUE':'NOT_DUE'),
    sched('DEAL-2026-006','USD',164400,49320,115080,triggered?115080:0,triggered?0:115080,triggered?'DUE':'DEFERRED_NOT_DUE',triggered?'CONFIRMED':'NOT_CONFIRMED',triggered?'DUE':'NOT_DUE')
  ];
  const paymentScheduleHolds=[];
  if(reconciled)paymentSchedules.push(sched('DEAL-2026-009','RUB',31002300,0,31002300,0,31002300,'DEFERRED_NOT_DUE','NOT_APPLICABLE','NOT_DUE'));
  else paymentScheduleHolds.push({dealId:'DEAL-2026-009',currency:'RUB',financeStatus:'NOT_DUE',accountingClosureStatus:'OPEN',reason:'QA_FINANCE_RECONCILIATION_PENDING'});
  return{authoritativeSource:'ACCOUNTING_FINANCE_CANONICAL_V011',paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',paymentScheduleContract:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1',sourceAsOf:now(),payments:incomingPayments,incomingPayments,paymentAllocations:incomingPaymentAllocations,incomingPaymentAllocations,dealAllocationTotals,paymentAllocationSummaries:[],outgoingPayments:[
    {fact_id:'OUT-QA-KUZMASH',amount:16536960,currency:'RUB',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY',bank_fact_status:'BANK_CONFIRMED'},
    {fact_id:'OUT-QA-KUZMASH-FEE',amount:3000,currency:'RUB',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY',bank_fact_status:'BANK_CONFIRMED'}],dealFinanceSummaries:[
      {deal_id:'DEAL-2026-004',obligation_amount:236250,received_amount:236250,client_remaining_amount:0,currency:'USD',finance_status:'PAID',accounting_status:'OPEN'},
      {deal_id:'DEAL-2026-005',obligation_amount:672500,received_amount:received005,client_remaining_amount:remaining005,currency:'USD',finance_status:triggered?'DUE':'NOT_DUE',accounting_status:'OPEN'},
      {deal_id:'DEAL-2026-006',obligation_amount:164400,received_amount:49320,client_remaining_amount:115080,currency:'USD',finance_status:triggered?'DUE':'NOT_DUE',accounting_status:'OPEN'},
      {deal_id:'DEAL-2026-009',obligation_amount:31002300,received_amount:0,client_remaining_amount:31002300,currency:'RUB',finance_status:'NOT_DUE',accounting_status:'OPEN'}],paymentSchedules,paymentScheduleHolds,paymentTotalsByCurrency:[],obligationPlanAvailable:true,cash:[]};
}
function aiSync(){syncCalls++;return{generatedAt:`2026-09-12T17:0${revision}:00.000Z`,marketAnalystFragment:{generatedAt:now(),analytics:[],news:[],currentPublications:[]},homeCoordination:{generatedAt:now(),totals:{TODAY:z,'7D':z,'30D':z,ALL:z},periods:{TODAY:[],'7D':[],'30D':[],ALL:[]},recent:[]},agentRewardsFragment:{generatedAt:now(),rows:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'dynamic-schedule-qa'},financeFragment:finance()}}

const mainUiResponse=await mainUiRequest();
if(!mainUiResponse.ok)throw new Error('MAIN_UI_BUILD_FAILED_'+mainUiResponse.status+':'+await mainUiResponse.text());
const mainUi=await mainUiResponse.text();
if(!mainUi.includes('20260912-payment-schedule-v2'))throw new Error('MATERIALIZED_MAIN_UI_MISSING_DYNAMIC_SCHEDULE_RUNTIME');
const authority={accessUsers:[],contracts:[]};
const send=(res,status,body,type='text/plain; charset=utf-8',headers={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)};
const json=(res,data,status=200,headers={})=>send(res,status,JSON.stringify(data),'application/json; charset=utf-8',headers);
function safePath(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':'application/octet-stream'}
async function serveFile(res,path,type){try{const b=await readFile(path);send(res,200,b,type||mime(path));return true}catch{return false}}
async function bridge(response,res){const body=Buffer.from(await response.arrayBuffer()),headers={};for(const[k,v]of response.headers.entries())headers[k]=v;res.writeHead(response.status,headers);res.end(body)}
const optional=new Set(['/portal/deals-current-state-ui','/portal/deals-r1-r11-ui','/portal/cash-r2-ui','/portal/rail-current-v81-maplibre-ui','/portal/applications-total-kpi-ui','/portal/prices-current-ui']);
let server;
server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1'),p=u.pathname;
  if(p==='/favicon.ico'||p.startsWith('/assets/'))return send(res,204,'');
  if(p==='/portal/admin')return void await serveFile(res,join(DIST,'portal','admin.html'),'text/html; charset=utf-8');
  if(p==='/portal/main-ui')return send(res,200,mainUi,'application/javascript; charset=utf-8');
  if(p==='/portal/payment-schedule-current'){scheduleCalls++;const port=server.address().port,headers=new Headers();for(const[k,v]of Object.entries(req.headers)){if(Array.isArray(v))headers.set(k,v.join(', '));else if(v!==undefined)headers.set(k,String(v))}return void await bridge(await paymentScheduleRequest({request:new Request(`http://127.0.0.1:${port}${req.url}`,{method:'GET',headers})}),res)}
  if(p==='/portal/clients-agents-current-ui'||p==='/portal/claims-r2-ui'||p==='/portal/remaining-sections-ui')return void await serveFile(res,join(DIST,p),'application/javascript; charset=utf-8');
  if(optional.has(p))return send(res,200,'/* QA optional current module */','application/javascript; charset=utf-8');
  if(p==='/portal/api/session/me')return json(res,{ok:true,user:{roles:['ADMIN'],display_name:'QA Admin'}});
  if(p==='/portal/api/v1/admin/bootstrap'||p==='/portal/admin-completed-bootstrap')return json(res,{ok:true,data:bootstrap()},200,p.endsWith('completed-bootstrap')?{'x-rona-admin-completed-applications':'QA'}:{});
  if(p==='/portal/logout')return json(res,{ok:true});
  if(p==='/portal/admin-authority/bootstrap')return json(res,{ok:true,data:authority});
  if(p==='/portal/admin-authority/agent-readiness')return json(res,{ok:true,data:{matrixReady:true}});
  if(p.startsWith('/portal/admin-authority/'))return json(res,{ok:true,data:{}});
  if(p==='/portal/owner-api'){const op=u.searchParams.get('path')||'';if(op==='/admin/bootstrap')return json(res,{ok:true,data:bootstrap()});if(op==='/admin/ai-sync')return json(res,{ok:true,data:aiSync()});if(op==='/admin/claims')return json(res,{ok:true,data:{claims:[]}});if(op==='/admin/analytics-bootstrap')return json(res,{ok:true,data:{generatedAt:now(),marketNewsFeed:[]}});return json(res,{ok:true,data:{}})}
  const file=safePath(p);if(file&&await serveFile(res,file))return;send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;
const assert=(v,m)=>{if(!v)throw new Error(m)};
const compact=v=>String(v||'').replace(/[\s\u00a0\u202f]/g,'').replace(/,/g,'.');
async function row(page,id){const r=page.locator(`#rona-payment-schedule-v1 tbody tr[data-schedule-deal="${id}"]`);assert(await r.count()===1,`${id} schedule duplicate/missing`);return r}
async function refresh(page){await page.evaluate(()=>window.__RONA_PAYMENT_SCHEDULE_REFRESH__());await page.waitForTimeout(150)}
async function waitRev(page,r){await page.waitForFunction(x=>window.__RONA_PAYMENT_SCHEDULE_CURRENT_STATE__?.generatedAt===`2026-09-12T17:0${x}:00.000Z`,r,{timeout:10000});await page.waitForTimeout(80)}
async function openPayments(page){
  const b=page.locator('#nav button[data-page="payments"]');await b.waitFor({state:'visible',timeout:20000});await b.click();await page.locator('#page-payments.active').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>window.__RONA_ADMIN_PAYMENT_SCHEDULE_RUNTIME_V2__==='20260912-payment-schedule-v2',null,{timeout:10000});
  await page.evaluate(()=>window.__RONA_PAYMENT_SCHEDULE_REFRESH__());
  await page.waitForFunction(()=>window.__RONA_PAYMENT_SCHEDULE_CURRENT_STATE__?.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2',null,{timeout:10000});
  await page.locator('#rona-payment-schedule-v1').waitFor({state:'visible',timeout:10000});
}

try{
  const direct=await fetch(origin+'/portal/payment-schedule-current',{headers:{accept:'application/json'}}),directPayload=await direct.json();
  assert(direct.ok&&directPayload?.data?.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2','DIRECT_TRUSTED_PROJECTION_FAILED:'+JSON.stringify(directPayload));
  console.log('DIRECT_TRUSTED_PROJECTION=PASS');
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1600,height:1000}});const page=await context.newPage();
  page.on('pageerror',e=>errors.push('pageerror:'+String(e.message||e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))errors.push('console:'+m.text())});page.on('response',r=>{if(r.status()>=500)errors.push(`http:${r.status()}:${r.url()}`)});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded',timeout:30000});await openPayments(page);await waitRev(page,1);
  let r=await row(page,'DEAL-2026-005'),c=r.locator('td');assert(await r.getAttribute('data-schedule-state')==='DEFERRED_NOT_DUE','baseline 005 not deferred');assert(compact(await c.nth(2).innerText()).includes('201750USD')&&compact(await c.nth(3).innerText()).includes('470750USD'),'baseline 005 amounts');let r9=await row(page,'DEAL-2026-009');assert(await r9.getAttribute('data-projection-status')==='TO_VERIFY','009 baseline not TO_VERIFY');

  revision=2;await refresh(page);await waitRev(page,2);r=await row(page,'DEAL-2026-005');c=r.locator('td');assert(compact(await c.nth(2).innerText()).includes('251750USD')&&compact(await c.nth(3).innerText()).includes('420750USD')&&compact(await c.nth(5).innerText()).includes('420750USD'),'new verified receipt not propagated');console.log('NEW_VERIFIED_RECEIPT_RUNTIME=PASS');

  revision=3;await refresh(page);await waitRev(page,3);for(const id of['DEAL-2026-005','DEAL-2026-006']){const x=await row(page,id),cells=x.locator('td');assert(await x.getAttribute('data-schedule-state')==='DUE',id+' not DUE');assert((await cells.nth(7).innerText()).includes('CONFIRMED'),id+' trigger not confirmed');assert(compact(await cells.nth(5).innerText()).includes('0USD'),id+' deferred not cleared')}r=await row(page,'DEAL-2026-005');assert(compact(await r.locator('td').nth(4).innerText()).includes('420750USD'),'005 current due not updated');console.log('GU_TRIGGER_DEFERRED_TO_DUE=PASS');

  revision=4;await refresh(page);await waitRev(page,4);r9=await row(page,'DEAL-2026-009');assert(await r9.getAttribute('data-projection-status')==='AUTHORITATIVE'&&await r9.getAttribute('data-schedule-state')==='DEFERRED_NOT_DUE','009 did not become authoritative');console.log('DEAL009_TO_VERIFY_TO_AUTHORITATIVE=PASS');

  for(let i=0;i<3;i++)await refresh(page);for(const id of['DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','DEAL-2026-009'])assert(await page.locator(`#rona-payment-schedule-v1 tbody tr[data-schedule-deal="${id}"]`).count()===1,id+' duplicate');console.log('NO_DUPLICATES=PASS');
  r=await row(page,'DEAL-2026-005');c=r.locator('td');assert(!(await c.nth(2).innerText()).includes('16536960'),'KUZMASH leaked into incoming');assert((await c.nth(12).innerText()).includes('TO_VERIFY'),'FX synthesized');console.log('KUZMASH_NO_INFERRED_SPLIT=PASS');console.log('FX_NO_SYNTHESIS=PASS');

  const before=scheduleCalls;await page.reload({waitUntil:'domcontentloaded'});await openPayments(page);await waitRev(page,4);assert(scheduleCalls>before,'hard refresh did not refetch');r=await row(page,'DEAL-2026-005');r9=await row(page,'DEAL-2026-009');assert(await r.getAttribute('data-schedule-state')==='DUE'&&await r9.getAttribute('data-projection-status')==='AUTHORITATIVE','hard refresh lost state');console.log('HARD_REFRESH=PASS');
  assert(syncCalls>=4&&scheduleCalls>=4,'Finance refresh did not propagate');console.log('FINANCE_REFRESH_PROPAGATION=PASS');
  await mkdir('artifacts/admin-payments',{recursive:true});await page.screenshot({path:'artifacts/admin-payments/ADMIN_PAYMENTS_DYNAMIC_FINANCE_SCHEDULE_AUTHORITY.png',fullPage:true});
  assert(errors.length===0,'browser runtime errors:'+errors.join(' | '));console.log('NO_RUNTIME_ERRORS=PASS');console.log('ADMIN_PAYMENTS_DYNAMIC_SCHEDULE_BROWSER_QA=PASS');console.log(JSON.stringify({origin,revision,syncCalls,scheduleCalls,errors}));await context.close();
}catch(e){console.error('ADMIN_PAYMENTS_DYNAMIC_SCHEDULE_BROWSER_QA=FAIL',e?.stack||e);console.error(JSON.stringify({revision,syncCalls,scheduleCalls,errors}));process.exitCode=1}finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}
