import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { onRequest as mainUiRequest } from '../functions/portal/main-ui/index.js';
import { onRequest as paymentScheduleRequest } from '../functions/portal/payment-schedule-current.js';

const ROOT=process.cwd(),DIST=join(ROOT,'dist');
let financeRevision=1,syncCalls=0,scheduleEndpointCalls=0;
const zero={sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0};
const now=()=>new Date().toISOString();

function adminBootstrap(){return{
  clients:[{client_id:'RONA-C002',legal_name:'FARGONA'},{client_id:'RONA-C003',legal_name:'UNVERSAL SOLYARIS GRAND'},{client_id:'RONA-C005',legal_name:'GazOne'}],
  companies:[],agents:[],applications:[],documents:[],payments:[],cash:[],rail:[],publications:[],operationalConflicts:[],claims:[],
  deals:[
    {deal_id:'DEAL-2026-004',client_id:'RONA-C002',client_name:'FARGONA',business_status:'EXECUTING',finance_status:'PAID',accounting_closure_status:financeRevision===2?'PENDING_RECONCILIATION':'OPEN',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-2026-005',client_id:'RONA-C003',client_name:'SOLYARIS — URTAUL',business_status:'EXECUTING',finance_status:'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-2026-006',client_id:'RONA-C003',client_name:'SOLYARIS — MARGILAN',business_status:'EXECUTING',finance_status:'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-2026-009',client_id:'RONA-C005',client_name:'GazOne',business_status:'EXECUTING',finance_status:'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'}
  ]
}}

function financeFragment(){
  const incomingPayments=[
    {payment_id:'PAYEV-2026-000001',payment_at:now(),amount:236250,currency:'USD',payer_name:'FARGONA',original_payment_purpose:'Deal 004',bank_transaction_reference:'BANK-004',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000002',payment_at:now(),amount:201750,currency:'USD',payer_name:'SOLYARIS',original_payment_purpose:'Deal 005 30%',bank_transaction_reference:'BANK-005',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000003',payment_at:now(),amount:49320,currency:'USD',payer_name:'SOLYARIS',original_payment_purpose:'Deal 006 30%',bank_transaction_reference:'BANK-006',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000004',payment_at:now(),amount:11800,currency:'USD',payer_name:'UNALLOCATED USD',original_payment_purpose:'Unallocated control',bank_transaction_reference:'BANK-U1',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000005',payment_at:now(),amount:1003000,currency:'RUB',payer_name:'UNALLOCATED RUB',original_payment_purpose:'Unallocated control',bank_transaction_reference:'BANK-U2',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'}
  ];
  const incomingPaymentAllocations=[
    {payment_id:'PAYEV-2026-000001',currency:'USD',client_id:'RONA-C002',legal_name:'FARGONA',deal_id:'DEAL-2026-004',allocated_amount:236250,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'},
    {payment_id:'PAYEV-2026-000002',currency:'USD',client_id:'RONA-C003',legal_name:'SOLYARIS',deal_id:'DEAL-2026-005',allocated_amount:201750,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'},
    {payment_id:'PAYEV-2026-000003',currency:'USD',client_id:'RONA-C003',legal_name:'SOLYARIS',deal_id:'DEAL-2026-006',allocated_amount:49320,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'}
  ];
  return{
    authoritativeSource:'ACCOUNTING_FINANCE_CANONICAL_V011',paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',sourceAsOf:now(),
    payments:incomingPayments,incomingPayments,paymentAllocations:incomingPaymentAllocations,incomingPaymentAllocations,
    paymentAllocationSummaries:[
      {payment_id:'PAYEV-2026-000001',currency:'USD',payment_amount:236250,allocated_total:236250,unallocated_amount:0,allocation_projection_status:'ALLOCATED'},
      {payment_id:'PAYEV-2026-000002',currency:'USD',payment_amount:201750,allocated_total:201750,unallocated_amount:0,allocation_projection_status:'ALLOCATED'},
      {payment_id:'PAYEV-2026-000003',currency:'USD',payment_amount:49320,allocated_total:49320,unallocated_amount:0,allocation_projection_status:'ALLOCATED'},
      {payment_id:'PAYEV-2026-000004',currency:'USD',payment_amount:11800,allocated_total:0,unallocated_amount:11800,allocation_projection_status:'UNALLOCATED'},
      {payment_id:'PAYEV-2026-000005',currency:'RUB',payment_amount:1003000,allocated_total:0,unallocated_amount:1003000,allocation_projection_status:'UNALLOCATED'}
    ],
    dealAllocationTotals:[
      {deal_id:'DEAL-2026-004',currency:'USD',allocated_amount:236250},
      {deal_id:'DEAL-2026-005',currency:'USD',allocated_amount:201750},
      {deal_id:'DEAL-2026-006',currency:'USD',allocated_amount:49320}
    ],
    outgoingPayments:[
      {fact_id:'OUT-2026-005006-KUZMASH',payment_at:now(),beneficiary_name:'КУЗМАШ',beneficiary_role:'SUPPLIER',amount:16536960,currency:'RUB',purpose:'Combined 005/006 supplier payment',bank_document:'BANK-KUZ',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY',flow_kind:'OUTGOING',bank_fact_status:'BANK_CONFIRMED'},
      {fact_id:'OUT-2026-005006-KUZMASH-FEE',payment_at:now(),beneficiary_name:'Банк',beneficiary_role:'BANK',amount:3000,currency:'RUB',purpose:'KUZMASH bank fee',bank_document:'BANK-KUZ-FEE',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY',flow_kind:'OUTGOING',bank_fact_status:'BANK_CONFIRMED'}
    ],
    dealFinanceSummaries:[
      {deal_id:'DEAL-2026-004',client_id:'RONA-C002',client_name:'FARGONA',obligation_amount:236250,received_amount:236250,currency:'USD',client_remaining_amount:0,finance_status:'PAID',accounting_status:financeRevision===2?'PENDING_RECONCILIATION':'OPEN'},
      {deal_id:'DEAL-2026-005',client_id:'RONA-C003',client_name:'SOLYARIS — URTAUL',obligation_amount:672500,received_amount:201750,currency:'USD',client_remaining_amount:470750,finance_status:'NOT_DUE',accounting_status:'OPEN'},
      {deal_id:'DEAL-2026-006',client_id:'RONA-C003',client_name:'SOLYARIS — MARGILAN',obligation_amount:164400,received_amount:49320,currency:'USD',client_remaining_amount:115080,finance_status:'NOT_DUE',accounting_status:'OPEN'},
      {deal_id:'DEAL-2026-009',client_id:'RONA-C005',client_name:'GazOne',obligation_amount:31002300,received_amount:0,currency:'RUB',client_remaining_amount:31002300,finance_status:'NOT_DUE',accounting_status:'OPEN'}
    ],
    paymentTotalsByCurrency:[{currency:'USD',amount:498120},{currency:'RUB',amount:1003000}],obligationPlanAvailable:true,cash:[],
    garantApplication:{registration:'1236',status:'SENT'}
  };
}
function aiSync(){syncCalls++;return{generatedAt:now(),marketAnalystFragment:{generatedAt:now(),analytics:[],news:[],currentPublications:[]},homeCoordination:{generatedAt:now(),totals:{TODAY:zero,'7D':zero,'30D':zero,ALL:zero},periods:{TODAY:[],'7D':[],'30D':[],ALL:[]},recent:[]},agentRewardsFragment:{generatedAt:now(),rows:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'payment-schedule-qa'},financeFragment:financeFragment()}}

const authority={accessUsers:[],contracts:[]};
const mainUi=await (await mainUiRequest()).text();
function send(res,status,body,type='text/plain; charset=utf-8',headers={}){res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)}
function json(res,data,status=200,headers={}){send(res,status,JSON.stringify(data),'application/json; charset=utf-8',headers)}
function safeDistPath(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':'application/octet-stream'}
async function serveFile(res,path,contentType){try{const b=await readFile(path);send(res,200,b,contentType||mime(path));return true}catch{return false}}
async function bridgeWebResponse(webResponse,res){const body=Buffer.from(await webResponse.arrayBuffer()),headers={};for(const[k,v]of webResponse.headers.entries())headers[k]=v;res.writeHead(webResponse.status,headers);res.end(body)}
const optionalUiPaths=new Set(['/portal/deals-current-state-ui','/portal/deals-r1-r11-ui','/portal/cash-r2-ui','/portal/rail-current-v81-maplibre-ui','/portal/applications-total-kpi-ui','/portal/prices-current-ui']);
let server;
server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1'),p=u.pathname;
  if(p==='/favicon.ico'||p.startsWith('/assets/'))return send(res,204,'');
  if(p==='/portal/admin')return void await serveFile(res,join(DIST,'portal','admin.html'),'text/html; charset=utf-8');
  if(p==='/portal/main-ui')return send(res,200,mainUi,'application/javascript; charset=utf-8');
  if(p==='/portal/payment-schedule-current'){
    scheduleEndpointCalls++;
    const port=server.address().port,headers=new Headers();for(const[k,v]of Object.entries(req.headers)){if(Array.isArray(v))headers.set(k,v.join(', '));else if(v!==undefined)headers.set(k,String(v))}
    const webRequest=new Request(`http://127.0.0.1:${port}${req.url}`,{method:'GET',headers});
    return void await bridgeWebResponse(await paymentScheduleRequest({request:webRequest}),res);
  }
  if(p==='/portal/clients-agents-current-ui'||p==='/portal/claims-r2-ui'||p==='/portal/remaining-sections-ui')return void await serveFile(res,join(DIST,p),'application/javascript; charset=utf-8');
  if(optionalUiPaths.has(p))return send(res,200,'/* QA optional current module */','application/javascript; charset=utf-8');
  if(p==='/portal/api/session/me')return json(res,{ok:true,user:{roles:['ADMIN'],display_name:'QA Admin'}});
  if(p==='/portal/api/v1/admin/bootstrap')return json(res,{ok:true,data:adminBootstrap()});
  if(p==='/portal/admin-completed-bootstrap')return json(res,{ok:true,data:adminBootstrap()},200,{'x-rona-admin-completed-applications':'QA'});
  if(p==='/portal/logout')return json(res,{ok:true});
  if(p==='/portal/admin-authority/bootstrap')return json(res,{ok:true,data:authority});
  if(p==='/portal/admin-authority/agent-readiness')return json(res,{ok:true,data:{matrixReady:true}});
  if(p.startsWith('/portal/admin-authority/'))return json(res,{ok:true,data:{}});
  if(p==='/portal/owner-api'){
    const ownerPath=u.searchParams.get('path')||'';
    if(ownerPath==='/admin/bootstrap')return json(res,{ok:true,data:adminBootstrap()});
    if(ownerPath==='/admin/ai-sync')return json(res,{ok:true,data:aiSync()});
    if(ownerPath==='/admin/claims')return json(res,{ok:true,data:{claims:[]}});
    if(ownerPath==='/admin/analytics-bootstrap')return json(res,{ok:true,data:{generatedAt:now(),marketNewsFeed:[]}});
    return json(res,{ok:true,data:{}});
  }
  const f=safeDistPath(p);if(f&&await serveFile(res,f))return;send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;
const assert=(value,message)=>{if(!value)throw new Error(message)};
const compact=value=>String(value||'').replace(/[\s\u00a0\u202f]/g,'').replace(/,/g,'.');

async function openPayments(page){
  const button=page.locator('#nav button[data-page="payments"]');await button.waitFor({state:'visible',timeout:15000});await button.click();
  await page.locator('#page-payments.active').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>window.__RONA_ADMIN_PAYMENT_SCHEDULE_RUNTIME_V1__==='20260912-payment-schedule-v1'&&window.__RONA_PAYMENT_SCHEDULE_CURRENT_STATE__?.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V1',{timeout:15000});
  await page.locator('#rona-payment-schedule-v1').waitFor({state:'visible',timeout:10000});
}
async function scheduleRow(page,id){const row=page.locator(`#rona-payment-schedule-v1 tbody tr[data-schedule-deal="${id}"]`);assert(await row.count()===1,`${id} schedule row duplicate/missing`);return row}
async function assertSchedules(page){
  await openPayments(page);
  const d004=await scheduleRow(page,'DEAL-2026-004'),c004=d004.locator('td');assert(await d004.getAttribute('data-schedule-state')==='PAID','004 schedule state');assert(compact(await c004.nth(1).innerText()).includes('236250USD'),'004 obligation');assert(compact(await c004.nth(2).innerText()).includes('236250USD'),'004 verified receipt');assert(compact(await c004.nth(3).innerText()).includes('0USD')&&compact(await c004.nth(4).innerText()).includes('0USD')&&compact(await c004.nth(5).innerText()).includes('0USD'),'004 zero balances');
  const d005=await scheduleRow(page,'DEAL-2026-005'),c005=d005.locator('td');assert(await d005.getAttribute('data-schedule-state')==='DEFERRED_NOT_DUE','005 schedule state');assert(compact(await c005.nth(1).innerText()).includes('672500USD'),'005 obligation');assert(compact(await c005.nth(2).innerText()).includes('201750USD'),'005 verified receipt');assert(compact(await c005.nth(3).innerText()).includes('470750USD'),'005 remaining');assert(compact(await c005.nth(4).innerText()).includes('0USD'),'005 current due must be zero');assert(compact(await c005.nth(5).innerText()).includes('470750USD'),'005 deferred');assert((await c005.nth(6).innerText()).includes('GU transportation application'),'005 next tranche condition');assert((await c005.nth(7).innerText()).includes('NOT_CONFIRMED'),'005 trigger');assert((await c005.nth(8).innerText()).includes('BANK_CONFIRMED')&&(await c005.nth(9).innerText()).includes('VERIFIED'),'005 bank/allocation layers');assert((await c005.nth(10).innerText()).includes('NOT_DUE')&&(await c005.nth(11).innerText()).includes('OPEN'),'005 Finance/Accounting layers');assert((await c005.nth(12).innerText()).includes('TO_VERIFY'),'005 outgoing FX must be TO_VERIFY');
  const d006=await scheduleRow(page,'DEAL-2026-006'),c006=d006.locator('td');assert(await d006.getAttribute('data-schedule-state')==='DEFERRED_NOT_DUE','006 schedule state');assert(compact(await c006.nth(1).innerText()).includes('164400USD'),'006 obligation');assert(compact(await c006.nth(2).innerText()).includes('49320USD'),'006 verified receipt');assert(compact(await c006.nth(3).innerText()).includes('115080USD'),'006 remaining');assert(compact(await c006.nth(4).innerText()).includes('0USD'),'006 current due must be zero');assert(compact(await c006.nth(5).innerText()).includes('115080USD'),'006 deferred');assert((await c006.nth(7).innerText()).includes('NOT_CONFIRMED'),'006 trigger');
  const d009=await scheduleRow(page,'DEAL-2026-009'),c009=d009.locator('td');assert(await d009.getAttribute('data-schedule-state')==='TO_VERIFY','009 schedule state must fail closed');for(const i of[1,2,3,4,5])assert((await c009.nth(i).innerText()).includes('TO_VERIFY'),`009 cell ${i} inferred`);
  const text=await page.locator('#rona-payment-schedule-v1').innerText();assert(!text.includes('11 800')&&!text.includes('1 003 000')&&!text.includes('16 536 960'),'unallocated/KUZMASH amount leaked into schedule');
}

let browser;const errors=[];
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1600,height:1000}});
  await context.addInitScript(()=>{const nativeSetInterval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>nativeSetInterval(fn,ms===60000?250:ms,...args)});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push('pageerror:'+String(error.message||error)));
  page.on('response',response=>{if(response.status()>=400)errors.push(`http:${response.status()}:${response.url()}`)});
  page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))errors.push('console:'+message.text())});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});
  await assertSchedules(page);

  assert(scheduleEndpointCalls>0&&syncCalls>0,'trusted schedule endpoint did not consume Finance source');
  const beforeRefresh=scheduleEndpointCalls;financeRevision=2;
  await page.waitForFunction(()=>document.querySelector('tr[data-schedule-deal="DEAL-2026-004"]')?.children?.[11]?.textContent?.includes('PENDING_RECONCILIATION'),{timeout:5000});
  assert(scheduleEndpointCalls>beforeRefresh,'Finance schedule refresh did not propagate');
  financeRevision=1;await page.evaluate(()=>window.__RONA_PAYMENT_SCHEDULE_REFRESH__());
  await page.waitForFunction(()=>document.querySelector('tr[data-schedule-deal="DEAL-2026-004"]')?.children?.[11]?.textContent?.includes('OPEN'),{timeout:5000});
  await assertSchedules(page);

  const beforeHard=scheduleEndpointCalls;await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});await assertSchedules(page);assert(scheduleEndpointCalls>beforeHard,'hard refresh did not fetch server schedule');
  await page.evaluate(async()=>{await window.__RONA_PAYMENT_SCHEDULE_REFRESH__();await window.__RONA_PAYMENT_SCHEDULE_REFRESH__();await window.__RONA_PAYMENT_SCHEDULE_REFRESH__()});
  await page.waitForTimeout(150);assert(await page.locator('#rona-payment-schedule-v1').count()===1,'schedule card duplicated');assert(await page.locator('#rona-payment-schedule-v1 tbody tr').count()===4,'schedule rows duplicated');

  await page.locator('#page-payments .rona-fin-filter button',{hasText:'Оплачено'}).click();await page.waitForTimeout(100);const paidText=await page.locator('#page-payments').innerText();assert(paidText.includes('КУЗМАШ'),'KUZMASH outgoing fact missing');assert(paidText.includes('Учтено без распределения по сделкам'),'KUZMASH must remain unallocated/TO_VERIFY');
  await page.locator('#page-payments .rona-fin-filter button',{hasText:'Поступило'}).click();await page.waitForTimeout(100);await assertSchedules(page);

  await mkdir('artifacts/admin-payments',{recursive:true});await page.screenshot({path:'artifacts/admin-payments/ADMIN_PAYMENTS_SCHEDULE_MATERIALIZATION_V1.png',fullPage:true});
  assert(errors.length===0,'browser runtime errors: '+errors.join(' | '));
  console.log('ADMIN_PAYMENTS_SCHEDULE_MATERIALIZATION_BROWSER_QA=PASS');
  console.log('DEAL004_SCHEDULE=PASS');console.log('DEAL005_SCHEDULE=PASS');console.log('DEAL006_SCHEDULE=PASS');console.log('DEAL009_FAIL_CLOSED=PASS');
  console.log('SENT_DOES_NOT_CREATE_DUE=PASS');console.log('PAYMENT_ALLOCATION_SEPARATION=PASS');console.log('KUZMASH_NO_INFERRED_SPLIT=PASS');console.log('FX_NO_SYNTHESIS=PASS');
  console.log('FINANCE_REFRESH_PROPAGATION=PASS');console.log('HARD_REFRESH=PASS');console.log('NO_DUPLICATES=PASS');console.log('NO_RUNTIME_ERRORS=PASS');
  console.log(JSON.stringify({origin,syncCalls,scheduleEndpointCalls,errors}));
  await context.close();
}catch(error){console.error('ADMIN_PAYMENTS_SCHEDULE_MATERIALIZATION_BROWSER_QA=FAIL',error?.stack||error);if(errors.length)console.error(JSON.stringify({errors}));process.exitCode=1}finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}
