import { readFile } from 'node:fs/promises';
import { buildPaymentScheduleProjection } from '../functions/portal/payment-schedule-current.js';

const projectionSource=await readFile('functions/portal/payment-schedule-current.js','utf8');
const runtimeSource=await readFile('functions/portal/main-ui/payment-schedule-runtime-v1.js','utf8');
const mainUiSource=await readFile('functions/portal/main-ui/index.js','utf8');
const financeServerSource=await readFile('supabase/functions/rona-owner-ai-sync/index.ts','utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const schedule=(data,id)=>data.schedules.find(x=>x.dealId===id);

const finance={
  paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',
  incomingPayments:[
    {payment_id:'PAYEV-2026-000001',currency:'USD',amount:236250,bank_fact_status:'BANK_CONFIRMED'},
    {payment_id:'PAYEV-2026-000002',currency:'USD',amount:201750,bank_fact_status:'BANK_CONFIRMED'},
    {payment_id:'PAYEV-2026-000003',currency:'USD',amount:49320,bank_fact_status:'BANK_CONFIRMED'},
    {payment_id:'PAYEV-2026-000004',currency:'USD',amount:11800,bank_fact_status:'BANK_CONFIRMED'},
    {payment_id:'PAYEV-2026-000005',currency:'RUB',amount:1003000,bank_fact_status:'BANK_CONFIRMED'}
  ],
  incomingPaymentAllocations:[
    {payment_id:'PAYEV-2026-000001',deal_id:'DEAL-2026-004',currency:'USD',allocated_amount:236250,allocation_status:'VERIFIED'},
    {payment_id:'PAYEV-2026-000002',deal_id:'DEAL-2026-005',currency:'USD',allocated_amount:201750,allocation_status:'VERIFIED'},
    {payment_id:'PAYEV-2026-000003',deal_id:'DEAL-2026-006',currency:'USD',allocated_amount:49320,allocation_status:'VERIFIED'}
  ],
  dealAllocationTotals:[
    {deal_id:'DEAL-2026-004',currency:'USD',allocated_amount:236250},
    {deal_id:'DEAL-2026-005',currency:'USD',allocated_amount:201750},
    {deal_id:'DEAL-2026-006',currency:'USD',allocated_amount:49320}
  ],
  dealFinanceSummaries:[
    {deal_id:'DEAL-2026-004',currency:'USD',obligation_amount:236250,received_amount:236250,client_remaining_amount:0,finance_status:'PAID',accounting_status:'OPEN'},
    {deal_id:'DEAL-2026-005',currency:'USD',obligation_amount:672500,received_amount:201750,client_remaining_amount:470750,finance_status:'NOT_DUE',accounting_status:'OPEN'},
    {deal_id:'DEAL-2026-006',currency:'USD',obligation_amount:164400,received_amount:49320,client_remaining_amount:115080,finance_status:'NOT_DUE',accounting_status:'OPEN'},
    {deal_id:'DEAL-2026-009',currency:'RUB',obligation_amount:31002300,received_amount:0,client_remaining_amount:31002300,finance_status:'NOT_DUE',accounting_status:'OPEN'}
  ],
  outgoingPayments:[
    {fact_id:'OUT-2026-005006-KUZMASH',amount:16536960,currency:'RUB',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY'},
    {fact_id:'OUT-2026-005006-KUZMASH-FEE',amount:3000,currency:'RUB',deal_ids:['DEAL-2026-005','DEAL-2026-006'],deal_allocation_status:'TO_VERIFY'}
  ],
  garantApplication:{registration:'1236',status:'SENT'}
};
const deals=[
  {deal_id:'DEAL-2026-004',finance_status:'PAID',accounting_closure_status:'OPEN'},
  {deal_id:'DEAL-2026-005',finance_status:'NOT_DUE',accounting_closure_status:'OPEN'},
  {deal_id:'DEAL-2026-006',finance_status:'NOT_DUE',accounting_closure_status:'OPEN'},
  {deal_id:'DEAL-2026-009',finance_status:'NOT_DUE',accounting_closure_status:'OPEN'}
];
const data=buildPaymentScheduleProjection(finance,deals,'2026-09-12T16:30:00.000Z');
const d004=schedule(data,'DEAL-2026-004'),d005=schedule(data,'DEAL-2026-005'),d006=schedule(data,'DEAL-2026-006'),d009=schedule(data,'DEAL-2026-009');
assert(data.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V1','schedule projection contract mismatch');
assert(data.schedulePolicy.frontendCalculation===false,'frontend schedule calculation policy must be false');
assert(d004?.projectionStatus==='AUTHORITATIVE'&&d004.obligationAmount===236250&&d004.verifiedReceivedAmount===236250&&d004.remainingAmount===0&&d004.currentDueAmount===0&&d004.deferredNotDueAmount===0&&d004.scheduleState==='PAID','DEAL-2026-004 schedule mismatch');
assert(d005?.projectionStatus==='AUTHORITATIVE'&&d005.paymentId==='PAYEV-2026-000002'&&d005.obligationAmount===672500&&d005.verifiedReceivedAmount===201750&&d005.remainingAmount===470750&&d005.currentDueAmount===0&&d005.deferredNotDueAmount===470750&&d005.scheduleState==='DEFERRED_NOT_DUE'&&d005.triggerState==='NOT_CONFIRMED','DEAL-2026-005 schedule mismatch');
assert(d006?.projectionStatus==='AUTHORITATIVE'&&d006.paymentId==='PAYEV-2026-000003'&&d006.obligationAmount===164400&&d006.verifiedReceivedAmount===49320&&d006.remainingAmount===115080&&d006.currentDueAmount===0&&d006.deferredNotDueAmount===115080&&d006.scheduleState==='DEFERRED_NOT_DUE'&&d006.triggerState==='NOT_CONFIRMED','DEAL-2026-006 schedule mismatch');
assert(d009?.projectionStatus==='TO_VERIFY'&&d009.scheduleState==='TO_VERIFY'&&d009.obligationAmount===null&&d009.verifiedReceivedAmount===null&&d009.remainingAmount===null&&d009.currentDueAmount===null&&d009.deferredNotDueAmount===null,'DEAL-2026-009 must fail closed');
assert(d005.triggerPolicy==='SENT_DOES_NOT_CONFIRM_GU_TRIGGER'&&d006.triggerPolicy==='SENT_DOES_NOT_CONFIRM_GU_TRIGGER'&&d005.currentDueAmount===0&&d006.currentDueAmount===0,'SENT application created DUE');
assert(d005.bankFactStatus==='BANK_CONFIRMED'&&d005.allocationStatus==='VERIFIED'&&d005.financeStatus==='NOT_DUE'&&d005.accountingClosureStatus==='OPEN','status layers are not distinct');
assert(d005.outgoingUsdEquivalent===null&&d005.outgoingUsdEquivalentStatus==='TO_VERIFY'&&d006.outgoingUsdEquivalent===null,'outgoing USD equivalent was synthesized');
assert(!projectionSource.includes('16536960')&&!projectionSource.includes('OUT-2026-005006-KUZMASH'),'KUZMASH inferred split leaked into projection');
assert(!projectionSource.includes('PAYEV-2026-000004')&&!projectionSource.includes('PAYEV-2026-000005'),'unallocated control payment leaked into materialized schedule');
assert(!projectionSource.includes('.candidateDealIds'),'candidateDealIds is used as allocation');
assert(!projectionSource.toLowerCase().includes('cbr')&&!projectionSource.toLowerCase().includes('central bank')&&!projectionSource.toLowerCase().includes('market fx')&&!projectionSource.toLowerCase().includes('pricing fx'),'synthetic FX logic detected');
assert(financeServerSource.includes('pa.allocated_amount'),'inherited PAYMENT_ALLOCATION boundary missing');
assert(financeServerSource.includes("pa.allocation_status='VERIFIED'::portal_private.payment_allocation_state_enum"),'inherited VERIFIED allocation boundary missing');
assert(runtimeSource.includes("ENDPOINT='/portal/payment-schedule-current'"),'frontend does not consume schedule server projection');
assert(runtimeSource.includes('window.__RONA_PAYMENT_SCHEDULE_CURRENT_STATE__=current'),'frontend schedule state marker missing');
assert(!runtimeSource.includes('obligationAmount-')&&!runtimeSource.includes('verifiedReceivedAmount-'),'frontend schedule arithmetic detected');
assert(mainUiSource.includes("import paymentScheduleRuntime from './payment-schedule-runtime-v1.js'"),'schedule runtime not attached to Admin main UI');

const changed=structuredClone(finance);
changed.dealAllocationTotals=changed.dealAllocationTotals.map(x=>x.deal_id==='DEAL-2026-005'?{...x,allocated_amount:210000}:x);
const changedData=buildPaymentScheduleProjection(changed,deals,'2026-09-12T16:31:00.000Z');
assert(schedule(changedData,'DEAL-2026-005').projectionStatus==='TO_VERIFY','allocation mismatch must fail closed instead of recomputing schedule');
assert(schedule(changedData,'DEAL-2026-005').currentDueAmount===null,'allocation mismatch must not synthesize current due');

console.log('ADMIN_PAYMENTS_SCHEDULE_MATERIALIZATION_SOURCE_QA=PASS');
console.log('DEAL004_SCHEDULE=PASS');
console.log('DEAL005_SCHEDULE=PASS');
console.log('DEAL006_SCHEDULE=PASS');
console.log('DEAL009_FAIL_CLOSED=PASS');
console.log('SENT_DOES_NOT_CREATE_DUE=PASS');
console.log('PAYMENT_ALLOCATION_SEPARATION=PASS');
console.log('KUZMASH_NO_INFERRED_SPLIT=PASS');
console.log('FX_NO_SYNTHESIS=PASS');
