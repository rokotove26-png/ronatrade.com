// @ts-nocheck

const ACTIVE_AUTHORITY=new Set(['CONFIRMED','VERIFIED']);
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const asArray=value=>Array.isArray(value)?value:[];

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
function isConfirmedDealOutgoing(row){
  return upper(row?.deal_allocation_status)==='CONFIRMED'
    && upper(row?.bank_fact_status)==='BANK_CONFIRMED'
    && upper(row?.authority_state)==='CONFIRMED'
    && (!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')
    && ['COUNTERPARTY_PAYMENT','BANK_FEE'].includes(upper(row?.flow_kind));
}
function allocationKey(paymentId,currency){return s(paymentId)+'\u0000'+upper(currency)}

export function buildPaymentOwnerScreenState({payments=[],paymentAllocations=[],outgoingPayments=[],dealFinanceSummaries=[],paymentScheduleAuthority={}}={}){
  const allPayments=asArray(payments),allAllocations=asArray(paymentAllocations),clientPayments=allPayments.filter(isClientPayment),outgoings=asArray(outgoingPayments);
  const clientByKey=new Map(clientPayments.map(row=>[allocationKey(row.payment_id,row.currency),row]));
  const incomingPaymentAllocations=[],dealTotals=new Map(),receiptTotals=new Map(),allocationRowsByPayment=new Map(),paidTotals=new Map();

  for(const row of allAllocations){
    if(!isVerifiedAllocation(row))continue;
    const key=allocationKey(row?.payment_id,row?.currency),payment=clientByKey.get(key);if(!payment)continue;
    const amount=n(row?.allocated_amount);if(amount===null||amount<0||!s(row?.deal_id))continue;
    const normalized={...row,payment_id:s(row.payment_id),deal_id:s(row.deal_id),currency:upper(row.currency),allocated_amount:amount};
    incomingPaymentAllocations.push(normalized);
    if(!allocationRowsByPayment.has(key))allocationRowsByPayment.set(key,[]);allocationRowsByPayment.get(key).push(normalized);
    const dkey=s(row.deal_id)+'\u0000'+upper(row.currency),d=dealTotals.get(dkey)||{deal_id:s(row.deal_id),currency:upper(row.currency),allocated_amount:0};d.allocated_amount=round(d.allocated_amount+amount);dealTotals.set(dkey,d);
    addCurrency(receiptTotals,row.currency,amount);
  }
  for(const row of outgoings)if(isConfirmedDealOutgoing(row))addCurrency(paidTotals,row?.currency,row?.amount);

  const paymentAllocationSummaries=clientPayments.map(payment=>{
    const key=allocationKey(payment.payment_id,payment.currency),rows=allocationRowsByPayment.get(key)||[],allocated=round(rows.reduce((sum,row)=>sum+Number(row.allocated_amount||0),0)),amount=n(payment.amount);
    let status='TO_VERIFY',residue=null;
    if(amount!==null&&amount>=0){residue=round(amount-allocated);if(allocated>amount+0.000001)status='TO_VERIFY';else if(allocated===0)status='UNALLOCATED';else if(residue>0.000001)status='PARTIALLY_ALLOCATED';else status='ALLOCATED'}
    return{payment_id:s(payment.payment_id),currency:upper(payment.currency),payment_amount:amount,allocated_total:allocated,unallocated_amount:residue,allocation_projection_status:status};
  });

  const schedules=asArray(paymentScheduleAuthority?.paymentSchedules),holds=asArray(paymentScheduleAuthority?.paymentScheduleHolds),scheduleByDeal=new Map(schedules.map(row=>[s(row.dealId),row])),holdByDeal=new Map(holds.map(row=>[s(row.dealId),row]));
  const currentMap=new Map(),deferredMap=new Map();
  for(const row of schedules){addCurrency(currentMap,row?.currency,row?.currentDueAmount);addCurrency(deferredMap,row?.currency,row?.deferredNotDueAmount)}

  const dealFinanceCurrentState=asArray(dealFinanceSummaries).map(summary=>{
    const dealId=s(summary?.deal_id),schedule=scheduleByDeal.get(dealId)||null,hold=holdByDeal.get(dealId)||null,dealAllocation=[...dealTotals.values()].find(x=>x.deal_id===dealId&&upper(x.currency)===upper(summary?.currency))||null;
    return{...summary,
      verified_received_amount:dealAllocation?dealAllocation.allocated_amount:0,
      payment_schedule_projection_status:schedule?'AUTHORITATIVE':hold?'TO_VERIFY':'TO_VERIFY',
      payment_schedule_state:schedule?.scheduleState??'TO_VERIFY',
      current_due_amount:schedule?.currentDueAmount??null,
      deferred_not_due_amount:schedule?.deferredNotDueAmount??null,
      payment_schedule_validation_errors:hold?.validationErrors??(hold?.reason?[hold.reason]:[])
    };
  });

  return{
    ownerPaymentScreenContract:'ADMIN_PAYMENTS_OWNER_CURRENT_STATE_V1',
    clientReceiptContract:'FINANCE_CLIENT_RECEIPTS_VERIFIED_ALLOCATION_V1',
    clientPayments,
    incomingPayments:clientPayments,
    incomingPaymentAllocations:incomingPaymentAllocations.sort((a,b)=>a.payment_id.localeCompare(b.payment_id)||a.deal_id.localeCompare(b.deal_id)),
    paymentAllocationSummaries,
    dealAllocationTotals:[...dealTotals.values()].sort((a,b)=>a.deal_id.localeCompare(b.deal_id)||a.currency.localeCompare(b.currency)),
    clientReceiptTotalsByCurrency:sortedTotals(receiptTotals),
    paymentTotalsByCurrency:sortedTotals(receiptTotals),
    currentDueTotalsByCurrency:sortedTotals(currentMap),
    deferredNotDueTotalsByCurrency:sortedTotals(deferredMap),
    paidDealTotalsByCurrency:sortedTotals(paidTotals),
    dealFinanceCurrentState,
    outgoingPayments:outgoings
  };
}
