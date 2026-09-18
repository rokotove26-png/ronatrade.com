import http from 'node:http';
import { chromium } from 'playwright';
import { onRequest as cashUiRequest } from '../functions/portal/cash-r2-ui.js';

const cashScript=await (await cashUiRequest()).text();
const assert=(v,m)=>{if(!v)throw new Error(m)};
const op=(overrides)=>({
  operation_date:'2026-09-17',
  executed_at_local:'2026-09-17T12:00:00',
  account_identity:'QA',
  currency:'RUB',
  amount:0,
  gross_amount:0,
  reversed_amount:0,
  effective_external_payment_amount:0,
  effective_payment_status:'NOT_APPLICABLE',
  direction:'OUTGOING',
  operation_type:'EXTERNAL_PAYMENT',
  raw_operation_type:'EXTERNAL_PAYMENT',
  counterparty_resolution_status:'RESOLVED',
  source_counterparty:'QA RAW',
  bank_name:'ОАО "БАКАЙ БАНК"',
  bank_document_number:'QA',
  ...overrides
});

const operations=[
  op({currency:'KZT',amount:20000,gross_amount:20000,effective_external_payment_amount:20000,effective_payment_status:'SETTLED',canonical_counterparty_id:'BANK:BAKAI',canonical_counterparty_name:'ОАО «БАКАЙ БАНК»',bank_document_number:'BK-KZT-OK'}),
  op({currency:'KZT',amount:20000,gross_amount:20000,reversed_amount:20000,effective_external_payment_amount:0,effective_payment_status:'REVERSED',canonical_counterparty_id:'BANK:BAKAI',canonical_counterparty_name:'ОАО «БАКАЙ БАНК»',bank_document_number:'BK-KZT-REVERSED'}),
  ...Array.from({length:6},(_,i)=>op({currency:'RUB',amount:3000,gross_amount:3000,effective_external_payment_amount:3000,effective_payment_status:'SETTLED',canonical_counterparty_id:'BANK:BAKAI',canonical_counterparty_name:'ОАО «БАКАЙ БАНК»',bank_document_number:'BK-RUB-'+i})),
  ...Array.from({length:2},(_,i)=>op({currency:'RUB',amount:3000,gross_amount:3000,reversed_amount:3000,effective_external_payment_amount:0,effective_payment_status:'REVERSED',canonical_counterparty_id:'BANK:BAKAI',canonical_counterparty_name:'ОАО «БАКАЙ БАНК»',bank_document_number:'BK-RUB-REV-'+i})),
  op({currency:'KZT',amount:25444800,gross_amount:25444800,effective_external_payment_amount:25444800,effective_payment_status:'SETTLED',canonical_counterparty_id:'COUNTERPARTY:ORIENT_LOGISTIC',canonical_counterparty_name:'ТОО «Orient Logistic»',source_counterparty:'ТОО ORIENT LOGISTIC',bank_document_number:'ORIENT-OK'}),
  op({currency:'KZT',amount:25444800,gross_amount:25444800,reversed_amount:25444800,effective_external_payment_amount:0,effective_payment_status:'REVERSED',canonical_counterparty_id:'COUNTERPARTY:ORIENT_LOGISTIC',canonical_counterparty_name:'ТОО «Orient Logistic»',source_counterparty:'ТОО ORIENT LOGISTIC',bank_document_number:'ORIENT-REV'}),
  op({currency:'RUB',amount:5899358.9,gross_amount:5899358.9,effective_external_payment_amount:5899358.9,effective_payment_status:'SETTLED',canonical_counterparty_id:'COUNTERPARTY:SGTRANS',canonical_counterparty_name:'РУП «СГ-ТРАНС»',source_counterparty:'РУП СГ-ТРАНС',bank_document_number:'SG-OK'}),
  ...Array.from({length:2},(_,i)=>op({currency:'RUB',amount:5899358.9,gross_amount:5899358.9,reversed_amount:5899358.9,effective_external_payment_amount:0,effective_payment_status:'REVERSED',canonical_counterparty_id:'COUNTERPARTY:SGTRANS',canonical_counterparty_name:'РУП «СГ-ТРАНС»',source_counterparty:'РУП СГ-ТРАНС',bank_document_number:'SG-REV-'+i})),
  ...[7000000,7000000,7000000,7524960].map((amount,i)=>op({currency:'RUB',amount,gross_amount:amount,effective_external_payment_amount:amount,effective_payment_status:'SETTLED',canonical_counterparty_id:'SUPPLIER:S-009',canonical_counterparty_name:'ЧПТУП «КУЗМАШ»',source_counterparty:'ЧПТУП КУЗМАШ',bank_document_number:'KUZ-'+i})),
  op({currency:'USD',amount:125535,gross_amount:125535,effective_external_payment_amount:0,effective_payment_status:'NOT_APPLICABLE',direction:'INCOMING',operation_type:'EXTERNAL_INFLOW',raw_operation_type:'EXTERNAL_INFLOW',canonical_counterparty_id:'CLIENT:RONA-C003',canonical_counterparty_name:'Совместное предприятие Общество с ограниченной ответственностью «UNVERSAL SOLYARIS GRAND»',source_counterparty:'UNVERSAL SOLYARIS GRAND',bank_document_number:'UNV-1'}),
  op({currency:'USD',amount:125535,gross_amount:125535,effective_external_payment_amount:0,effective_payment_status:'NOT_APPLICABLE',direction:'INCOMING',operation_type:'EXTERNAL_INFLOW',raw_operation_type:'EXTERNAL_INFLOW',canonical_counterparty_id:'CLIENT:RONA-C003',canonical_counterparty_name:'Совместное предприятие Общество с ограниченной ответственностью «UNVERSAL SOLYARIS GRAND»',source_counterparty:'UNVERSAL SOLYARIS GRAND',bank_document_number:'UNV-2'}),
  op({operation_date:'2026-08-12',currency:'KZT',amount:20000,gross_amount:20000,reversed_amount:20000,direction:'INCOMING',operation_type:'REVERSAL',raw_operation_type:'REVERSAL',effective_payment_status:'NOT_APPLICABLE',reversal_pair_status:'MATCHED',canonical_counterparty_id:'BANK:BAKAI',canonical_counterparty_name:'ОАО «БАКАЙ БАНК»',bank_document_number:'2371992'}),
  op({operation_date:'2026-08-12',currency:'KZT',amount:25444800,gross_amount:25444800,reversed_amount:25444800,direction:'INCOMING',operation_type:'REVERSAL',raw_operation_type:'REVERSAL',effective_payment_status:'NOT_APPLICABLE',reversal_pair_status:'MATCHED',canonical_counterparty_id:'COUNTERPARTY:ORIENT_LOGISTIC',canonical_counterparty_name:'ТОО «Orient Logistic»',bank_document_number:'2371994'}),
  op({operation_date:'2026-08-13',currency:'RUB',amount:3000,gross_amount:3000,reversed_amount:3000,direction:'INCOMING',operation_type:'REVERSAL',raw_operation_type:'REVERSAL',effective_payment_status:'NOT_APPLICABLE',reversal_pair_status:'MATCHED',canonical_counterparty_id:'BANK:BAKAI',canonical_counterparty_name:'ОАО «БАКАЙ БАНК»',bank_document_number:'2270384'}),
  op({operation_date:'2026-08-13',currency:'RUB',amount:5899358.9,gross_amount:5899358.9,reversed_amount:5899358.9,direction:'INCOMING',operation_type:'REVERSAL',raw_operation_type:'REVERSAL',effective_payment_status:'NOT_APPLICABLE',reversal_pair_status:'MATCHED',canonical_counterparty_id:'COUNTERPARTY:SGTRANS',canonical_counterparty_name:'РУП «СГ-ТРАНС»',bank_document_number:'2270386'}),
  op({operation_date:'2026-08-14',currency:'RUB',amount:3000,gross_amount:3000,reversed_amount:3000,direction:'INCOMING',operation_type:'REVERSAL',raw_operation_type:'REVERSAL',effective_payment_status:'NOT_APPLICABLE',reversal_pair_status:'MATCHED',canonical_counterparty_id:'BANK:BAKAI',canonical_counterparty_name:'ОАО «БАКАЙ БАНК»',bank_document_number:'2026458'}),
  op({operation_date:'2026-08-14',currency:'RUB',amount:5899358.9,gross_amount:5899358.9,reversed_amount:5899358.9,direction:'INCOMING',operation_type:'REVERSAL',raw_operation_type:'REVERSAL',effective_payment_status:'NOT_APPLICABLE',reversal_pair_status:'MATCHED',canonical_counterparty_id:'COUNTERPARTY:SGTRANS',canonical_counterparty_name:'РУП «СГ-ТРАНС»',bank_document_number:'2026460'})
];

const payload={
  modelVersion:'FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE',
  effectivePaymentVersion:'FINANCE_EFFECTIVE_PAYMENT_V1',
  authoritativeSource:'AI-FINANCE/BANK_STATEMENT',
  period:{from:'2026-08-01',to:'2026-09-17'},
  controls:{source_lock:'PASS',max_daily_balance_difference:0,max_statement_checkpoint_difference:0,reversal_count:6,matched_reversal_count:6,unresolved_reversal_count:0},
  periodSummary:[
    {currency:'KZT',opening_balance:0,external_inflow:0,external_payment:50929600,gross_external_payment:50929600,matched_external_payment_reversal:25464800,effective_external_payment:25464800,effective_external_payment_operation_count:2,reversal_pair_unresolved_count:0,effective_payment_unresolved_count:0,closing_balance:.91,balance_check:0,max_daily_balance_difference:0},
    {currency:'RUB',opening_balance:0,external_inflow:10000000,external_payment:55031246.7,gross_external_payment:55031246.7,matched_external_payment_reversal:11804717.8,effective_external_payment:43226528.9,effective_external_payment_operation_count:13,reversal_pair_unresolved_count:0,effective_payment_unresolved_count:0,closing_balance:1756237.63,balance_check:0,max_daily_balance_difference:0},
    {currency:'USD',opening_balance:0,external_inflow:713220,external_payment:0,gross_external_payment:0,matched_external_payment_reversal:0,effective_external_payment:0,effective_external_payment_operation_count:0,reversal_pair_unresolved_count:0,effective_payment_unresolved_count:0,closing_balance:231557.04,balance_check:0,max_daily_balance_difference:0}
  ],
  operations,
  dailySummary:[],
  statementSummaries:[],
  checkpointAudit:[]
};

const html='<!doctype html><html><head><meta charset="utf-8"></head><body><nav id="nav"><button class="active" aria-current="page" data-page="accounting">Касса</button></nav><section id="page-accounting" class="page active"><div class="rona-owner-page-content" data-owner-page="accounting" data-rona-cash-host="r2"></div></section><script src="/portal/cash-r2-ui.js"></script></body></html>';
const server=http.createServer((req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/admin'){res.writeHead(200,{'content-type':'text/html'});return res.end(html)}
  if(u.pathname==='/portal/cash-r2-ui.js'){res.writeHead(200,{'content-type':'application/javascript'});return res.end(cashScript)}
  if(u.pathname==='/portal/owner-api'&&u.searchParams.get('path')==='/admin/cash-source'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,data:payload}))}
  res.writeHead(404);res.end('not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;

let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_CASH_R2_STATE__?.status==='READY');

  const proof=await page.evaluate(()=>{
    const norm=s=>(s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    const section=title=>[...document.querySelectorAll('.rona-cash-section')].find(x=>norm(x.querySelector('h3')?.textContent)===title);
    const rows=title=>[...(section(title)?.querySelectorAll('tbody tr')||[])].map(tr=>[...tr.children].map(td=>norm(td.textContent)));
    const kpi=title=>[...document.querySelectorAll('.rona-cash-kpi')].find(x=>norm(x.querySelector('h2')?.textContent)===title);
    return{
      payments:rows('Оплаты контрагентам'),
      inflows:rows('Внешние поступления'),
      reversals:rows('Сторно / возвраты'),
      paid: norm(kpi('Оплачено')?.textContent),
      state:window.__RONA_CASH_R2_STATE__,
      errors:[]
    };
  });

  const find=(rows,needle)=>rows.filter(r=>r.join(' ').includes(needle));
  assert(proof.state.status==='READY','Cash not READY');
  assert(proof.payments.length===4,'effective payment entity rows='+proof.payments.length);
  const bakai=find(proof.payments,'БАКАЙ');
  assert(bakai.length===1,'BAKAI must be one row');
  assert(bakai[0].join(' ').includes('20 000 KZT'),'BAKAI KZT subtotal missing');
  assert(bakai[0].join(' ').includes('18 000 RUB'),'BAKAI RUB subtotal missing');
  assert(bakai[0][2]==='7','BAKAI effective operation count mismatch '+bakai[0][2]);

  const orient=find(proof.payments,'Orient Logistic');
  assert(orient.length===1&&orient[0].join(' ').includes('25 444 800 KZT')&&orient[0][2]==='1','ORIENT effective row mismatch');
  assert(!orient[0].join(' ').includes('50 889 600'),'ORIENT gross leaked into effective row');

  const sg=find(proof.payments,'СГ-ТРАНС');
  assert(sg.length===1&&sg[0].join(' ').includes('5 899 358,9 RUB')&&sg[0][2]==='1','SG-TRANS effective row mismatch');
  assert(!sg[0].join(' ').includes('17 698 076'),'SG-TRANS gross leaked into effective row');

  const kuzmash=find(proof.payments,'КУЗМАШ');
  assert(kuzmash.length===1&&kuzmash[0].join(' ').includes('28 524 960 RUB')&&kuzmash[0][2]==='4','KUZMASH row mismatch');

  const unversal=find(proof.inflows,'UNVERSAL SOLYARIS GRAND');
  assert(unversal.length===1&&unversal[0].join(' ').includes('251 070 USD')&&unversal[0][2]==='2','UNVERSAL row mismatch');

  assert(proof.reversals.length===6,'raw reversal row count '+proof.reversals.length);
  for(const doc of ['2371992','2371994','2270384','2270386','2026458','2026460'])assert(proof.reversals.some(r=>r.join(' ').includes(doc)),'missing reversal '+doc);
  assert(proof.paid.includes('25 464 800 KZT'),'effective KZT KPI missing');
  assert(proof.paid.includes('43 226 528,9 RUB'),'effective RUB KPI missing');
  assert(errors.length===0,'browser errors '+errors.join(' | '));

  console.log('ISSUE629_ONE_ENTITY_MULTI_CURRENCY=PASS');
  console.log('ISSUE629_EFFECTIVE_PAYMENT_PRESENTATION=PASS');
  console.log('ISSUE629_RAW_REVERSAL_AUDIT=PASS');
  console.log(JSON.stringify(proof));
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
