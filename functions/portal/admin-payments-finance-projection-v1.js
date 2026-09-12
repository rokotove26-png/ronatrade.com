const ADMIN_PAYMENTS_FINANCE_PROJECTION_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_PAYMENTS_FINANCE_PROJECTION_V1__)return;
window.__RONA_ADMIN_PAYMENTS_FINANCE_PROJECTION_V1__='20260912-v1';

function canonicalArray(v){return Array.isArray(v)?v:[]}
function paymentKey(v){return String(v?.payment_id||'')+'\u0000'+String(v?.currency||'')}
function paymentAllocationRows(f,p){
  const key=paymentKey(p);
  return canonicalArray(f?.incomingPaymentAllocations).filter(a=>paymentKey(a)===key&&String(a.allocation_status||'').toUpperCase()==='VERIFIED');
}
function paymentAllocationSummary(f,p){
  const key=paymentKey(p);
  return canonicalArray(f?.paymentAllocationSummaries).find(x=>paymentKey(x)===key)||null;
}
function incomingAllocationCell(f,p){
  const rows=paymentAllocationRows(f,p).filter(x=>x.deal_id);
  if(!rows.length)return financePill('Нераспределено','neutral');
  const box=e('div',{class:'rona-fin-allocation-list'});
  for(const x of rows){
    box.append(e('div',{class:'rona-fin-allocation-line'},e('strong',{text:String(x.deal_id)}),e('span',{text:' — '+money(x.allocated_amount,x.currency)})));
  }
  return box;
}
function unallocatedCell(f,p){
  const s=paymentAllocationSummary(f,p);
  if(!s)return financePill('Требует верификации','warn');
  const status=String(s.allocation_projection_status||'').toUpperCase();
  if(status==='TO_VERIFY')return financePill('Требует верификации','warn');
  const n=Number(s.unallocated_amount);
  if(!Number.isFinite(n)||n<0)return financePill('Требует верификации','warn');
  if(n===0)return financePill('Распределено полностью','success');
  return e('div',{},financePill('Нераспределено','warn'),e('div',{class:'rona-owner-muted',text:money(n,s.currency||p.currency)}));
}
function dealIncomingAllocationCell(f,s){
  const dealId=String(s?.deal_id||'');
  const rows=canonicalArray(f?.dealAllocationTotals).filter(x=>String(x.deal_id||'')===dealId);
  if(!rows.length){
    const received=Number(s?.received_amount);
    if(Number.isFinite(received)&&received===0)return financePill('Поступлений нет','neutral');
    return financePill('Нераспределено / требует верификации','warn');
  }
  const box=e('div',{},financePill('Распределено по сделке','success'));
  for(const x of rows)box.append(e('div',{class:'rona-owner-muted',text:money(x.allocated_amount,x.currency)}));
  return box;
}
function renderPaymentsFinanceAuthorityV1(){
  isolatePaymentsPage();
  const f=financeFragment();
  if(!f){replacePage('payments',card('Платежи и взаиморасчёты',e('div',{class:'rona-owner-muted',text:'Синхронизация с финансовым контуром…'})));return}

  const totals=canonicalArray(f.paymentTotalsByCurrency),outs=canonicalArray(f.outgoingPayments),sums=canonicalArray(f.dealFinanceSummaries),sumByDeal=new Map(sums.map(x=>[String(x.deal_id),x]));
  const dealStateRows=canonicalArray(window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__?.deals).length?canonicalArray(window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__?.deals):canonicalArray(adminData?.deals),dealStateById=new Map(dealStateRows.map(x=>[String(x.deal_id),x]));
  const dueStatus=s=>String(dealStateById.get(String(s?.deal_id||''))?.finance_status||'').toUpperCase();
  const isLive=s=>{const d=dealStateById.get(String(s?.deal_id||''));if(!d)return true;const b=String(d.business_status||'').toUpperCase(),l=String(d.lifecycle_state||'').toUpperCase();return !['CANCELLED','CANCELED','ARCHIVED','CLOSED','VOID','TERMINATED'].includes(b)&&!['ARCHIVED','CLOSED','SUPERSEDED'].includes(l)};
  const currentExpected=s=>isLive(s)&&Number(s?.client_remaining_amount)>0&&['DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT'].includes(dueStatus(s));
  const deferredExpected=s=>isLive(s)&&Number(s?.client_remaining_amount)>0&&dueStatus(s)==='NOT_DUE';
  const currentExpectedTotals=totalsByCurrency(sums,'client_remaining_amount',currentExpected),deferredExpectedTotals=totalsByCurrency(sums,'client_remaining_amount',deferredExpected),outgoingTotals=totalsByCurrency(outs,'amount',x=>String(x.deal_allocation_status||'').toUpperCase()==='CONFIRMED');
  const grid=e('div',{class:'rona-owner-grid rona-fin-kpi-grid'});
  grid.append(financeKpiCard('Подтверждено поступлений','received',totals),financeKpiCard('Ожидается поступлений — текущий период','expected',currentExpectedTotals),financeKpiCard('Ожидается поступлений — отложенный период','expected',deferredExpectedTotals),financeKpiCard('Оплачено в рамках сделок','paid',outgoingTotals));
  const head=e('div',{},grid);
  if(!f.obligationPlanAvailable)head.append(card('Взаиморасчёты',e('div',{class:'rona-owner-muted',text:'Подтверждённая сумма обязательства пока не сформирована.'})));

  const filter=e('div',{class:'rona-fin-filter'});
  [['RECEIVED','Поступило','is-received'],['PAID','Оплачено','is-paid'],['EXPECTED','Ожидается','is-expected']].forEach(([v,t,cls])=>filter.append(e('button',{type:'button',class:cls,'aria-pressed':String(financeFlowFilter===v),text:t,onclick:()=>{financeFlowFilter=v;renderPayments()}})));

  let summary=null;
  if(sums.length){
    summary=card('Финансовая картина по сделкам',tbl(['Deal ID','Клиент','Получено','Обязательство клиента','Остаток клиента к оплате','Оплачено в рамках сделки','Распределение поступлений','Finance','Accounting'],sums.map(s=>[
      s.deal_id||'—',s.client_name||s.client_id||'—',money(s.received_amount,s.currency),s.obligation_amount===null||s.obligation_amount===undefined?'—':money(s.obligation_amount,s.currency),s.client_remaining_amount===null||s.client_remaining_amount===undefined?'—':money(s.client_remaining_amount,s.currency),dealOutgoingText(String(s.deal_id||''),outs),dealIncomingAllocationCell(f,s),financeStatusCell(s.finance_status),accountingStatusCell(s.accounting_status)
    ])));
  }

  const xs=canonicalArray(f.incomingPayments);
  const incomingBody=xs.length?tbl(['Дата','Плательщик','PAYMENT ID','Сумма поступления','Валюта','Назначение / банковский документ','Банковский факт','Распределение по сделкам','Нераспределено','Finance','Accounting'],xs.map(x=>[
    date(x.payment_at),x.payer_name||'—',x.payment_id||'—',money(x.amount,x.currency),x.currency||'—',e('div',{},e('div',{text:x.original_payment_purpose||'—'}),x.bank_transaction_reference?e('div',{class:'rona-owner-muted',text:x.bank_transaction_reference}):null),bankStatusCell(x.bank_fact_status),incomingAllocationCell(f,x),unallocatedCell(f,x),financeStatusCell(x.finance_status),accountingStatusCell(x.accounting_closure_status)
  ])):e('div',{class:'rona-owner-muted',text:'Подтверждённых банковских поступлений пока нет.'});
  const incoming=card('Поступило от клиентов',incomingBody);

  let outgoing;
  if(outs.length){
    outgoing=card('Оплачено в рамках сделок',tbl(['Дата','Deal ID / область','Получатель','Роль','Сумма','Назначение / банковский документ','Банковский факт','Привязка к сделке'],outs.map(x=>[
      date(x.payment_at),(Array.isArray(x.deal_ids)?x.deal_ids:[]).join(' / ')||'—',x.beneficiary_name||'—',x.beneficiary_role||'—',money(x.amount,x.currency),e('div',{},e('div',{text:x.purpose||'—'}),x.bank_document?e('div',{class:'rona-owner-muted',text:x.bank_document}):null),bankStatusCell(x.bank_fact_status),allocationStatusCell(x.deal_allocation_status)
    ])));
  }else outgoing=card('Оплачено в рамках сделок',e('div',{class:'rona-owner-muted',text:'Подтверждённых исходящих платежей по сделкам пока нет.'}));

  const currentExp=sums.filter(currentExpected),deferredExp=sums.filter(deferredExpected);
  const expectedCurrent=currentExp.length?card('Ожидается поступлений — текущий период',tbl(['Deal ID','Клиент','Обязательство','Поступило','Ожидается сейчас','Состояние оплаты','Accounting'],currentExp.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',s.obligation_amount===null||s.obligation_amount===undefined?'—':money(s.obligation_amount,s.currency),money(s.received_amount,s.currency),money(s.client_remaining_amount,s.currency),financeStatusCell(s.finance_status),accountingStatusCell(s.accounting_status)]))):card('Ожидается поступлений — текущий период',e('div',{class:'rona-owner-muted',text:'Платежей, срок которых наступил в текущем периоде, нет.'}));
  const expectedDeferred=deferredExp.length?card('Ожидается поступлений — отложенный период',tbl(['Deal ID','Клиент','Обязательство','Поступило','К оплате позднее','Состояние оплаты','Период'],deferredExp.map(s=>[s.deal_id||'—',s.client_name||s.client_id||'—',s.obligation_amount===null||s.obligation_amount===undefined?'—':money(s.obligation_amount,s.currency),money(s.received_amount,s.currency),money(s.client_remaining_amount,s.currency),financeStatusCell(s.finance_status),financePill('Срок не наступил','info')]))):card('Ожидается поступлений — отложенный период',e('div',{class:'rona-owner-muted',text:'Отложенных платежей по условиям действующих сделок нет.'}));
  const expected=e('div',{},expectedCurrent,expectedDeferred),detail=financeFlowFilter==='PAID'?outgoing:financeFlowFilter==='EXPECTED'?expected:incoming;
  replacePage('payments',e('div',{},head,filter,summary,detail));
  isolatePaymentsPage();
  window.__RONA_PAYMENTS_CURRENT_STATE__={generatedAt:window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.generatedAt||null,current:currentExpectedTotals,deferred:deferredExpectedTotals,paymentProjectionContract:f.paymentProjectionContract||null};
}

renderPayments=renderPaymentsFinanceAuthorityV1;
})();
`;
export default ADMIN_PAYMENTS_FINANCE_PROJECTION_V1;
