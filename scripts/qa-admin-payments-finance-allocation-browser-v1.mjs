import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { onRequest as mainUiRequest } from '../functions/portal/main-ui.js';

const ROOT=process.cwd(),DIST=join(ROOT,'dist'),now=new Date().toISOString();
let financeRevision=1,syncCalls=0;
const adminBootstrap={
  clients:[
    {client_id:'CLIENT-A',legal_name:'Client A'},{client_id:'CLIENT-B',legal_name:'Client B'},{client_id:'CLIENT-C',legal_name:'Client C'}
  ],companies:[],agents:[],applications:[],documents:[],payments:[],cash:[],rail:[],publications:[],operationalConflicts:[],claims:[],
  deals:[
    {deal_id:'DEAL-A',client_id:'CLIENT-A',client_name:'Client A',business_status:'EXECUTING',finance_status:'DUE',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-B',client_id:'CLIENT-B',client_name:'Client B',business_status:'EXECUTING',finance_status:'DUE',lifecycle_state:'ACTIVE'},
    {deal_id:'DEAL-C',client_id:'CLIENT-C',client_name:'Client C',business_status:'EXECUTING',finance_status:'NOT_DUE',lifecycle_state:'ACTIVE'}
  ]
};
const zero={sent:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0};
function financeFragment(){
  const a=financeRevision===2?35000:30000,b=financeRevision===2?45000:50000;
  const splitAllocations=financeRevision===3?[]:[
    {payment_id:'PAY-QA-SPLIT-001',currency:'USD',client_id:'CLIENT-A',legal_name:'Client A',deal_id:'DEAL-A',allocated_amount:a,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'},
    {payment_id:'PAY-QA-SPLIT-001',currency:'USD',client_id:'CLIENT-B',legal_name:'Client B',deal_id:'DEAL-B',allocated_amount:b,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'}
  ];
  if(syncCalls%2===0)splitAllocations.reverse();
  const incomingPayments=[
    {payment_id:'PAY-QA-SPLIT-001',payment_at:now,amount:100000,currency:'USD',payer_name:'QA Split Payer',original_payment_purpose:'Split incoming receipt',bank_transaction_reference:'BANK-SPLIT',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAY-QA-SECOND-002',payment_at:now,amount:12000,currency:'USD',payer_name:'QA Second Payer',original_payment_purpose:'Second receipt to Deal A',bank_transaction_reference:'BANK-SECOND',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'},
    {payment_id:'PAY-QA-RUB-003',payment_at:now,amount:500000,currency:'RUB',payer_name:'QA RUB Payer',original_payment_purpose:'RUB receipt',bank_transaction_reference:'BANK-RUB',bank_fact_status:'BANK_CONFIRMED',finance_status:'PARTIALLY_PAID',accounting_closure_status:'PENDING_RECONCILIATION'}
  ];
  const incomingPaymentAllocations=[...splitAllocations,
    {payment_id:'PAY-QA-SECOND-002',currency:'USD',client_id:'CLIENT-A',legal_name:'Client A',deal_id:'DEAL-A',allocated_amount:12000,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'},
    {payment_id:'PAY-QA-RUB-003',currency:'RUB',client_id:'CLIENT-C',legal_name:'Client C',deal_id:'DEAL-C',allocated_amount:400000,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'}
  ];
  const outgoingBank={payment_id:'PAY-OUT-QA-001',payment_at:now,amount:7000,currency:'RUB',payer_name:'RONA Trade',original_payment_purpose:'Outgoing vendor spend',bank_transaction_reference:'BANK-OUT',bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'};
  const paymentAllocations=[...incomingPaymentAllocations,{payment_id:'PAY-OUT-QA-001',currency:'RUB',deal_id:'DEAL-A',allocated_amount:7000,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'}];
  const splitSummary=financeRevision===3
    ?{payment_id:'PAY-QA-SPLIT-001',currency:'USD',payment_amount:100000,allocated_total:0,unallocated_amount:100000,allocation_projection_status:'TO_VERIFY'}
    :{payment_id:'PAY-QA-SPLIT-001',currency:'USD',payment_amount:100000,allocated_total:80000,unallocated_amount:20000,allocation_projection_status:'PARTIALLY_ALLOCATED'};
  const dealAllocationTotals=financeRevision===3
    ?[{deal_id:'DEAL-A',currency:'USD',allocated_amount:12000},{deal_id:'DEAL-C',currency:'RUB',allocated_amount:400000}]
    :[{deal_id:'DEAL-A',currency:'USD',allocated_amount:a+12000},{deal_id:'DEAL-B',currency:'USD',allocated_amount:b},{deal_id:'DEAL-C',currency:'RUB',allocated_amount:400000}];
  return{
    authoritativeSource:'ACCOUNTING_FINANCE_CANONICAL_V011',paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',sourceAsOf:now,
    payments:[...incomingPayments,outgoingBank],incomingPayments,paymentAllocations,incomingPaymentAllocations,
    paymentAllocationSummaries:[splitSummary,{payment_id:'PAY-QA-SECOND-002',currency:'USD',payment_amount:12000,allocated_total:12000,unallocated_amount:0,allocation_projection_status:'ALLOCATED'},{payment_id:'PAY-QA-RUB-003',currency:'RUB',payment_amount:500000,allocated_total:400000,unallocated_amount:100000,allocation_projection_status:'PARTIALLY_ALLOCATED'}],
    dealAllocationTotals,
    outgoingPayments:[
      {fact_id:'PAY-OUT-QA-001',payment_at:now,beneficiary_name:'QA Vendor',beneficiary_role:'SUPPLIER',amount:7000,currency:'RUB',purpose:'Confirmed deal spend',bank_document:'BANK-OUT',deal_ids:['DEAL-A'],deal_allocation_status:'CONFIRMED',flow_kind:'OUTGOING',bank_fact_status:'BANK_CONFIRMED'},
      {fact_id:'PAY-FEE-QA-001',payment_at:now,beneficiary_name:'QA Bank Fee',beneficiary_role:'BANK',amount:100,currency:'RUB',purpose:'General bank fee',bank_document:'BANK-FEE',deal_ids:['DEAL-A'],deal_allocation_status:'TO_VERIFY',flow_kind:'OUTGOING',bank_fact_status:'BANK_CONFIRMED'}
    ],
    dealFinanceSummaries:[
      {deal_id:'DEAL-A',client_id:'CLIENT-A',client_name:'Client A',obligation_amount:80000,received_amount:financeRevision===3?12000:a+12000,currency:'USD',client_remaining_amount:financeRevision===3?68000:80000-(a+12000),finance_status:'PARTIALLY_PAID',accounting_status:'OPEN'},
      {deal_id:'DEAL-B',client_id:'CLIENT-B',client_name:'Client B',obligation_amount:70000,received_amount:financeRevision===3?0:b,currency:'USD',client_remaining_amount:financeRevision===3?70000:70000-b,finance_status:'PARTIALLY_PAID',accounting_status:'OPEN'},
      {deal_id:'DEAL-C',client_id:'CLIENT-C',client_name:'Client C',obligation_amount:600000,received_amount:400000,currency:'RUB',client_remaining_amount:200000,finance_status:'PARTIALLY_PAID',accounting_status:'PENDING_RECONCILIATION'}
    ],
    paymentTotalsByCurrency:[{currency:'USD',amount:112000},{currency:'RUB',amount:500000}],obligationPlanAvailable:true,cash:[]
  };
}
function aiSync(){syncCalls++;return{generatedAt:new Date().toISOString(),marketAnalystFragment:{generatedAt:now,analytics:[],news:[],currentPublications:[]},homeCoordination:{generatedAt:now,totals:{TODAY:zero,'7D':zero,'30D':zero,ALL:zero},periods:{TODAY:[],'7D':[],'30D':[],ALL:[]},recent:[]},agentRewardsFragment:{generatedAt:now,rows:[]},aiRuntime:{enabled:true,scheduler_state:'ENABLED',worker_version:'payments-qa'},financeFragment:financeFragment()}}
const authority={accessUsers:[],contracts:[]};
const mainUi=await (await mainUiRequest()).text();
function send(res,status,body,type='text/plain; charset=utf-8',headers={}){res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}
function safeDistPath(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':'application/octet-stream'}
async function serveFile(res,path,contentType){try{const b=await readFile(path);send(res,200,b,contentType||mime(path));return true}catch{return false}}
const optionalUiPaths=new Set(['/portal/deals-current-state-ui','/portal/deals-r1-r11-ui','/portal/cash-r2-ui','/portal/rail-current-v81-maplibre-ui','/portal/applications-total-kpi-ui','/portal/prices-current-ui']);
const server=http.createServer(async(req,res)=>{const u=new URL(req.url||'/','http://127.0.0.1'),p=u.pathname;if(p==='/favicon.ico')return send(res,204,'');if(p==='/portal/admin')return void await serveFile(res,join(DIST,'portal','admin.html'),'text/html; charset=utf-8');if(p==='/portal/main-ui')return send(res,200,mainUi,'application/javascript; charset=utf-8');if(p==='/portal/clients-agents-current-ui'||p==='/portal/claims-r2-ui'||p==='/portal/remaining-sections-ui')return void await serveFile(res,join(DIST,p),'application/javascript; charset=utf-8');if(optionalUiPaths.has(p))return send(res,200,'/* QA optional current module */','application/javascript; charset=utf-8');if(p==='/portal/api/session/me')return json(res,{ok:true,user:{roles:['ADMIN'],display_name:'QA Admin'}});if(p==='/portal/api/v1/admin/bootstrap')return json(res,{ok:true,data:adminBootstrap});if(p==='/portal/logout')return json(res,{ok:true});if(p==='/portal/admin-authority/bootstrap')return json(res,{ok:true,data:authority});if(p==='/portal/admin-authority/agent-readiness')return json(res,{ok:true,data:{matrixReady:true}});if(p.startsWith('/portal/admin-authority/'))return json(res,{ok:true,data:{}});if(p==='/portal/owner-api'){const ownerPath=u.searchParams.get('path')||'';if(ownerPath==='/admin/bootstrap')return json(res,{ok:true,data:adminBootstrap});if(ownerPath==='/admin/ai-sync')return json(res,{ok:true,data:aiSync()});if(ownerPath==='/admin/claims')return json(res,{ok:true,data:{claims:[]}});if(ownerPath==='/admin/analytics-bootstrap')return json(res,{ok:true,data:{generatedAt:now,marketNewsFeed:[]}});return json(res,{ok:true,data:{}})}const f=safeDistPath(p);if(f&&await serveFile(res,f))return;send(res,404,'not found')});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const origin=`http://127.0.0.1:${server.address().port}`;
const assert=(v,m)=>{if(!v)throw new Error(m)};const compact=s=>String(s||'').replace(/[\s\u00a0\u202f]/g,'').replace(/,/g,'.');
async function openPayments(page){const b=page.locator('#nav button[data-page="payments"]');await b.waitFor({state:'visible',timeout:15000});await b.click();await page.locator('#page-payments.active').waitFor({state:'visible',timeout:10000});await page.waitForFunction(()=>window.__RONA_ADMIN_PAYMENTS_FINANCE_PROJECTION_V1__==='20260912-v1'&&window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.financeFragment?.paymentProjectionContract==='ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',{timeout:15000});await page.waitForTimeout(150)}
async function splitRow(page){const row=page.locator('#page-payments tbody tr',{hasText:'PAY-QA-SPLIT-001'});assert(await row.count()===1,'split PAYMENT must render exactly once');return row}
async function assertSplit(page,a='30000',b='50000',u='20000'){
  await openPayments(page);const row=await splitRow(page),cells=row.locator('td');assert(await cells.count()>=11,'incoming PAYMENT columns missing');const allocation=compact(await cells.nth(7).innerText()),unallocated=compact(await cells.nth(8).innerText()),whole=await row.innerText();assert(allocation.includes('DEAL-A')&&allocation.includes(a),'DEAL-A exact allocation missing: '+allocation);assert(allocation.includes('DEAL-B')&&allocation.includes(b),'DEAL-B exact allocation missing: '+allocation);assert(!allocation.includes('100000'),'full PAYMENT amount leaked into deal allocation: '+allocation);assert(unallocated.includes(u),'unallocated residue mismatch: '+unallocated);assert(whole.includes('Открыт'),'Accounting OPEN must remain distinct');assert(whole.includes('Оплачено'),'Finance status must remain distinct');const incomingText=await page.locator('#page-payments').innerText();assert(!incomingText.includes('QA Vendor')&&!incomingText.includes('QA Bank Fee'),'outgoing payment leaked into incoming view')}
let browser;const errors=[];
try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push('pageerror:'+String(e.message||e)));page.on('response',r=>{if(r.status()>=400)errors.push(`http:${r.status()}:${r.url()}`)});page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))errors.push('console:'+m.text())});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});
  await assertSplit(page);

  await page.evaluate(()=>refreshAdmin());await page.waitForTimeout(250);await assertSplit(page);
  await page.evaluate(()=>{renderPayments();renderPayments();renderPayments()});await page.waitForTimeout(100);assert(await page.locator('#page-payments tbody tr',{hasText:'PAY-QA-SPLIT-001'}).count()===1,'repeated render duplicated PAYMENT row');assert(await page.locator('#page-payments .rona-fin-kpi').count()===4,'repeated render duplicated KPI totals');

  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:15000});await assertSplit(page);

  financeRevision=2;await page.evaluate(()=>refreshAdmin());await page.waitForTimeout(250);await assertSplit(page,'35000','45000','20000');

  financeRevision=3;await page.evaluate(()=>refreshAdmin());await page.waitForTimeout(250);await openPayments(page);const stale=await splitRow(page),staleCells=stale.locator('td'),staleAllocation=await staleCells.nth(7).innerText(),staleUnallocated=await staleCells.nth(8).innerText();assert(!staleAllocation.includes('DEAL-A')&&!staleAllocation.includes('DEAL-B'),'stale/missing allocation was assigned to deal');assert(staleAllocation.includes('Нераспределено'),'missing Finance allocation must fail closed');assert(staleUnallocated.includes('Требует верификации'),'conflicting/stale summary must show TO_VERIFY');

  financeRevision=1;await page.evaluate(()=>refreshAdmin());await page.waitForTimeout(250);await assertSplit(page);
  await page.locator('#page-payments .rona-fin-filter button',{hasText:'Оплачено'}).click();await page.waitForTimeout(100);const paidText=await page.locator('#page-payments').innerText();assert(paidText.includes('QA Vendor')&&paidText.includes('QA Bank Fee'),'outgoing payments section missing');assert(paidText.includes('Учтено без распределения по сделкам'),'unallocated bank fee must remain TO_VERIFY');const paidKpi=compact(await page.locator('#page-payments .rona-fin-kpi',{hasText:'Оплачено в рамках сделок'}).innerText());assert(paidKpi.includes('7000')&&!paidKpi.includes('7100'),'TO_VERIFY fee leaked into confirmed outgoing total: '+paidKpi);

  await page.setViewportSize({width:900,height:800});await page.waitForTimeout(150);assert(await page.locator('#page-payments.active').isVisible(),'Payments page not responsive/visible at 900px');
  await mkdir('artifacts/admin-payments',{recursive:true});await page.screenshot({path:'artifacts/admin-payments/ADMIN_PAYMENTS_FINANCE_ALLOCATION_SPLIT.png',fullPage:true});
  assert(errors.length===0,'browser runtime errors: '+errors.join(' | '));
  console.log('ADMIN_PAYMENTS_FINANCE_ALLOCATION_BROWSER_QA=PASS');
  console.log('PAYMENTS_PAGE_LOAD=PASS');console.log('DEAL_ALLOCATION_EXACT=PASS');console.log('SPLIT_ALLOCATION=PASS');console.log('UNALLOCATED_RESIDUE=PASS');console.log('OUTGOING_PAYMENTS_DISTINCT=PASS');console.log('FINANCE_REFRESH_PROPAGATION=PASS');console.log('HARD_REFRESH=PASS');console.log('NO_DUPLICATES=PASS');console.log('NO_RUNTIME_ERRORS=PASS');console.log(JSON.stringify({origin,syncCalls,errors}));
  await context.close();
}catch(e){console.error('ADMIN_PAYMENTS_FINANCE_ALLOCATION_BROWSER_QA=FAIL',e?.stack||e);if(errors.length)console.error(JSON.stringify({errors}));process.exitCode=1}finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}
