import { patchAdminOperationsCommandCenterV4, OPERATIONS_COMMAND_CENTER_VERSION } from './admin-operations-command-center-v4.js';
import c0 from './owner-ui-chunks/chunk0.js';
import c1 from './owner-ui-chunks/chunk1.js';
import c2 from './owner-ui-chunks/chunk2.js';
import c3 from './owner-ui-chunks/chunk3.js';
import c4 from './owner-ui-chunks/chunk4.js';
import c5 from './owner-ui-chunks/chunk5.js';
import c6 from './owner-ui-chunks/chunk6.js';
import c7 from './owner-ui-chunks/chunk7.js';
import c8 from './owner-ui-chunks/chunk8.js';
import c9 from './owner-ui-chunks/chunk9.js';
import c10 from './owner-ui-chunks/chunk10.js';
import c11 from './owner-ui-chunks/chunk11.js';
import c12 from './owner-ui-chunks/chunk12.js';
import c13 from './owner-ui-chunks/chunk13.js';
import c14 from './owner-ui-chunks/chunk14.js';
import c15 from './owner-ui-chunks/chunk15.js';
import c16 from './owner-ui-chunks/chunk16.js';

const BUILD='owner-main-v2-20260824-0150';
const RAW=[
  "window.__RONA_MAIN_UI_ENTRY__=true;window.__RONA_UI_BUILD__="+JSON.stringify(BUILD)+";",
  c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,
  "window.__RONA_MAIN_UI_RUNTIME_LOADED__=true;"
].join('');

const DEALS_SHELL="function isolateDealsShell(p){if(!p)return null;let host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',p)||q(':scope > .rona-owner-page-content',p);for(const child of Array.from(p.children)){if(child===host)continue;child.classList.add('rona-owner-original-hidden');child.setAttribute('aria-hidden','true');child.style.setProperty('display','none','important')}if(host){host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display')}return host}function renderDealsCurrentShell(){const p=page('deals');if(!p)return;const ready=window.__RONA_DEALS_CURRENT_STATE__||document.documentElement.classList.contains('rona-deals-current-ready');if(!ready&&!q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',p))replacePage('deals',card('Сделки',e('div',{class:'rona-owner-muted',text:'Загрузка актуальных данных…'})));isolateDealsShell(p)}\n";

const PAYMENTS_RUNTIME=String.raw`
window.__RONA_ADMIN_PAYMENTS_FINANCE_PROJECTION_V1__='20260912-v1';
function isolatePaymentsPage(){const p=page('payments');if(!p)return;let host=q(':scope > .rona-owner-page-content[data-owner-page="payments"]',p)||q(':scope > .rona-owner-page-content',p);for(const child of Array.from(p.children)){if(child===host)continue;child.classList.add('rona-owner-original-hidden');child.setAttribute('aria-hidden','true');child.style.setProperty('display','none','important')}if(host){host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display');host.dataset.ownerPage='payments';host.dataset.ronaPaymentsOwner='finance-authoritative-allocation-v1'}}
function canonicalFinanceArray(v){return Array.isArray(v)?v:[]}
function financePaymentKey(v){return String(v?.payment_id||'')+'\u0000'+String(v?.currency||'')}
function paymentAllocationRows(f,p){const key=financePaymentKey(p);return canonicalFinanceArray(f?.incomingPaymentAllocations).filter(a=>financePaymentKey(a)===key&&String(a.allocation_status||'').toUpperCase()==='VERIFIED')}
function paymentAllocationSummary(f,p){const key=financePaymentKey(p);return canonicalFinanceArray(f?.paymentAllocationSummaries).find(x=>financePaymentKey(x)===key)||null}
function incomingAllocationCell(f,p){const rows=paymentAllocationRows(f,p).filter(x=>x.deal_id);if(!rows.length)return financePill('Нераспределено','neutral');const box=e('div',{class:'rona-fin-allocation-list'});for(const x of rows)box.append(e('div',{class:'rona-fin-allocation-line'},e('strong',{text:String(x.deal_id)}),e('span',{text:' — '+money(x.allocated_amount,x.currency)})));return box}
function unallocatedCell(f,p){const s=paymentAllocationSummary(f,p);if(!s)return financePill('Требует верификации','warn');const status=String(s.allocation_projection_status||'').toUpperCase();if(status==='TO_VERIFY')return financePill('Требует верификации','warn');const n=Number(s.unallocated_amount);if(!Number.isFinite(n)||n<0)return financePill('Требует верификации','warn');if(n===0)return financePill('Распределено полностью','success');return e('div',{},financePill('Нераспределено','warn'),e('div',{class:'rona-owner-muted',text:money(n,s.currency||p.currency)}))}
function dealIncomingAllocationCell(f,s){const dealId=String(s?.deal_id||''),rows=canonicalFinanceArray(f?.dealAllocationTotals).filter(x=>String(x.deal_id||'')===dealId);if(!rows.length){const received=Number(s?.received_amount);if(Number.isFinite(received)&&received===0)return financePill('Поступлений нет','neutral');return financePill('Нераспределено / требует верификации','warn')}const box=e('div',{},financePill('Распределено по сделке','success'));for(const x of rows)box.append(e('div',{class:'rona-owner-muted',text:money(x.allocated_amount,x.currency)}));return box}
function financeSearchMatch(values){const needle=String(financeSearchText||'').trim().toLowerCase();if(!needle)return true;return values.some(v=>String(v??'').toLowerCase().includes(needle))}
let financeFlowFilter='RECEIVED',financeSearchText='';
function renderPayments(){
  isolatePaymentsPage();
  const f=financeFragment();
  if(!f){replacePage('payments',card('Платежи и взаиморасчёты',e('div',{class:'rona-owner-muted',text:'Синхронизация с финансовым контуром…'})));return}
  const totals=canonicalFinanceArray(f.paymentTotalsByCurrency),outs=canonicalFinanceArray(f.outgoingPayments),sums=canonicalFinanceArray(f.dealFinanceSummaries);
  const dealStateRows=canonicalFinanceArray(window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__?.deals).length?canonicalFinanceArray(window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__?.deals):canonicalFinanceArray(adminData?.deals),dealStateById=new Map(dealStateRows.map(x=>[String(x.deal_id),x]));
  const dueStatus=s=>String(dealStateById.get(String(s?.deal_id||''))?.finance_status||'').toUpperCase();
  const isLive=s=>{const d=dealStateById.get(String(s?.deal_id||''));if(!d)return true;const b=String(d.business_status||'').toUpperCase(),l=String(d.lifecycle_state||'').toUpperCase();return !['CANCELLED','CANCELED','ARCHIVED','CLOSED','VOID','TERMINATED'].includes(b)&&!['ARCHIVED','CLOSED','SUPERSEDED'].includes(l)};
  const currentExpected=s=>isLive(s)&&Number(s?.client_remaining_amount)>0&&['DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT'].includes(dueStatus(s)),deferredExpected=s=>isLive(s)&&Number(s?.client_remaining_amount)>0&&dueStatus(s)==='NOT_DUE';
  const currentExpectedTotals=totalsByCurrency(sums,'client_remaining_amount',currentExpected),deferredExpectedTotals=totalsByCurrency(sums,'client_remaining_amount',deferredExpected),outgoingTotals=totalsByCurrency(outs,'amount',x=>String(x.deal_allocation_status||'').toUpperCase()==='CONFIRMED');
  const grid=e('div',{class:'rona-owner-grid rona-fin-kpi-grid'});grid.append(financeKpiCard('Подтверждено поступлений','received',totals),financeKpiCard('Ожидается поступлений — текущий период','expected',currentExpectedTotals),financeKpiCard('Ожидается поступлений — отложенный период','expected',deferredExpectedTotals),financeKpiCard('Оплачено в рамках сделок','paid',outgoingTotals));
  const head=e('div',{},grid);if(!f.obligationPlanAvailable)head.append(card('Взаиморасчёты',e('div',{class:'rona-owner-muted',text:'Подтверждённая сумма обязательства пока не сформирована.'})));
  const filter=e('div',{class:'rona-fin-filter'});[['RECEIVED','Поступило','is-received'],['PAID','Оплачено','is-paid'],['EXPECTED','Ожидается','is-expected']].forEach(([v,t,cls])=>filter.append(e('button',{type:'button',class:cls,'aria-pressed':String(financeFlowFilter===v),text:t,onclick:()=>{financeFlowFilter=v;renderPayments()}})));filter.append(e('input',{type:'search',placeholder:'Поиск по платежам и сделкам',value:financeSearchText,'aria-label':'Поиск по платежам и сделкам',oninput:ev=>{financeSearchText=String(ev.target.value||'');renderPayments()}}));
  const visibleSums=sums.filter(s=>financeSearchMatch([s.deal_id,s.client_id,s.client_name,s.currency,s.finance_status,s.accounting_status]));
  let summary=null;if(visibleSums.length)summary=card('Финансовая картина по сделкам',tbl(['Deal ID','Клиент','Получено','Обязательство клиента','Остаток клиента к оплате','Оплачено в рамках сделки','Распределение поступлений','Finance','Accounting'],visibleSums.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',money(s.received_amount,s.currency),s.obligation_amount===null||s.obligation_amount===undefined?'—':money(s.obligation_amount,s.currency),s.client_remaining_amount===null||s.client_remaining_amount===undefined?'—':money(s.client_remaining_amount,s.currency),dealOutgoingText(String(s.deal_id||''),outs),dealIncomingAllocationCell(f,s),financeStatusCell(s.finance_status),accountingStatusCell(s.accounting_status)])));
  const xs=canonicalFinanceArray(f.incomingPayments).filter(x=>financeSearchMatch([x.payment_id,x.payer_name,x.original_payment_purpose,x.bank_transaction_reference,x.currency]));
  const incomingBody=xs.length?tbl(['Дата','Плательщик','PAYMENT ID','Сумма поступления','Валюта','Назначение / банковский документ','Банковский факт','Распределение по сделкам','Нераспределено','Finance','Accounting'],xs.map(x=>[date(x.payment_at),x.payer_name||'—',x.payment_id||'—',money(x.amount,x.currency),x.currency||'—',e('div',{},e('div',{text:x.original_payment_purpose||'—'}),x.bank_transaction_reference?e('div',{class:'rona-owner-muted',text:x.bank_transaction_reference}):null),bankStatusCell(x.bank_fact_status),incomingAllocationCell(f,x),unallocatedCell(f,x),financeStatusCell(x.finance_status),accountingStatusCell(x.accounting_closure_status)])):e('div',{class:'rona-owner-muted',text:financeSearchText?'По запросу ничего не найдено.':'Подтверждённых банковских поступлений пока нет.'});
  const incoming=card('Поступило от клиентов',incomingBody);
  const visibleOuts=outs.filter(x=>financeSearchMatch([x.fact_id,x.beneficiary_name,x.beneficiary_role,x.purpose,x.bank_document,x.currency,...canonicalFinanceArray(x.deal_ids)]));
  const outgoing=visibleOuts.length?card('Оплачено в рамках сделок',tbl(['Дата','Deal ID / область','Получатель','Роль','Сумма','Назначение / банковский документ','Банковский факт','Привязка к сделке'],visibleOuts.map(x=>[date(x.payment_at),canonicalFinanceArray(x.deal_ids).join(' / ')||'—',x.beneficiary_name||'—',x.beneficiary_role||'—',money(x.amount,x.currency),e('div',{},e('div',{text:x.purpose||'—'}),x.bank_document?e('div',{class:'rona-owner-muted',text:x.bank_document}):null),bankStatusCell(x.bank_fact_status),allocationStatusCell(x.deal_allocation_status)]))):card('Оплачено в рамках сделок',e('div',{class:'rona-owner-muted',text:financeSearchText?'По запросу ничего не найдено.':'Подтверждённых исходящих платежей по сделкам пока нет.'}));
  const currentExp=visibleSums.filter(currentExpected),deferredExp=visibleSums.filter(deferredExpected),expectedCurrent=currentExp.length?card('Ожидается поступлений — текущий период',tbl(['Deal ID','Клиент','Обязательство','Поступило','Ожидается сейчас','Состояние оплаты','Accounting'],currentExp.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',s.obligation_amount===null||s.obligation_amount===undefined?'—':money(s.obligation_amount,s.currency),money(s.received_amount,s.currency),money(s.client_remaining_amount,s.currency),financeStatusCell(s.finance_status),accountingStatusCell(s.accounting_status)]))):card('Ожидается поступлений — текущий период',e('div',{class:'rona-owner-muted',text:financeSearchText?'По запросу ничего не найдено.':'Платежей, срок которых наступил в текущем периоде, нет.'})),expectedDeferred=deferredExp.length?card('Ожидается поступлений — отложенный период',tbl(['Deal ID','Клиент','Обязательство','Поступило','К оплате позднее','Состояние оплаты','Период'],deferredExp.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',s.obligation_amount===null||s.obligation_amount===undefined?'—':money(s.obligation_amount,s.currency),money(s.received_amount,s.currency),money(s.client_remaining_amount,s.currency),financeStatusCell(s.finance_status),financePill('Срок не наступил','info')]))):card('Ожидается поступлений — отложенный период',e('div',{class:'rona-owner-muted',text:financeSearchText?'По запросу ничего не найдено.':'Отложенных платежей по условиям действующих сделок нет.'})),expected=e('div',{},expectedCurrent,expectedDeferred);
  const detail=financeFlowFilter==='PAID'?outgoing:financeFlowFilter==='EXPECTED'?expected:incoming;replacePage('payments',e('div',{},head,filter,summary,detail));isolatePaymentsPage();window.__RONA_PAYMENTS_CURRENT_STATE__={generatedAt:window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.generatedAt||null,current:currentExpectedTotals,deferred:deferredExpectedTotals,paymentProjectionContract:f.paymentProjectionContract||null};
}
`;

function patchPayments(script){
  const replacements=[
    [".rona-fin-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}",".rona-fin-kpi-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}#page-payments{width:100%!important;max-width:none!important}#page-payments>.rona-owner-page-content,#page-payments .rona-owner-page-content[data-owner-page=\"payments\"]{width:100%!important;max-width:none!important;margin-left:0!important;margin-right:0!important}#page-payments .rona-owner-card{box-sizing:border-box}#page-payments .rona-owner-table{min-width:1180px}#page-payments .rona-owner-table th,#page-payments .rona-owner-table td{padding-left:12px;padding-right:12px}#page-payments .rona-fin-filter input[type=\"search\"]{min-width:260px;max-width:420px}"],
    ["function allocationStatusRu(v){const m={CONFIRMED:'Привязка подтверждена',TO_VERIFY:'Распределение между сделками требует подтверждения',NOT_DEAL:'Не относится к сделке'};return m[String(v||'').toUpperCase()]||String(v||'—')}","function allocationStatusRu(v){const m={CONFIRMED:'Привязка подтверждена',TO_VERIFY:'Учтено без распределения по сделкам',NOT_DEAL:'Не относится к сделке'};return m[String(v||'').toUpperCase()]||String(v||'—')}"],
    ["function financeStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='PAID'?'success':(k==='PARTIALLY_PAID'||k==='PARTIAL'||k==='DUE'||k==='NOT_DUE')?'warn':(k==='OVERDUE'||k==='DISPUTED')?'danger':'neutral';return financePill(financeStatusRu(v),tone)}","function financeStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='PAID'?'success':(k==='PARTIALLY_PAID'||k==='PARTIAL'||k==='NOT_DUE')?'info':k==='DUE'?'warn':(k==='OVERDUE'||k==='DISPUTED')?'danger':'neutral';return financePill(financeStatusRu(v),tone)}"],
    ["function allocationStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='CONFIRMED'?'success':k==='TO_VERIFY'?'warn':k==='NOT_DEAL'?'neutral':'neutral';return financePill(allocationStatusRu(v),tone)}","function allocationStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='CONFIRMED'?'success':k==='TO_VERIFY'?'warn':'neutral';return financePill(allocationStatusRu(v),tone)}"],
    ["if(rel.some(x=>String(x.deal_allocation_status||'').toUpperCase()==='TO_VERIFY'))parts.push('Есть платеж без подтверждённого распределения')","if(rel.some(x=>String(x.deal_allocation_status||'').toUpperCase()==='TO_VERIFY'))parts.push('Платёж учтён агрегированно, без распределения по сделкам')"]
  ];
  for(const [from,to] of replacements){if(!script.includes(from))throw new Error('PAYMENTS_PATCH_SOURCE_MISMATCH');script=script.replace(from,to)}
  const start=script.indexOf("let financeFlowFilter='RECEIVED';\nfunction renderPayments(){");
  const end=script.indexOf('\nfunction renderCash(){',start);
  if(start<0||end<0)throw new Error('PAYMENTS_RENDER_SOURCE_MISMATCH');
  return script.slice(0,start)+PAYMENTS_RUNTIME+script.slice(end);
}

const SCRIPT=patchAdminOperationsCommandCenterV4(patchPayments(RAW
  .replace('function renderOwnedAdminPage(id){',DEALS_SHELL+'function renderOwnedAdminPage(id){')
  .replace('deals:renderDeals,','deals:renderDealsCurrentShell,')
  .replace('renderAdminHome();renderPrices();renderApplications();renderDeals();renderDocuments();','renderAdminHome();renderPrices();renderApplications();renderDealsCurrentShell();renderDocuments();')));

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-ui':'main-v2',
    'x-rona-ui-build':BUILD,
    'x-rona-operations-center':OPERATIONS_COMMAND_CENTER_VERSION,
    'x-rona-deals-owner':'current-only-v1.5',
    'x-rona-payments-ui':'finance-authoritative-allocation-v1',
    'x-rona-payments-handoff':'finance-authoritative-v1'
  }});
}
