import { readFile } from 'node:fs/promises';
import { buildPaymentScheduleProjection } from '../functions/portal/payment-schedule-current.js';

const projectionSource=await readFile('functions/portal/payment-schedule-current.js','utf8');
const runtimeSource=await readFile('functions/portal/main-ui/payment-schedule-runtime-v1.js','utf8');
const mainUiSource=await readFile('functions/portal/main-ui/index.js','utf8');
const financeServerSource=await readFile('supabase/functions/rona-owner-ai-sync/index.ts','utf8');
const financeScheduleSource=await readFile('supabase/functions/rona-owner-ai-sync/payment-schedule-authority.ts','utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const schedule=(data,id)=>data.schedules.find(x=>x.dealId===id);
const allocation=(paymentId,dealId,currency,amount)=>({payment_id:paymentId,deal_id:dealId,currency,allocated_amount:amount,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'});
const payment=(paymentId,currency,amount)=>({payment_id:paymentId,currency,amount,bank_fact_status:'BANK_CONFIRMED'});
const summary=(dealId,currency,obligation,financeStatus='NOT_DUE')=>({deal_id:dealId,currency,obligation_amount:obligation,finance_status:financeStatus,accounting_status:'OPEN'});
const row=(dealId,currency,obligation,received,remaining,currentDue,deferred,state,trigger='NOT_CONFIRMED')=>({dealId,currency,obligationAmount:obligation,verifiedReceivedAmount:received,remainingAmount:remaining,currentDueAmount:currentDue,deferredNotDueAmount:deferred,scheduleState:state,triggerState:trigger,nextTrancheCondition:'QA authoritative condition',financeStatus:state==='PAID'?'PAID':state==='DUE'?'DUE':'NOT_DUE',accountingClosureStatus:'OPEN',outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',sourceKind:'QA_FINANCE_CURRENT_STATE',authorityState:'FINANCE_CURRENT_STATE'});

const finance={
  paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',paymentScheduleContract:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1',
  incomingPayments:[payment('PAY-QA-004','USD',236250),payment('PAY-QA-005','USD',201750),payment('PAY-QA-006','USD',49320),payment('PAY-QA-UNALLOCATED','USD',11800)],
  incomingPaymentAllocations:[allocation('PAY-QA-004','DEAL-QA-004','USD',236250),allocation('PAY-QA-005','DEAL-QA-005','USD',201750),allocation('PAY-QA-006','DEAL-QA-006','USD',49320)],
  dealAllocationTotals:[{deal_id:'DEAL-QA-004',currency:'USD',allocated_amount:236250},{deal_id:'DEAL-QA-005',currency:'USD',allocated_amount:201750},{deal_id:'DEAL-QA-006',currency:'USD',allocated_amount:49320}],
  dealFinanceSummaries:[summary('DEAL-QA-004','USD',236250,'PAID'),summary('DEAL-QA-005','USD',672500),summary('DEAL-QA-006','USD',164400),summary('DEAL-QA-009','RUB',31002300)],
  paymentSchedules:[row('DEAL-QA-004','USD',236250,236250,0,0,0,'PAID','NOT_APPLICABLE'),row('DEAL-QA-005','USD',672500,201750,470750,0,470750,'DEFERRED_NOT_DUE'),row('DEAL-QA-006','USD',164400,49320,115080,0,115080,'DEFERRED_NOT_DUE')],
  paymentScheduleHolds:[{dealId:'DEAL-QA-009',currency:'RUB',scheduleState:'TO_VERIFY',financeStatus:'NOT_DUE',accountingClosureStatus:'OPEN',reason:'QA_RECONCILIATION'}],
  outgoingPayments:[{fact_id:'OUT-QA-KUZMASH',amount:16536960,currency:'RUB',deal_ids:['DEAL-QA-005','DEAL-QA-006'],deal_allocation_status:'TO_VERIFY'}]
};
const data=buildPaymentScheduleProjection(finance,'2026-09-12T17:00:00.000Z');
const d4=schedule(data,'DEAL-QA-004'),d5=schedule(data,'DEAL-QA-005'),d6=schedule(data,'DEAL-QA-006'),d9=schedule(data,'DEAL-QA-009');
assert(data.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2','dynamic schedule projection contract mismatch');
assert(data.sourceScheduleContract==='FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1','Finance schedule current-state contract missing');
assert(data.scheduleMaterialization==='DYNAMIC_FINANCE_CURRENT_STATE','projection is not dynamic Finance current-state');
assert(data.schedulePolicy.frontendCalculation===false&&data.schedulePolicy.candidateDealIdsAreAllocation===false&&data.schedulePolicy.proportionalSplit===false&&data.schedulePolicy.syntheticFx===false,'authority policy mismatch');
assert(d4?.projectionStatus==='AUTHORITATIVE'&&d4.scheduleState==='PAID'&&d4.remainingAmount===0,'paid schedule validation failed');
assert(d5?.projectionStatus==='AUTHORITATIVE'&&d5.verifiedReceivedAmount===201750&&d5.remainingAmount===470750&&d5.currentDueAmount===0&&d5.deferredNotDueAmount===470750&&d5.scheduleState==='DEFERRED_NOT_DUE','deferred schedule validation failed');
assert(d6?.projectionStatus==='AUTHORITATIVE'&&d6.triggerState==='NOT_CONFIRMED','trigger baseline validation failed');
assert(d9?.projectionStatus==='TO_VERIFY'&&d9.scheduleState==='TO_VERIFY'&&d9.obligationAmount===null,'hold must fail closed');
assert(d5.outgoingUsdEquivalent===null&&d5.outgoingUsdEquivalentStatus==='TO_VERIFY','FX was synthesized');

const dynamic=structuredClone(finance);
dynamic.incomingPayments.push(payment('PAY-QA-005-EXTRA','USD',50000));
dynamic.incomingPaymentAllocations.push(allocation('PAY-QA-005-EXTRA','DEAL-QA-005','USD',50000));
dynamic.dealAllocationTotals=dynamic.dealAllocationTotals.map(x=>x.deal_id==='DEAL-QA-005'?{...x,allocated_amount:251750}:x);
dynamic.paymentSchedules=dynamic.paymentSchedules.map(x=>x.dealId==='DEAL-QA-005'?row('DEAL-QA-005','USD',672500,251750,420750,0,420750,'DEFERRED_NOT_DUE'):x);
const dynamicData=buildPaymentScheduleProjection(dynamic,'2026-09-12T17:01:00.000Z');
assert(schedule(dynamicData,'DEAL-QA-005').verifiedReceivedAmount===251750&&schedule(dynamicData,'DEAL-QA-005').remainingAmount===420750,'new verified receipt did not propagate');

dynamic.paymentSchedules=dynamic.paymentSchedules.map(x=>['DEAL-QA-005','DEAL-QA-006'].includes(x.dealId)?{...x,scheduleState:'DUE',triggerState:'CONFIRMED',currentDueAmount:x.remainingAmount,deferredNotDueAmount:0,financeStatus:'DUE'}:x);
const triggered=buildPaymentScheduleProjection(dynamic,'2026-09-12T17:02:00.000Z');
assert(schedule(triggered,'DEAL-QA-005').scheduleState==='DUE'&&schedule(triggered,'DEAL-QA-005').currentDueAmount===420750&&schedule(triggered,'DEAL-QA-006').scheduleState==='DUE','GU trigger transition failed');

dynamic.paymentScheduleHolds=[];dynamic.paymentSchedules.push(row('DEAL-QA-009','RUB',31002300,0,31002300,0,31002300,'DEFERRED_NOT_DUE','NOT_APPLICABLE'));
const reconciled=buildPaymentScheduleProjection(dynamic,'2026-09-12T17:03:00.000Z');
assert(schedule(reconciled,'DEAL-QA-009').projectionStatus==='AUTHORITATIVE'&&schedule(reconciled,'DEAL-QA-009').remainingAmount===31002300,'reconciled deal did not leave TO_VERIFY');

const mismatch=structuredClone(dynamic);mismatch.dealAllocationTotals=mismatch.dealAllocationTotals.map(x=>x.deal_id==='DEAL-QA-005'?{...x,allocated_amount:1}:x);
assert(schedule(buildPaymentScheduleProjection(mismatch),'DEAL-QA-005').projectionStatus==='TO_VERIFY','allocation mismatch must fail closed');

const production=[projectionSource,financeServerSource,financeScheduleSource].join('\n');
assert(!projectionSource.includes('MATERIALIZED_SCHEDULES'),'production still depends on MATERIALIZED_SCHEDULES');
for(const forbidden of ['DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','DEAL-2026-009','236250','672500','164400','470750','115080'])assert(!production.includes(forbidden),`production contains static schedule fixture: ${forbidden}`);
assert(financeServerSource.includes('buildPaymentScheduleAuthority'),'Finance ai-sync does not build payment schedule authority');
assert(financeServerSource.includes('...paymentScheduleAuthority'),'Finance ai-sync does not publish schedule current-state');
assert(financeScheduleSource.includes("p.payload->>'proposed_field'='finance.payment_schedule'"),'approved Finance payment schedule source missing');
assert(financeScheduleSource.includes("x.status='APPROVE_FOR_NEXT_STAGE'"),'Operations approval boundary missing');
assert(financeScheduleSource.includes("r.functional_role::text in ('FINANCE','RAIL_LOGISTICS')"),'Finance/Rail explicit trigger source missing');
assert(financeScheduleSource.includes("r.payload ? 'payment_schedule_trigger'"),'structured payment schedule trigger missing');
assert(financeScheduleSource.includes("upper(a?.allocation_status)!=='VERIFIED'"),'VERIFIED allocation boundary missing in schedule materializer');
assert(financeScheduleSource.includes("upper(p?.bank_fact_status)!=='BANK_CONFIRMED'"),'BANK_CONFIRMED boundary missing in schedule materializer');
assert(!projectionSource.includes('.candidateDealIds')&&!financeScheduleSource.includes('.candidateDealIds'),'candidateDealIds used as allocation');
assert(!production.toLowerCase().includes('central bank')&&!production.toLowerCase().includes('market fx')&&!production.toLowerCase().includes('pricing fx'),'synthetic FX source detected');
assert(runtimeSource.includes("ENDPOINT='/portal/payment-schedule-current'"),'frontend does not consume trusted schedule endpoint');
assert(runtimeSource.includes("ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2"),'frontend does not require dynamic projection contract');
assert(!runtimeSource.includes('obligationAmount-')&&!runtimeSource.includes('verifiedReceivedAmount-'),'frontend schedule arithmetic detected');
assert(mainUiSource.includes("import paymentScheduleRuntime from './payment-schedule-runtime-v1.js'"),'schedule runtime not attached to Admin');

console.log('ADMIN_PAYMENTS_DYNAMIC_SCHEDULE_SOURCE_QA=PASS');
console.log('DYNAMIC_FINANCE_SCHEDULE_AUTHORITY=PASS');
console.log('PAYMENT_ALLOCATION_SEPARATION=PASS');
console.log('SENT_DOES_NOT_CREATE_DUE=PASS');
console.log('KUZMASH_NO_INFERRED_SPLIT=PASS');
console.log('FX_NO_SYNTHESIS=PASS');
