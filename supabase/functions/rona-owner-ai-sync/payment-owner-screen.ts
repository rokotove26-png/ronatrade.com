// @ts-nocheck

const ACTIVE_AUTHORITY=new Set(['CONFIRMED','VERIFIED']);
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const asArray=value=>Array.isArray(value)?value:[];
const sameMoney=(a,b)=>{const x=n(a),y=n(b);return x!==null&&y!==null&&Math.abs(x-y)<0.000001};

function addCurrency(map,currency,amount){
  const key=upper(currency),value=n(amount);if(!key||value===null)return;
  const row=map.get(key)||{currency:key,amount:0};row.amount=round(row.amount+value);map.set(key,row);
}
function sortedTotals(map){return[...map.values()].sort((a,b)=>a.currency.localeCompare(b.currency))}
function isClientPayment(row){
  return upper(row?.payment_direction)==='INCOMING'
    && upper(row?.payment_kind)==='CLIENT_PAYMENT'
    && upper(row?.bank_fact_status)==='BANK_CONFIRMED'
    && upper(row?.finance_verification_status)==='VERIFIED'
    && ACTIVE_AUTHORITY.has(upper(row?.authority_state))
    && (!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE');
}
function isVerifiedAllocation(row){
  return upper(row?.allocation_status)==='VERIFIED'
    && ACTIVE_AUTHORITY.has(upper(row?.authority_state))
    && (!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE');
}
export function isReconciledPaymentAllocation(row){
  return isVerifiedAllocation(row)
    && upper(row?.source_system).includes('RECONCIL')
    && !!s(row?.source_version)
    && !!row?.source_timestamp;
}
function isConfirmedDealOutgoing(row){
  return upper(row?.deal_allocation_status)==='CONFIRMED'
    && upper(row?.bank_fact_status)==='BANK_CONFIRMED'
    && upper(row?.authority_state)==='CONFIRMED'
    && (!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')
    && ['COUNTERPARTY_PAYMENT','BANK_FEE'].includes(upper(row?.flow_kind));
}
function allocationKey(paymentId,currency){return s(paymentId)+'\u0000'+upper(currency)}

export function buildPaymentOwnerScreenState({payments=[],paymentAllocations=[],outgoingPayments=[],dealFinanceSummaries=[],paymentScheduleAuthority={}}={}){
  const allPayments=asArray(payments),allAllocations=asArray(paymentAllocations),outgoings=asArray(outgoingPayments);
  const clientPaymentById=new Map(),conflictedClientPaymentIds=new Set();
  for(const row of allPayments){
    if(!isClientPayment(row))continue;const id=s(row?.payment_id);if(!id)continue;
    const previous=clientPaymentById.get(id);
    if(!previous){clientPaymentById.set(id,row);continue}
    if(upper(previous?.currency)!==upper(row?.currency)||n(previous?.amount)!==n(row?.amount))conflictedClientPaymentIds.add(id);
  }
  const clientPayments=[...clientPaymentById.entries()].filter(([id])=>!conflictedClientPaymentIds.has(id)).map(([,row])=>row);
  const clientByKey=new Map(clientPayments.map(row=>[allocationKey(row.payment_id,row.currency),row]));
  const incomingPaymentAllocations=[],dealTotals=new Map(),receiptTotals=new Map(),allocationRowsByPayment=new Map(),rawRowsByPayment=new Map(),paidTotals=new Map();

  // Receipt KPI is full PAYMENT truth. Allocation is a separate authority.
  for(const payment of clientPayments)addCurrency(receiptTotals,payment?.currency,payment?.amount);

  // Only reconciled Finance PAYMENT_ALLOCATION may be projected as confirmed distribution.
  for(const row of allAllocations){
    const key=allocationKey(row?.payment_id,row?.currency),payment=clientByKey.get(key);if(!payment)continue;
    if(!rawRowsByPayment.has(key))rawRowsByPayment.set(key,[]);rawRowsByPayment.get(key).push(row);
    if(!isReconciledPaymentAllocation(row))continue;
    const amount=n(row?.allocated_amount);if(amount===null||amount<0||!s(row?.deal_id))continue;
    const normalized={...row,payment_id:s(row.payment_id),deal_id:s(row.deal_id),currency:upper(row.currency),allocated_amount:amount,
      source_system:s(row?.source_system),source_version:s(row?.source_version),source_timestamp:row?.source_timestamp??null};
    incomingPaymentAllocations.push(normalized);
    if(!allocationRowsByPayment.has(key))allocationRowsByPayment.set(key,[]);allocationRowsByPayment.get(key).push(normalized);
    const dkey=s(row.deal_id)+'\u0000'+upper(row.currency),d=dealTotals.get(dkey)||{deal_id:s(row.deal_id),currency:upper(row.currency),allocated_amount:0};d.allocated_amount=round(d.allocated_amount+amount);dealTotals.set(dkey,d);
  }
  for(const row of outgoings)if(isConfirmedDealOutgoing(row))addCurrency(paidTotals,row?.currency,row?.amount);

  const paymentAllocationSummaries=clientPayments.map(payment=>{
    const key=allocationKey(payment.payment_id,payment.currency),rows=allocationRowsByPayment.get(key)||[],rawRows=rawRowsByPayment.get(key)||[],allocated=round(rows.reduce((sum,row)=>sum+Number(row.allocated_amount||0),0)),amount=n(payment.amount),hasUnreconciled=rawRows.some(row=>!isReconciledPaymentAllocation(row));
    let status='TO_VERIFY',residue=null;
    if(amount!==null&&amount>=0){
      residue=round(amount-allocated);
      if(hasUnreconciled||allocated>amount+0.000001)status='TO_VERIFY';
      else if(allocated===0)status='UNALLOCATED';
      else if(residue>0.000001)status='PARTIALLY_ALLOCATED';
      else status='ALLOCATED';
    }
    return{payment_id:s(payment.payment_id),currency:upper(payment.currency),payment_amount:amount,allocated_total:allocated,unallocated_amount:residue,allocation_projection_status:status,
      allocation_authority:'FINANCE_RECONCILED_PAYMENT_ALLOCATION_V1',unreconciled_allocation_rows:rawRows.filter(row=>!isReconciledPaymentAllocation(row)).length};
  });

  const schedules=asArray(paymentScheduleAuthority?.paymentSchedules),holds=asArray(paymentScheduleAuthority?.paymentScheduleHolds),scheduleByDeal=new Map(schedules.map(row=>[s(row.dealId),row])),holdByDeal=new Map(holds.map(row=>[s(row.dealId),row]));
  const currentMap=new Map(),deferredMap=new Map();
  const allDealTotals=[...dealTotals.values()];
  const dealFinanceCurrentState=asArray(dealFinanceSummaries).map(summary=>{
    const dealId=s(summary?.deal_id),schedule=scheduleByDeal.get(dealId)||null,hold=holdByDeal.get(dealId)||null,dealAllocations=allDealTotals.filter(x=>x.deal_id===dealId);
    const scheduleCurrency=upper(schedule?.currency),dealAllocation=schedule?dealAllocations.find(x=>upper(x.currency)===scheduleCurrency)||null:(dealAllocations.length===1?dealAllocations[0]:null),verifiedReceived=dealAllocation?dealAllocation.allocated_amount:0;
    const scheduleAuthoritative=!!schedule&&n(schedule?.verifiedReceivedAmount)!==null&&sameMoney(schedule?.verifiedReceivedAmount,verifiedReceived);
    if(scheduleAuthoritative){addCurrency(currentMap,schedule?.currency,schedule?.currentDueAmount);addCurrency(deferredMap,schedule?.currency,schedule?.deferredNotDueAmount)}
    const projectedCurrency=scheduleAuthoritative?scheduleCurrency:(dealAllocation?.currency||null);
    const validationErrors=schedule&&!scheduleAuthoritative?['FINANCE_RECONCILED_ALLOCATION_MISMATCH']:(hold?.validationErrors??(hold?.reason?[hold.reason]:[]));
    return{...summary,
      currency:projectedCurrency,
      obligation_amount:scheduleAuthoritative?n(schedule?.obligationAmount):null,
      client_remaining_amount:scheduleAuthoritative?n(schedule?.remainingAmount):null,
      verified_received_amount:verifiedReceived,
      finance_status:scheduleAuthoritative?s(schedule?.financeStatus||summary?.finance_status):'TO_VERIFY',
      payment_schedule_projection_status:scheduleAuthoritative?'AUTHORITATIVE':'TO_VERIFY',
      payment_schedule_state:scheduleAuthoritative?(schedule?.scheduleState??'TO_VERIFY'):'TO_VERIFY',
      current_due_amount:scheduleAuthoritative?n(schedule?.currentDueAmount):null,
      deferred_not_due_amount:scheduleAuthoritative?n(schedule?.deferredNotDueAmount):null,
      payment_schedule_validation_errors:validationErrors
    };
  });

  return{
    ownerPaymentScreenContract:'ADMIN_PAYMENTS_OWNER_CURRENT_STATE_V1',
    clientReceiptContract:'FINANCE_CLIENT_RECEIPTS_PAYMENT_AMOUNT_V2',
    allocationReconciliationContract:'FINANCE_RECONCILED_PAYMENT_ALLOCATION_V1',
    clientPayments,
    incomingPayments:clientPayments,
    incomingPaymentAllocations:incomingPaymentAllocations.sort((a,b)=>a.payment_id.localeCompare(b.payment_id)||a.deal_id.localeCompare(b.deal_id)),
    paymentAllocationSummaries,
    dealAllocationTotals:allDealTotals.sort((a,b)=>a.deal_id.localeCompare(b.deal_id)||a.currency.localeCompare(b.currency)),
    clientReceiptTotalsByCurrency:sortedTotals(receiptTotals),
    paymentTotalsByCurrency:sortedTotals(receiptTotals),
    currentDueTotalsByCurrency:sortedTotals(currentMap),
    deferredNotDueTotalsByCurrency:sortedTotals(deferredMap),
    paidDealTotalsByCurrency:sortedTotals(paidTotals),
    dealFinanceCurrentState,
    outgoingPayments:outgoings
  };
}
