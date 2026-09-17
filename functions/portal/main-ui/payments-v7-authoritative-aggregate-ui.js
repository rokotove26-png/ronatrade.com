const paymentsV7AuthoritativeAggregateUi = String.raw`
const PAYMENTS_V7_SERVER_AGGREGATE_UI='PAYMENTS_V7_SERVER_AGGREGATE_UI_V2';

function paymentsV7ServerAggregateRows(aggregate){
  const groups=paymentsV7Array(aggregate?.groups),rows=[];
  let verify=paymentsV7Upper(aggregate?.completeness_status)!=='COMPLETE';
  for(const group of groups){
    const status=paymentsV7Upper(group?.status),completeness=paymentsV7Upper(group?.completeness_status),currency=paymentsV7Upper(group?.currency),amount=paymentsV7Num(group?.amount);
    if(status==='AUTHORITATIVE'&&currency&&amount!==null)rows.push({currency,amount});
    else verify=true;
    if(completeness&&completeness!=='COMPLETE')verify=true;
  }
  if(paymentsV7Array(aggregate?.unresolved_deal_ids).length)verify=true;
  return {rows,verify};
}

function paymentsV7MergeServerAggregateRows(...aggregates){
  const totals=new Map();
  let verify=false;
  for(const aggregate of aggregates){
    const resolved=paymentsV7ServerAggregateRows(aggregate);
    if(resolved.verify)verify=true;
    for(const row of resolved.rows){
      totals.set(row.currency,(totals.get(row.currency)||0)+Number(row.amount));
    }
  }
  return {
    rows:[...totals.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([currency,amount])=>({currency,amount})),
    verify,
  };
}

function paymentsV7ServerFundingRows(projection,field){
  const groups=paymentsV7Array(projection?.funding_aggregate),rows=[];
  let verify=groups.length===0;
  for(const group of groups){
    const status=paymentsV7Upper(group?.status),completeness=paymentsV7Upper(group?.completeness_status),currency=paymentsV7Upper(group?.currency),amount=paymentsV7Num(group?.[field]);
    if(status==='AUTHORITATIVE'&&currency&&amount!==null)rows.push({currency,amount});
    else verify=true;
    if(completeness&&completeness!=='COMPLETE')verify=true;
    if(paymentsV7Array(group?.unresolved_deal_ids).length)verify=true;
  }
  return {rows,verify};
}

renderPayments=function renderPayments(){
  paymentsV7InstallStyle();
  const projection=paymentsV7Projection();
  if(!projection){
    const root=e('div',{class:'rona-payments-v7','data-rona-payments-owner':'admin-payments-v7-native-v2'},e('div',{class:'rona-owner-muted',text:'Синхронизация платежного контура…'}));
    replacePage('payments',root);
    return;
  }
  const deals=paymentsV7Array(projection.deals),root=e('div',{class:'rona-payments-v7','data-rona-payments-owner':'admin-payments-v7-native-v2','data-payments-contract':'ADMIN_PAYMENTS_V7','data-payments-aggregate-owner':PAYMENTS_V7_SERVER_AGGREGATE_UI});
  const currencyAggregates=projection?.currency_aggregates||{};
  const total=paymentsV7ServerAggregateRows(currencyAggregates?.total_to_receive);
  const received=paymentsV7ServerAggregateRows(currencyAggregates?.verified_received);
  const expected=paymentsV7ServerAggregateRows(currencyAggregates?.due_now);
  const conditional=paymentsV7ServerAggregateRows(currencyAggregates?.future_conditional);
  const spent=paymentsV7ServerFundingRows(projection,'funding_spent');
  const remaining=paymentsV7ServerFundingRows(projection,'funding_remaining');
  const kpis=e('div',{class:'rona-payments-v7-kpis'});
  const spendNode=e('div',{class:'rona-payments-v7-money-lines'});
  spendNode.append(e('small',{text:'Потрачено'}),paymentsV7MoneyLines(spent.rows,spent.verify),e('small',{text:'Остаток'}),paymentsV7MoneyLines(remaining.rows,remaining.verify));
  kpis.append(
    paymentsV7Kpi('Сумма по сделке',paymentsV7MoneyLines(total.rows,total.verify)),
    paymentsV7Kpi('Получено',paymentsV7MoneyLines(received.rows,received.verify)),
    paymentsV7Kpi('Ожидается сейчас',paymentsV7MoneyLines(expected.rows,expected.verify)),
    paymentsV7Kpi('Conditional',paymentsV7MoneyLines(conditional.rows,conditional.verify),e('div',{class:'rona-payments-v7-kpi-sub',text:'Условно / будущий срок'})),
    paymentsV7Kpi('Потрачено / Остаток',spendNode),
  );
  root.append(kpis);
  const board=e('div',{class:'rona-payments-v7-board'});
  for(const deal of deals)board.append(paymentsV7Deal(deal));
  root.append(board);
  const queue=paymentsV7Array(projection.owner_exception_queue),owner=paymentsV7OwnerQueue(queue,deals);
  if(owner)root.append(owner);
  replacePage('payments',root);
  const host=page('payments')?.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"],:scope > .rona-owner-page-content');
  if(host){host.dataset.ronaPaymentsOwner='admin-payments-v7-native-v2';host.dataset.paymentsContract='ADMIN_PAYMENTS_V7';host.dataset.paymentsAggregateOwner=PAYMENTS_V7_SERVER_AGGREGATE_UI}
  window.__RONA_PAYMENTS_CURRENT_STATE__={contract:'ADMIN_PAYMENTS_V7',routeOwner:'admin-payments-v7-native-v2',aggregateOwner:PAYMENTS_V7_SERVER_AGGREGATE_UI,generatedAt:projection.generated_at||null,dealCount:deals.length,ownerQueueCount:queue.length};
};

if(paymentsV7Projection())queueMicrotask(()=>{try{renderPayments()}catch(error){console.error('PAYMENTS_V7_SERVER_AGGREGATE_RENDER_FAILED',error)}});
`;

export default paymentsV7AuthoritativeAggregateUi;
