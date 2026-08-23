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

const BUILD='owner-main-v2-20260824-0136';
const RAW=[
  "window.__RONA_MAIN_UI_ENTRY__=true;window.__RONA_UI_BUILD__="+JSON.stringify(BUILD)+";",
  c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,
  "window.__RONA_MAIN_UI_RUNTIME_LOADED__=true;"
].join('');

const DEALS_SHELL="function isolateDealsShell(p){if(!p)return null;let host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',p)||q(':scope > .rona-owner-page-content',p);for(const child of Array.from(p.children)){if(child===host)continue;child.classList.add('rona-owner-original-hidden');child.setAttribute('aria-hidden','true');child.style.setProperty('display','none','important')}if(host){host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display')}return host}function renderDealsCurrentShell(){const p=page('deals');if(!p)return;const ready=window.__RONA_DEALS_CURRENT_STATE__||document.documentElement.classList.contains('rona-deals-current-ready');if(!ready&&!q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',p))replacePage('deals',card('Сделки',e('div',{class:'rona-owner-muted',text:'Загрузка актуальных данных…'})));isolateDealsShell(p)}\n";

function patchPayments(script){
  const replacements=[
    [
      ".rona-fin-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}",
      ".rona-fin-kpi-grid{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}"
    ],
    [
      "function allocationStatusRu(v){const m={CONFIRMED:'Привязка подтверждена',TO_VERIFY:'Распределение между сделками требует подтверждения',NOT_DEAL:'Не относится к сделке'};return m[String(v||'').toUpperCase()]||String(v||'—')}",
      "function allocationStatusRu(v){const m={CONFIRMED:'Привязка подтверждена',TO_VERIFY:'Учтено без распределения по сделкам',NOT_DEAL:'Не относится к сделке'};return m[String(v||'').toUpperCase()]||String(v||'—')}"
    ],
    [
      "function financeStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='PAID'?'success':(k==='PARTIALLY_PAID'||k==='PARTIAL'||k==='DUE'||k==='NOT_DUE')?'warn':(k==='OVERDUE'||k==='DISPUTED')?'danger':'neutral';return financePill(financeStatusRu(v),tone)}",
      "function financeStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='PAID'?'success':(k==='PARTIALLY_PAID'||k==='PARTIAL'||k==='NOT_DUE')?'info':k==='DUE'?'warn':(k==='OVERDUE'||k==='DISPUTED')?'danger':'neutral';return financePill(financeStatusRu(v),tone)}"
    ],
    [
      "function allocationStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='CONFIRMED'?'success':k==='TO_VERIFY'?'warn':k==='NOT_DEAL'?'neutral':'neutral';return financePill(allocationStatusRu(v),tone)}",
      "function allocationStatusCell(v){const k=String(v||'').toUpperCase(),tone=k==='CONFIRMED'?'success':'neutral';return financePill(allocationStatusRu(v),tone)}"
    ],
    [
      "if(rel.some(x=>String(x.deal_allocation_status||'').toUpperCase()==='TO_VERIFY'))parts.push('Есть платеж без подтверждённого распределения')",
      "if(rel.some(x=>String(x.deal_allocation_status||'').toUpperCase()==='TO_VERIFY'))parts.push('Платёж учтён агрегированно, без распределения по сделкам')"
    ],
    [
      "function cashResidualCell(s){if(s&&String(s.cash_residual_status||'').toUpperCase()==='CONFIRMED'&&s.cash_residual_amount!==null&&s.cash_residual_amount!==undefined)return financePill(money(s.cash_residual_amount,s.cash_residual_currency||s.currency),'success');return e('div',{},financePill('Требует подтверждения','warn'),s?.cash_residual_note?e('div',{class:'rona-owner-muted',text:s.cash_residual_note}):null)}",
      "function cashResidualCell(s){if(s&&String(s.cash_residual_status||'').toUpperCase()==='CONFIRMED'&&s.cash_residual_amount!==null&&s.cash_residual_amount!==undefined)return financePill(money(s.cash_residual_amount,s.cash_residual_currency||s.currency),'success');return e('div',{},financePill('Не распределено по сделке','neutral'),e('div',{class:'rona-owner-muted',text:'Внутрисделочный остаток не используется как факт оплаты клиента.'}))}"
    ],
    [
      "let financeFlowFilter='RECEIVED';\nfunction renderPayments(){const f=financeFragment();",
      "function isolatePaymentsPage(){const p=page('payments');if(!p)return;let host=q(':scope > .rona-owner-page-content[data-owner-page=\\\"payments\\\"]',p)||q(':scope > .rona-owner-page-content',p);for(const child of Array.from(p.children)){if(child===host)continue;child.classList.add('rona-owner-original-hidden');child.setAttribute('aria-hidden','true');child.style.setProperty('display','none','important')}if(host){host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display');host.dataset.ownerPage='payments';host.dataset.ronaPaymentsOwner='finance-current-v1'}}\nlet financeFlowFilter='RECEIVED';\nfunction renderPayments(){isolatePaymentsPage();const f=financeFragment();"
    ],
    [
      "const totals=Array.isArray(f.paymentTotalsByCurrency)?f.paymentTotalsByCurrency:[],outs=Array.isArray(f.outgoingPayments)?f.outgoingPayments:[],sums=Array.isArray(f.dealFinanceSummaries)?f.dealFinanceSummaries:[],sumByDeal=new Map(sums.map(x=>[String(x.deal_id),x])),expectedTotals=totalsByCurrency(sums,'client_remaining_amount',x=>Number(x.client_remaining_amount)>0),outgoingTotals=totalsByCurrency(outs,'amount',x=>String(x.deal_allocation_status||'').toUpperCase()!=='NOT_DEAL'),grid=e('div',{class:'rona-owner-grid rona-fin-kpi-grid'});",
      "const totals=Array.isArray(f.paymentTotalsByCurrency)?f.paymentTotalsByCurrency:[],outs=Array.isArray(f.outgoingPayments)?f.outgoingPayments:[],sums=Array.isArray(f.dealFinanceSummaries)?f.dealFinanceSummaries:[],sumByDeal=new Map(sums.map(x=>[String(x.deal_id),x])),dealStateById=new Map((Array.isArray(adminData?.deals)?adminData.deals:[]).map(x=>[String(x.deal_id),x])),dueStatus=s=>String(dealStateById.get(String(s?.deal_id||''))?.finance_status||'').toUpperCase(),isLive=s=>{const d=dealStateById.get(String(s?.deal_id||''));if(!d)return true;const b=String(d.business_status||'').toUpperCase(),l=String(d.lifecycle_state||'').toUpperCase();return !['CANCELLED','CANCELED','ARCHIVED','CLOSED','VOID','TERMINATED'].includes(b)&&!['ARCHIVED','CLOSED','SUPERSEDED'].includes(l)},currentExpected=s=>isLive(s)&&Number(s?.client_remaining_amount)>0&&['DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT'].includes(dueStatus(s)),deferredExpected=s=>isLive(s)&&Number(s?.client_remaining_amount)>0&&dueStatus(s)==='NOT_DUE',currentExpectedTotals=totalsByCurrency(sums,'client_remaining_amount',currentExpected),deferredExpectedTotals=totalsByCurrency(sums,'client_remaining_amount',deferredExpected),outgoingTotals=totalsByCurrency(outs,'amount',x=>String(x.deal_allocation_status||'').toUpperCase()!=='NOT_DEAL'),grid=e('div',{class:'rona-owner-grid rona-fin-kpi-grid'});"
    ],
    [
      "grid.append(financeKpiCard('Подтверждено поступлений','received',totals),financeKpiCard('Ожидается поступлений','expected',expectedTotals),financeKpiCard('Оплачено в рамках сделок','paid',outgoingTotals));",
      "grid.append(financeKpiCard('Подтверждено поступлений','received',totals),financeKpiCard('Ожидается поступлений — текущий период','expected',currentExpectedTotals),financeKpiCard('Ожидается поступлений — отложенный период','expected',deferredExpectedTotals),financeKpiCard('Оплачено в рамках сделок','paid',outgoingTotals));"
    ],
    [
      "const exp=sums.filter(s=>Number(s.client_remaining_amount)>0);const expected=exp.length?card('Ожидается поступлений',tbl(['Deal ID','Клиент','Обязательство','Поступило','Ожидается','Finance','Accounting'],exp.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',s.obligation_amount===null||s.obligation_amount===undefined?'Не сформировано':money(s.obligation_amount,s.currency),money(s.received_amount,s.currency),money(s.client_remaining_amount,s.currency),financeStatusCell(s.finance_status),accountingStatusCell(s.accounting_status)]))):card('Ожидается поступлений',e('div',{class:'rona-owner-muted',text:'Подтверждённых ожидаемых поступлений по действующим сделкам нет.'}));",
      "const currentExp=sums.filter(currentExpected),deferredExp=sums.filter(deferredExpected),expectedCurrent=currentExp.length?card('Ожидается поступлений — текущий период',tbl(['Deal ID','Клиент','Обязательство','Поступило','Ожидается сейчас','Состояние оплаты','Accounting'],currentExp.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',s.obligation_amount===null||s.obligation_amount===undefined?'Не сформировано':money(s.obligation_amount,s.currency),money(s.received_amount,s.currency),money(s.client_remaining_amount,s.currency),financeStatusCell(s.finance_status),accountingStatusCell(s.accounting_status)]))):card('Ожидается поступлений — текущий период',e('div',{class:'rona-owner-muted',text:'Платежей, срок которых наступил в текущем периоде, нет.'})),expectedDeferred=deferredExp.length?card('Ожидается поступлений — отложенный период',tbl(['Deal ID','Клиент','Обязательство','Поступило','К оплате позднее','Состояние оплаты','Период'],deferredExp.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',s.obligation_amount===null||s.obligation_amount===undefined?'Не сформировано':money(s.obligation_amount,s.currency),money(s.received_amount,s.currency),money(s.client_remaining_amount,s.currency),financeStatusCell(s.finance_status),financePill('Срок не наступил','info')]))):card('Ожидается поступлений — отложенный период',e('div',{class:'rona-owner-muted',text:'Отложенных платежей по условиям действующих сделок нет.'})),expected=e('div',{},expectedCurrent,expectedDeferred);"
    ],
    [
      "replacePage('payments',e('div',{},head,filter,summary,detail))}",
      "replacePage('payments',e('div',{},head,filter,summary,detail));isolatePaymentsPage();window.__RONA_PAYMENTS_CURRENT_STATE__={generatedAt:window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.generatedAt||null,current:currentExpectedTotals,deferred:deferredExpectedTotals}}"
    ]
  ];
  for(const [from,to] of replacements){if(!script.includes(from))throw new Error('PAYMENTS_PATCH_SOURCE_MISMATCH');script=script.replace(from,to)}
  return script;
}

const SCRIPT=patchPayments(RAW
  .replace('function renderOwnedAdminPage(id){',DEALS_SHELL+'function renderOwnedAdminPage(id){')
  .replace('deals:renderDeals,','deals:renderDealsCurrentShell,')
  .replace('renderAdminHome();renderPrices();renderApplications();renderDeals();renderDocuments();','renderAdminHome();renderPrices();renderApplications();renderDealsCurrentShell();renderDocuments();'));

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-ui':'main-v2',
    'x-rona-ui-build':BUILD,
    'x-rona-deals-owner':'current-only-v1.4',
    'x-rona-payments-ui':'finance-current-v1'
  }});
}
