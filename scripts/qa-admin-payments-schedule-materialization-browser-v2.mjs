import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { onRequest as mainUiRequest } from '../functions/portal/main-ui/index.js';
import { onRequest as paymentScheduleRequest } from '../functions/portal/payment-schedule-current.js';

const ROOT=process.cwd(),DIST=join(ROOT,'dist');
let financeRevision=1,syncCalls=0,scheduleEndpointCalls=0;
const now=()=>new Date().toISOString();
const zero={sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0};

function bootstrap(){return{
  clients:[{client_id:'RONA-C002',legal_name:'FARGONA'},{client_id:'RONA-C003',legal_name:'UNVERSAL SOLYARIS GRAND'},{client_id:'RONA-C005',legal_name:'GazOne'}],companies:[],agents:[],applications:[],documents:[],payments:[],cash:[],rail:[],publications:[],operationalConflicts:[],claims:[],
  deals:[
    {deal_id:'DEAL-2026-004',client_id:'RONA-C002',client_name:'FARGONA',business_status:'EXECUTING',finance_status:'PAID',accounting_closure_status:financeRevision===2?'PENDING_RECONCILIATION':'OPEN',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-2026-005',client_id:'RONA-C003',client_name:'SOLARIS — URTAUL',business_status:'EXECUTING',finance_status:'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-2026-006',client_id:'RONA-C003',client_name:'SOLARIS — MARGILAN',business_status:'EXECUTING',finance_status:'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-2026-009',client_id:'RONA-C005',client_name:'GazOne',business_status:'EXECUTING',finance_status:'NOT_DUE',accounting_closure_status:'OPEN',lifecycle_state:'ACTIVE'}
  ]
}}

function finance(){
  const incomingPayments=[
    {payment_id:'PAYEV-2026-000001',payment_at:now(),amount:236250,currency:'USD',payer_name:'FARGONA',original_payment_purpose:'DEAL-2026-004',bank_transaction_reference:'BANK-004',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000002',payment_at:now(),amount:201750,currency:'USD',payer_name:'SOLARIS',original_payment_purpose:'DEAL-2026-005 30%',bank_transaction_reference:'BANK-005',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000003',payment_at:now(),amount:49320,currency:'USD',payer_name:'SOLARIS',original_payment_purpose:'DEAL-2026-006 30%',bank_transaction_reference:'BANK-006',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000004',payment_at:now(),amount:11800,currency:'USD',payer_name:'UNALLOCATED USD',original_payment_purpose:'Unallocated control',bank_transaction_reference:'BANK-U1',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAYEV-2026-000005',payment_at:now(),amount:1003000,currency:'RUB',payer_name:'UNALLOCATED RUB',original_payment_purpose:'Unallocated control',bank_transaction_reference:'BANK-U2',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'}
  ];
  const allocations=[
    {payment_id:'PAYEV-2026-000001',currency:'USD',client_id:'RONA-C002',legal_name:'FARGONA',deal_id:'DEAL-2026-004',allocated_amount:236250,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'},
    {payment_id:'PAYEV-2026-000002',currency:'USD',client_id:'RONA-C003',legal_name:'SOLARIS',deal_id:'DEAL-2026-005',allocated_amount:201750,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'},
    {payment_id:'PAYEV-2026-000003',currency:'USD',client_id:'RONA-C003',legal_name:'SOLARIS',deal_id:'DEAL-2026-006',allocated_amount:49320,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'}
  ];
  return{
    authoritativeSource:'ACCOUNTING_FINANCE_CANONICAL_V011',paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',sourceAsOf:now(),payments:incomingPayments,incomingPayments,paymentAllocations:allocations,incomingPaymentAllocations:allocations,
    paymentAllocationSummaries:[
      {payment_id:'PAYEV-2026-000001',currency:'USD',payment_amount:236250,allocated_total:236250,unallocated_amount:0,allocation_projection_status:'ALLOCATED'},
      {payment_id:'PAYEV-2026-000002',currency:'USD',payment_amount:201750,allocated_total:201750,unallocated_amount:0,allocation_projection_status:'ALLOCATED'},
      {payment_id:'PAYEV-2026-000003',currency:'USD',payment_amount:49320,allocated_total:49320,unallocated_amount:0,allocation_projection_status:'ALLOCATED'},
      {payment_id:'PAYEV-2026-000004',currency:'USD',payment_amount:11800,allocated_total:0,unallocated_amount:11800,allocation_projection_status:'UNALLOCATED'},
      {payment_id:'PAYEV-2026-000005',currency:'RUB',payment_amount:1003000,allocated_total:0,unallocated_amount:1003000,allocation_projection_status:'UNALLOCATED'}
    ],
    dealAllocationTotals:[{deal_id:'DEAL-2026-004',currency:'USD',allocated_amount:236250},{deal_id:'DEAL-2026-005',currency:'USD',allocated_amount:201750},{deal_id:'DEAL-2026-006',currency:'USD',allocated_amount:49320}],
    outgoingPayments:[
      {fact_id:'OUT-2026-005006-KUZMASH',payment_at:now(),beneficiary_name:'КУЗМАШ',beneficiary_role:'SUPPLIER',amount:16536960,currency:'RUB',purpose:'Combined supplier payment',bank_document:'BANK-KUZ',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY',flow_kind:'OUTGOING',bank_fact_status:'BANK_CONFIRMED'},
      {fact_id:'OUT-2026-005006-KUZMASH-FEE',payment_at:now(),beneficiary_name:'Банк',beneficiary_role:'BANK',amount:3000,currency:'RUB',purpose:'KUZMASH fee',bank_document:'BANK-KUZ-FEE',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY',flow_kind:'OUTGOING',bank_fact_status:'BANK_CONFIRMED'}
    ],
    dealFinanceSummaries:[
      {deal_id:'DEAL-2026-004',client_id:'RONA-C002',client_name:'FARGONA',obligation_amount:236250,received_amount:236250,currency:'USD',client_remaining_amount:0,finance_status:'PAID',accounting_status:financeRevision===2?'PENDING_RECONCILIATION':'OPEN'},
      {deal_id:'DEAL-2026-005',client_id:'RONA-C003',client_name:'SOLARIS — URTAUL',obligation_amount:672500,received_amount:201750,currency:'USD',client_remaining_amount:470750,finance_status:'NOT_DUE',accounting_status:'OPEN'},
      {deal_id:'DEAL-2026-006',client_id:'RONA-C003',client_name:'SOLARIS — MARGILAN',obligation_amount:164400,received_amount:49320,currency:'USD',client_remaining_amount:115080,finance_status:'NOT_DUE',accounting_status:'OPEN'},
      {deal_id:'DEAL-2026-009',client_id:'RONA-C005',client_name:'GazOne',obligation_amount:31002300,received_amount:0,currency:'RUB',client_remaining_amount:31002300,finance_status:'NOT_DUE',accounting_status:'OPEN'}
    ],
    paymentTotalsByCurrency:[{currency:'USD',amount:498120},{currency:'RUB',amount:1003000}],obligationPlanAvailable:true,cash:[]
  };
}
function aiSync(){syncCalls++;return{generatedAt:now(),marketAnalystFragment:{generatedAt:now(),analytics:[],news:[],currentPublications:[]},homeCoordination:{generatedAt:now(),totals:{TODAY:zero,'7D':zero,'30D':zero,ALL:zero},periods:{TODAY:[],'7D':[],'30D':[],ALL:[]},recent:[]},agentRewardsFragment:{generatedAt:now(),rows:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'schedule-qa-v2'},financeFragment:finance()}}

const authority={accessUsers:[],contracts:[]};
const mainUi=await (await mainUiRequest()).text();
const send=(res,status,body,type='text/plain; charset=utf-8',headers={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)};
const json=(res,data,status=200,headers={})=>send(res,status,JSON.stringify(data),'application/json; charset=utf-8',headers);
function safeDistPath(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':'application/octet-stream'}
async function serveFile(res,path,contentType){try{const body=await readFile(path);send(res,200,body,contentType||mime(path));return true}catch{return false}}
async function bridge(response,res){const body=Buffer.from(await response.arrayBuffer()),headers={};for(const[k,v]of response.headers.entries())headers[k]=v;res.writeHead(response.status,headers);res.end(body)}
const optionalUi=new Set(['/portal/deals-current-state-ui','/portal/deals-r1-r11-ui','/portal/cash-r2-ui','/portal/rail-current-v81-maplibre-ui','/portal/applications-total-kpi-ui','/portal/prices-current-ui']);
let server;
server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1'),p=u.pathname;
  if(p==='/favicon.ico')return send(res,204,'');
  if(p==='/portal/admin')return void await serveFile(res,join(DIST,'portal','admin.html'),'text/html; charset=utf-8');
  if(p==='/portal/main-ui')return send(res,200,mainUi,'application/javascript; charset=utf-8');
  if(p==='/portal/payment-schedule-current'){
    scheduleEndpointCalls++;
    const port=server.address().port,headers=new Headers();for(const[k,v]of Object.entries(req.headers)){if(Array.isArray(v))headers.set(k,v.join(', '));else if(v!==undefined)headers.set(k,String(v))}
    return void await bridge(await paymentScheduleRequest({request:new Request(`http://127.0.0.1:${port}${req.url}`,{method:'GET',headers})}),res);
  }
  if(p==='/portal/clients-agents-current-ui'||p==='/portal/claims-r2-ui'||p==='/portal/remaining-sections-ui')return void await serveFile(res,join(DIST,p),'application/javascript; charset=utf-8');
  if(optionalUi.has(p))return send(res,200,'/* QA optional current module */','application/javascript; charset=utf-8');
  if(p==='/portal/api/session/me')return json(res,{ok:true,user:{roles:['ADMIN'],display_name:'QA Admin'}});
  if(p==='/portal/api/v1/admin/bootstrap')return json(res,{ok:true,data:bootstrap()});
  if(p==='/portal/admin-completed-bootstrap')return json(res,{ok:true,data:bootstrap()},200,{'x-rona-admin-completed-applications':'QA'});
  if(p==='/portal/logout')return json(res,{ok:true});
  if(p==='/portal/admin-authority/bootstrap')return json(res,{ok:true,data:authority});
  if(p==='/portal/admin-authority/agent-readiness')return json(res,{ok:true,data:{matrixReady:true}});
  if(p.startsWith('/portal/admin-authority/'))return json(res,{ok:true,data:{}});
  if(p==='/portal/owner-api'){
    const ownerPath=u.searchParams.get('path')||'';
    if(ownerPath==='/admin/bootstrap')return json(res,{ok:true,data:bootstrap()});
    if(ownerPath==='/admin/ai-sync')return json(res,{ok:true,data:aiSync()});
    if(ownerPath==='/admin/claims')return json(res,{ok:true,data:{claims:[]}});
    if(ownerPath==='/admin/analytics-bootstrap')return json(res,{ok:true,data:{generatedAt:now(),marketNewsFeed:[]}});
    return json(res,{ok:true,data:{}});
  }
  const file=safeDistPath(p);if(file&&await serveFile(res,file))return;send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;
const assert=(value,message)=>{if(!value)throw new Error(message)};
const compact=value=>String(value||'').replace(/[\s\u00a0\u202f]/g,'').replace(/,/g,'.');

async function openPayments(page){
  const button=page.locator('#nav button[data-page="payments"]');await button.waitFor({state:'visible',timeout:15000});await button.click();await page.locator('#page-payments.active').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>window.__RONA_ADMIN_PAYMENT_SCHEDULE_RUNTIME_V1__==='20260912-payment-schedule-v1'&&window.__RONA_PAYMENT_SCHEDULE_CURRENT_STATE__?.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V1',{timeout:15000});
  await page.locator('#rona-payment-schedule-v1').waitFor({state:'visible',timeout:10000});
}
async function dealRow(page,id){const row=page.locator(`#rona-payment-schedule-v1 tbody tr[data-schedule-deal="${id}"]`);assert(await row.count()===1,`${id} schedule duplicate/missing`);return row}
async function verifySchedule(page){
  await openPayments(page);
  const d4=await dealRow(page,'DEAL-2026-004'),a=d4.locator('td');assert(await d4.getAttribute('data-schedule-state')==='PAID','004 state');assert(compact(await a.nth(1).innerText()).includes('236250USD')&&compact(await a.nth(2).innerText()).includes('236250USD'),'004 amounts');assert([3,4,5].every(async()=>true));assert(compact(await a.nth(3).innerText()).includes('0USD')&&compact(await a.nth(4).innerText()).includes('0USD')&&compact(await a.nth(5).innerText()).includes('0USD'),'004 balances');
  const d5=await dealRow(page,'DEAL-2026-005'),b=d5.locator('td');assert(await d5.getAttribute('data-schedule-state')==='DEFERRED_NOT_DUE','005 state');assert(compact(await b.nth(1).innerText()).includes('672500USD')&&compact(await b.nth(2).innerText()).includes('201750USD')&&compact(await b.nth(3).innerText()).includes('470750USD'),'005 main amounts');assert(compact(await b.nth(4).innerText()).includes('0USD')&&compact(await b.nth(5).innerText()).includes('470750USD'),'005 due/deferred');assert((await b.nth(6).innerText()).includes('GU transportation application')&&(await b.nth(7).innerText()).includes('NOT_CONFIRMED'),'005 trigger');assert((await b.nth(8).innerText()).includes('BANK_CONFIRMED')&&(await b.nth(9).innerText()).includes('VERIFIED')&&(await b.nth(10).innerText()).includes('NOT_DUE')&&(await b.nth(11).innerText()).includes('OPEN'),'005 status layers');assert((await b.nth(12).innerText()).includes('TO_VERIFY'),'005 synthetic FX');
  const d6=await dealRow(page,'DEAL-2026-006'),c=d6.locator('td');assert(await d6.getAttribute('data-schedule-state')==='DEFERRED_NOT_DUE','006 state');assert(compact(await c.nth(1).innerText()).includes('164400USD')&&compact(await c.nth(2).innerText()).includes('49320USD')&&compact(await c.nth(3).innerText()).includes('115080USD'),'006 main amounts');assert(compact(await c.nth(4).innerText()).includes('0USD')&&compact(await c.nth(5).innerText()).includes('115080USD')&&(await c.nth(7).innerText()).includes('NOT_CONFIRMED'),'006 due/deferred/trigger');
  const d9=await dealRow(page,'DEAL-2026-009'),d=d9.locator('td');assert(await d9.getAttribute('data-schedule-state')==='TO_VERIFY','009 state');for(const i of[1,2,3,4,5])assert((await d.nth(i).innerText()).includes('TO_VERIFY'),`009 inferred cell ${i}`);
  const scheduleText=await page.locator('#rona-payment-schedule-v1').innerText();assert(!scheduleText.includes('11 800')&&!scheduleText.includes('1 003 000')&&!scheduleText.includes('16 536 960'),'unallocated/KUZMASH amount leaked into schedule');
}

let browser;const runtimeErrors=[];
try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1600,height:1000}});
  await context.addInitScript(()=>{const native=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>native(fn,ms===60000?250:ms,...args)});
  const page=await context.newPage();page.on('pageerror',e=>runtimeErrors.push('pageerror:'+String(e.message||e)));page.on('response',r=>{if(r.status()>=400)runtimeErrors.push(`http:${r.status()}:${r.url()}`)});page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))runtimeErrors.push('console:'+m.text())});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});await verifySchedule(page);
  assert(scheduleEndpointCalls>0&&syncCalls>0,'trusted server projection was not used');

  const beforeRefresh=scheduleEndpointCalls;financeRevision=2;await page.waitForFunction(()=>document.querySelector('tr[data-schedule-deal="DEAL-2026-004"]')?.children?.[11]?.textContent?.includes('PENDING_RECONCILIATION'),{timeout:5000});assert(scheduleEndpointCalls>beforeRefresh,'Finance refresh did not propagate');
  financeRevision=1;await page.evaluate(()=>window.__RONA_PAYMENT_SCHEDULE_REFRESH__());await page.waitForFunction(()=>document.querySelector('tr[data-schedule-deal="DEAL-2026-004"]')?.children?.[11]?.textContent?.includes('OPEN'),{timeout:5000});await verifySchedule(page);

  const beforeHard=scheduleEndpointCalls;await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});await verifySchedule(page);assert(scheduleEndpointCalls>beforeHard,'hard refresh did not refetch server schedule');
  await page.evaluate(async()=>{await window.__RONA_PAYMENT_SCHEDULE_REFRESH__();await window.__RONA_PAYMENT_SCHEDULE_REFRESH__();await window.__RONA_PAYMENT_SCHEDULE_REFRESH__()});await page.waitForTimeout(150);assert(await page.locator('#rona-payment-schedule-v1').count()===1,'schedule card duplicated');assert(await page.locator('#rona-payment-schedule-v1 tbody tr').count()===4,'schedule rows duplicated');

  await page.locator('#page-payments .rona-fin-filter button',{hasText:'Оплачено'}).click();await page.waitForTimeout(100);const paid=await page.locator('#page-payments').innerText();assert(paid.includes('КУЗМАШ')&&paid.includes('Учтено без распределения по сделкам'),'KUZMASH must remain outgoing and unallocated');
  await page.locator('#page-payments .rona-fin-filter button',{hasText:'Поступило'}).click();await page.waitForTimeout(100);await verifySchedule(page);
  await mkdir('artifacts/admin-payments',{recursive:true});await page.screenshot({path:'artifacts/admin-payments/ADMIN_PAYMENTS_SCHEDULE_MATERIALIZATION_V1.png',fullPage:true});
  assert(runtimeErrors.length===0,'runtime errors: '+runtimeErrors.join(' | '));
  console.log('ADMIN_PAYMENTS_SCHEDULE_MATERIALIZATION_BROWSER_QA=PASS');
  for(const marker of['DEAL004_SCHEDULE','DEAL005_SCHEDULE','DEAL006_SCHEDULE','DEAL009_FAIL_CLOSED','SENT_DOES_NOT_CREATE_DUE','PAYMENT_ALLOCATION_SEPARATION','KUZMASH_NO_INFERRED_SPLIT','FX_NO_SYNTHESIS','FINANCE_REFRESH_PROPAGATION','HARD_REFRESH','NO_DUPLICATES','NO_RUNTIME_ERRORS'])console.log(marker+'=PASS');
  console.log(JSON.stringify({origin,syncCalls,scheduleEndpointCalls,runtimeErrors}));await context.close();
}catch(error){console.error('ADMIN_PAYMENTS_SCHEDULE_MATERIALIZATION_BROWSER_QA=FAIL',error?.stack||error);if(runtimeErrors.length)console.error(JSON.stringify({runtimeErrors}));process.exitCode=1}finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}
