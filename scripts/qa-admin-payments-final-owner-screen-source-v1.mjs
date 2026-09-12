import { readFile } from 'node:fs/promises';
import { buildPaymentOwnerScreenState } from '../supabase/functions/rona-owner-ai-sync/payment-owner-screen.ts';
import { buildPaymentPassportProjection } from '../functions/portal/payment-passport-current.js';

const assert=(v,m)=>{if(!v)throw new Error(m)};
const payment=(id,amount,currency,direction,kind,extra={})=>({payment_id:id,payment_at:'2026-09-12T12:00:00.000Z',amount,currency,payer_name:'QA payer',counterparty_name:'QA counterparty',bank_transaction_reference:'QA-'+id,bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN',finance_verification_status:'VERIFIED',payment_direction:direction,payment_kind:kind,allocation_review_status:extra.allocation_review_status||'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE',...extra});
const allocation=(paymentId,dealId,amount,currency)=>({payment_id:paymentId,deal_id:dealId,allocated_amount:amount,currency,allocation_status:'VERIFIED',finance_status:'PAID',accounting_closure_status:'OPEN',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'});
const summary=(dealId,obligation,received,remaining,finance='PARTIALLY_PAID')=>({deal_id:dealId,client_id:'QA-CLIENT',client_name:'QA Client',obligation_amount:obligation,received_amount:received,currency:'USD',client_remaining_amount:remaining,finance_status:finance,accounting_status:'OPEN',authority_state:'CONFIRMED'});
const out=(id,amount,currency,kind='COUNTERPARTY_PAYMENT')=>({fact_id:id,payment_at:'2026-09-12T12:00:00.000Z',beneficiary_name:'QA beneficiary',beneficiary_role:kind==='BANK_FEE'?'Банк':'Контрагент',amount,currency,purpose:'QA expense',bank_document:'QA bank doc',deal_ids:['DEAL-2026-004'],source_deal_ids:['DEAL-2026-004'],deal_allocation_status:'CONFIRMED',flow_kind:kind,bank_fact_status:'BANK_CONFIRMED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'});
const schedule=(dealId,obligation,received,remaining,deferred,state='DEFERRED_NOT_DUE')=>({dealId,currency:'USD',obligationAmount:obligation,verifiedReceivedAmount:received,remainingAmount:remaining,currentDueAmount:0,deferredNotDueAmount:deferred,scheduleState:state,triggerState:remaining?'NOT_CONFIRMED':'NOT_APPLICABLE',financeStatus:remaining?'PARTIALLY_PAID':'PAID',accountingClosureStatus:'OPEN',authorityState:'FINANCE_CURRENT_STATE'});

const payments=[
  payment('PAYEV-2026-000001',236250,'USD','INCOMING','CLIENT_PAYMENT'),
  payment('PAYEV-2026-000002',201750,'USD','INCOMING','CLIENT_PAYMENT'),
  payment('PAYEV-2026-000003',49320,'USD','INCOMING','CLIENT_PAYMENT'),
  payment('PAYEV-2026-000004',11800,'USD','OUTGOING','FX_CONVERSION',{allocation_review_status:'NOT_APPLICABLE'}),
  payment('PAYEV-2026-000005',1003000,'RUB','INCOMING','FX_CONVERSION',{allocation_review_status:'NOT_APPLICABLE'}),
  payment('PAYEV-2026-000006',30000,'USD','OUTGOING','FX_CONVERSION',{allocation_review_status:'NOT_APPLICABLE'}),
  payment('PAYEV-2026-000007',2505000,'RUB','INCOMING','FX_CONVERSION',{allocation_review_status:'NOT_APPLICABLE'}),
  payment('PAYEV-2026-000008',3644000,'RUB','OUTGOING','COUNTERPARTY_PAYMENT',{allocation_review_status:'TO_VERIFY',counterparty_name:'ЧПТУП «КУЗМАШ»'}),
  payment('PAYEV-2026-000009',3000,'RUB','OUTGOING','BANK_FEE',{allocation_review_status:'TO_VERIFY',counterparty_name:'Банк'}),
  payment('OUT-2026-004-BNK',8484210,'RUB','OUTGOING','COUNTERPARTY_PAYMENT'),
  payment('OUT-2026-004-BNK-FEE',3000,'RUB','OUTGOING','BANK_FEE'),
  payment('OUT-2026-004-ORIENT',25444800,'KZT','OUTGOING','COUNTERPARTY_PAYMENT'),
  payment('OUT-2026-004-ORIENT-FEE',20000,'KZT','OUTGOING','BANK_FEE'),
  payment('OUT-2026-004-SGTRANS',5899358.90,'RUB','OUTGOING','COUNTERPARTY_PAYMENT'),
  payment('OUT-2026-004-SGTRANS-FEE',3000,'RUB','OUTGOING','BANK_FEE')
];
const paymentAllocations=[allocation('PAYEV-2026-000001','DEAL-2026-004',236250,'USD'),allocation('PAYEV-2026-000002','DEAL-2026-005',201750,'USD'),allocation('PAYEV-2026-000003','DEAL-2026-006',49320,'USD')];
const outgoingPayments=[out('OUT-2026-004-BNK',8484210,'RUB'),out('OUT-2026-004-BNK-FEE',3000,'RUB','BANK_FEE'),out('OUT-2026-004-ORIENT',25444800,'KZT'),out('OUT-2026-004-ORIENT-FEE',20000,'KZT','BANK_FEE'),out('OUT-2026-004-SGTRANS',5899358.90,'RUB'),out('OUT-2026-004-SGTRANS-FEE',3000,'RUB','BANK_FEE'),{fact_id:'OUT-2026-005006-KUZMASH',amount:16536960,currency:'RUB',deal_ids:[],source_deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY',flow_kind:'COUNTERPARTY_PAYMENT',bank_fact_status:'BANK_CONFIRMED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'}];
const dealFinanceSummaries=[summary('DEAL-2026-004',236250,236250,0,'PAID'),summary('DEAL-2026-005',672500,201750,470750),summary('DEAL-2026-006',164400,49320,115080),summary('DEAL-2026-009',362600,0,362600,'DUE')];
const paymentScheduleAuthority={paymentScheduleContract:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1',paymentSchedules:[schedule('DEAL-2026-004',236250,236250,0,0,'PAID'),schedule('DEAL-2026-005',672500,201750,470750,470750),schedule('DEAL-2026-006',164400,49320,115080,115080)],paymentScheduleHolds:[{dealId:'DEAL-2026-009',currency:'USD',scheduleState:'TO_VERIFY',financeStatus:'DUE',accountingClosureStatus:'OPEN',reason:'FINANCE_PAYMENT_SCHEDULE_NOT_MATERIALIZED',validationErrors:[]}]};
const owner=buildPaymentOwnerScreenState({payments,paymentAllocations,outgoingPayments,dealFinanceSummaries,paymentScheduleAuthority});
const finance={paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',payments,paymentAllocations,outgoingPayments,dealFinanceSummaries,...paymentScheduleAuthority,...owner};
const total=(rows,c)=>rows.find(x=>x.currency===c)?.amount;
const dealTotalFrom=(state,id)=>state.dealAllocationTotals.find(x=>x.deal_id===id)?.allocated_amount||0;
const dealTotal=id=>dealTotalFrom(owner,id);
assert(total(owner.clientReceiptTotalsByCurrency,'USD')===487320,'client receipts total mismatch');
assert(owner.incomingPayments.length===3&&owner.incomingPayments.every(x=>x.payment_kind==='CLIENT_PAYMENT'),'non-client payment leaked into incoming');
assert(dealTotal('DEAL-2026-004')===236250&&dealTotal('DEAL-2026-005')===201750&&dealTotal('DEAL-2026-006')===49320&&dealTotal('DEAL-2026-009')===0,'deal allocation mismatch');
assert(total(owner.currentDueTotalsByCurrency,'USD')===0,'current due must be zero');
assert(total(owner.deferredNotDueTotalsByCurrency,'USD')===585830,'deferred total mismatch');
const d9=owner.dealFinanceCurrentState.find(x=>x.deal_id==='DEAL-2026-009');
assert(d9.payment_schedule_projection_status==='TO_VERIFY'&&d9.payment_schedule_state==='TO_VERIFY','009 did not fail closed');
assert(d9.obligation_amount===null&&d9.client_remaining_amount===null&&d9.current_due_amount===null&&d9.deferred_not_due_amount===null,'009 stale schedule-dependent values leaked');
assert(d9.currency===null&&d9.finance_status==='TO_VERIFY','009 stale USD/DUE summary leaked');
assert(total(owner.paidDealTotalsByCurrency,'RUB')===14389568.9,'RUB paid-deal total mismatch');
assert(total(owner.paidDealTotalsByCurrency,'KZT')===25464800,'KZT paid-deal total mismatch');
const p4=buildPaymentPassportProjection(finance,'DEAL-2026-004'),p5=buildPaymentPassportProjection(finance,'DEAL-2026-005'),p9=buildPaymentPassportProjection(finance,'DEAL-2026-009');
assert(p4.clientReceipts.length===1&&p4.clientReceipts[0].paymentId==='PAYEV-2026-000001','004 receipt mismatch');
assert(p4.allocations.length===1&&p4.allocations[0].allocatedAmount===236250,'004 allocation mismatch');
assert(p4.relatedOutgoings.length===3&&p4.bankFees.length===3,'004 outgoing/fee separation mismatch');
assert(p4.fxConversions.length===4&&p4.fxConversions.every(x=>x.paymentKind==='FX_CONVERSION'),'FX separation mismatch');
assert(p5.clientReceipts.length===1&&p5.clientReceipts[0].paymentId==='PAYEV-2026-000002'&&p5.totals.deferredNotDueAmount===470750,'005 passport mismatch');
assert(p5.relatedOutgoings.length===0,'unallocated KUZMASH leaked into 005 related outgoings');
assert(p5.unallocatedOutgoings.some(x=>x.paymentId==='PAYEV-2026-000008')&&p5.unallocatedBankFees.some(x=>x.paymentId==='PAYEV-2026-000009'),'unallocated 008/009 missing');
assert(p9.projectionStatus==='TO_VERIFY'&&p9.financeStatus==='TO_VERIFY'&&p9.totals.scheduleStatus==='TO_VERIFY'&&p9.totals.scheduleState==='TO_VERIFY','009 passport not fail closed');
assert(p9.totals.currency===null&&p9.totals.obligationAmount===null&&p9.totals.remainingAmount===null&&p9.totals.currentDueAmount===null&&p9.totals.deferredNotDueAmount===null,'009 passport leaked stale schedule values');
assert(p4.fundsTrace.status==='NOT_ESTABLISHED'&&p4.fundsTrace.directSourceUseLinks.length===0,'false funds trace');

const splitPayment=payment('PAYEV-QA-SPLIT-001',100000,'USD','INCOMING','CLIENT_PAYMENT');
const splitOwner=buildPaymentOwnerScreenState({
  payments:[splitPayment],
  paymentAllocations:[allocation(splitPayment.payment_id,'DEAL-QA-A',30000,'USD'),allocation(splitPayment.payment_id,'DEAL-QA-B',50000,'USD')],
  outgoingPayments:[],dealFinanceSummaries:[],paymentScheduleAuthority:{paymentSchedules:[],paymentScheduleHolds:[]}
});
const splitSummary=splitOwner.paymentAllocationSummaries.find(x=>x.payment_id===splitPayment.payment_id);
assert(total(splitOwner.clientReceiptTotalsByCurrency,'USD')===100000,'full client payment KPI reduced by partial allocation');
assert(dealTotalFrom(splitOwner,'DEAL-QA-A')===30000&&dealTotalFrom(splitOwner,'DEAL-QA-B')===50000,'split allocation mismatch');
assert(splitSummary?.allocated_total===80000&&splitSummary?.unallocated_amount===20000&&splitSummary?.allocation_projection_status==='PARTIALLY_ALLOCATED','unallocated residue mismatch');

const [ai,ownerSource,passportSource,ui,runtime]=await Promise.all([
  readFile('supabase/functions/rona-owner-ai-sync/index.ts','utf8'),readFile('supabase/functions/rona-owner-ai-sync/payment-owner-screen.ts','utf8'),readFile('functions/portal/payment-passport-current.js','utf8'),readFile('functions/portal/main-ui/index.js','utf8'),readFile('functions/portal/main-ui/payment-passport-runtime-v1.js','utf8')
]);
const production=[ai,ownerSource,passportSource,ui,runtime].join('\n');
assert(ai.includes("p.payment_direction='INCOMING'::portal_private.payment_direction_enum")&&ai.includes("p.payment_kind='CLIENT_PAYMENT'::portal_private.payment_kind_enum"),'strict client receipt SQL missing');
assert(ai.includes("pa.allocation_status='VERIFIED'::portal_private.payment_allocation_state_enum"),'verified allocation SQL missing');
assert(ownerSource.includes("upper(row?.payment_direction)==='INCOMING'")&&ownerSource.includes("upper(row?.payment_kind)==='CLIENT_PAYMENT'"),'server revalidation missing');
assert(ownerSource.includes("for(const payment of clientPayments)addCurrency(receiptTotals,payment?.currency,payment?.amount)"),'receipt KPI is not full PAYMENT amount');
assert(!ownerSource.includes('candidate_deal_ids')&&!passportSource.includes('candidate_deal_ids'),'candidateDealIds used by projection');
assert(ai.includes("case when deal_allocation_status='CONFIRMED' then deal_ids else array[]::text[] end deal_ids"),'unconfirmed outgoing deal ids not stripped');
assert(ui.includes('clientReceiptTotalsByCurrency')&&ui.includes('currentDueTotalsByCurrency')&&ui.includes('deferredNotDueTotalsByCurrency')&&ui.includes('paidDealTotalsByCurrency'),'Admin KPI does not consume server totals');
assert(ui.includes("payment_schedule_projection_status||'').toUpperCase()==='AUTHORITATIVE'?financeStatusCell")&&ui.includes("financePill('TO_VERIFY','neutral')"),'Admin unresolved deal row does not expose TO_VERIFY');
assert(ui.includes('data-rona-payment-passport-open')&&runtime.includes('/portal/payment-passport-current?dealId='),'payment passport button/runtime missing');
assert(passportSource.includes("fetchTrusted(request,'/admin/ai-sync')"),'passport does not use trusted Admin Finance source');
assert(passportSource.includes("scheduleAuthoritative=upper(summary?.payment_schedule_projection_status)==='AUTHORITATIVE'&&!!schedule"),'passport does not fail closed on projection status');
assert(passportSource.includes("label:'Связанные расходы по сделке'")&&passportSource.includes("status:'NOT_ESTABLISHED'"),'false funds trace guard missing');
for(const forbidden of ['487320','236250','201750','49320','470750','115080','585830','14389568','25464800','PAYEV-2026-000001','PAYEV-2026-000008'])assert(!production.includes(forbidden),`production hardcode detected: ${forbidden}`);
console.log('CLIENT_RECEIPTS_TOTAL_487320_USD=PASS');
console.log('CLIENT_ALLOCATION_004_236250=PASS');
console.log('CLIENT_ALLOCATION_005_201750=PASS');
console.log('CLIENT_ALLOCATION_006_49320=PASS');
console.log('CLIENT_ALLOCATION_009_ZERO=PASS');
console.log('FX_CONVERSIONS_EXCLUDED_FROM_CLIENT_RECEIPTS=PASS');
console.log('OUTGOING_EXCLUDED_FROM_CLIENT_RECEIPTS=PASS');
console.log('CURRENT_DUE_005_006_ZERO=PASS');
console.log('DEFERRED_005_470750=PASS');
console.log('DEFERRED_006_115080=PASS');
console.log('DEFERRED_TOTAL_585830=PASS');
console.log('DEAL009_FAIL_CLOSED_TO_VERIFY=PASS');
console.log('DEAL009_STALE_SUMMARY_SUPPRESSED=PASS');
console.log('DEAL009_PASSPORT_TO_VERIFY=PASS');
console.log('DEAL009_OLD_USD_NOT_RENDERED=PASS');
console.log('FULL_CLIENT_PAYMENT_KPI=PASS');
console.log('PARTIAL_ALLOCATION_DOES_NOT_REDUCE_RECEIPT_KPI=PASS');
console.log('UNALLOCATED_RESIDUE=PASS');
console.log('PAYMENT_ALLOCATION_SEPARATION=PASS');
console.log('PAID_DEAL_RUB_14389568_90=PASS');
console.log('PAID_DEAL_KZT_25464800=PASS');
console.log('PAYMENT_PASSPORT_SERVER_PROJECTION=PASS');
console.log('BANK_FEES_SEPARATE=PASS');
console.log('FX_CONVERSION_DISTINCT=PASS');
console.log('NO_FALSE_FUNDS_TRACE=PASS');
console.log('ADMIN_PAYMENTS_FINAL_OWNER_SCREEN_SOURCE_QA=PASS');
