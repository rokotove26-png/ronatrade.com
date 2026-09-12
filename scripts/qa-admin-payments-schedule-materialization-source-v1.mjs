import { readFile } from 'node:fs/promises';
import { buildPaymentScheduleProjection } from '../functions/portal/payment-schedule-current.js';

const projectionSource=await readFile('functions/portal/payment-schedule-current.js','utf8');
const runtimeSource=await readFile('functions/portal/main-ui/payment-schedule-runtime-v1.js','utf8');
const mainUiSource=await readFile('functions/portal/main-ui/index.js','utf8');
const aiSyncSource=await readFile('supabase/functions/rona-owner-ai-sync/index.ts','utf8');
const authoritySource=await readFile('supabase/functions/rona-owner-ai-sync/payment-schedule-authority.ts','utf8');
const migrationSource=await readFile('supabase/migrations/20260912183500_finance_payment_schedule_authoritative_store_v1.sql','utf8');
const backendQaSource=await readFile('scripts/qa-admin-payments-schedule-backend-integration-v1.mjs','utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const schedule=(data,id)=>data.schedules.find(x=>x.dealId===id);
const allocation=(paymentId,dealId,currency,amount)=>({payment_id:paymentId,deal_id:dealId,currency,allocated_amount:amount,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'});
const payment=(paymentId,currency,amount)=>({payment_id:paymentId,currency,amount,bank_fact_status:'BANK_CONFIRMED'});
const summary=(dealId,currency,obligation,financeStatus='NOT_DUE')=>({deal_id:dealId,currency,obligation_amount:obligation,finance_status:financeStatus,accounting_status:'OPEN'});
const row=(dealId,currency,obligation,received,remaining,currentDue,deferred,state,trigger='NOT_CONFIRMED')=>({
  dealId,currency,obligationAmount:obligation,verifiedReceivedAmount:received,remainingAmount:remaining,currentDueAmount:currentDue,deferredNotDueAmount:deferred,
  scheduleState:state,triggerState:trigger,nextTrancheCondition:'QA authoritative condition',financeStatus:state==='PAID'?'PAID':state==='DUE'?'DUE':'NOT_DUE',accountingClosureStatus:'OPEN',
  outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',sourceKind:state==='PAID'?'FINANCE_PAID_CURRENT_STATE':'FINANCE_PAYMENT_PLAN_MATERIALIZED',sourceRecordId:'QA-PLAN-'+dealId,
  proposalRecordId:'QA-PROPOSAL-'+dealId,conclusionRecordId:'QA-CONCLUSION-'+dealId,operationsDecisionId:'QA-OPS-'+dealId,sourceVersion:'QA-V1',sourceTimestamp:'2026-09-12T18:00:00.000Z',materializedAt:'2026-09-12T18:00:00.000Z',sourceRefs:['QA']
});

const finance={paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',paymentScheduleContract:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1',
  incomingPayments:[payment('PAY-QA-004','USD',236250),payment('PAY-QA-005','USD',201750),payment('PAY-QA-006','USD',49320),payment('PAY-QA-UNALLOCATED','USD',11800)],
  incomingPaymentAllocations:[allocation('PAY-QA-004','DEAL-QA-004','USD',236250),allocation('PAY-QA-005','DEAL-QA-005','USD',201750),allocation('PAY-QA-006','DEAL-QA-006','USD',49320)],
  dealAllocationTotals:[{deal_id:'DEAL-QA-004',currency:'USD',allocated_amount:236250},{deal_id:'DEAL-QA-005',currency:'USD',allocated_amount:201750},{deal_id:'DEAL-QA-006',currency:'USD',allocated_amount:49320}],
  dealFinanceSummaries:[summary('DEAL-QA-004','USD',236250,'PAID'),summary('DEAL-QA-005','USD',672500),summary('DEAL-QA-006','USD',164400),summary('DEAL-QA-009','RUB',31002300)],
  paymentSchedules:[row('DEAL-QA-004','USD',236250,236250,0,0,0,'PAID','NOT_APPLICABLE'),row('DEAL-QA-005','USD',672500,201750,470750,0,470750,'DEFERRED_NOT_DUE'),row('DEAL-QA-006','USD',164400,49320,115080,0,115080,'DEFERRED_NOT_DUE')],
  paymentScheduleHolds:[{dealId:'DEAL-QA-009',currency:'RUB',financeStatus:'NOT_DUE',accountingClosureStatus:'OPEN',reason:'FINANCE_PAYMENT_SCHEDULE_NOT_MATERIALIZED'}],
  outgoingPayments:[{fact_id:'OUT-QA-KUZMASH',amount:16536960,currency:'RUB',deal_ids:['DEAL-QA-005','DEAL-QA-006'],deal_allocation_status:'TO_VERIFY'}]};
const data=buildPaymentScheduleProjection(finance,'2026-09-12T18:00:00.000Z');
const d4=schedule(data,'DEAL-QA-004'),d5=schedule(data,'DEAL-QA-005'),d6=schedule(data,'DEAL-QA-006'),d9=schedule(data,'DEAL-QA-009');
assert(data.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2','projection contract mismatch');
assert(data.scheduleMaterialization==='MATERIALIZED_FINANCE_BUSINESS_CURRENT_STATE','business materialization marker missing');
assert(d4?.projectionStatus==='AUTHORITATIVE'&&d4.scheduleState==='PAID','paid projection failed');
assert(d5?.projectionStatus==='AUTHORITATIVE'&&d5.remainingAmount===470750&&d5.currentDueAmount===0&&d5.deferredNotDueAmount===470750,'deferred projection failed');
assert(d6?.projectionStatus==='AUTHORITATIVE'&&d6.triggerState==='NOT_CONFIRMED','trigger projection failed');
assert(d9?.projectionStatus==='TO_VERIFY'&&d9.obligationAmount===null,'unmaterialized 009 must fail closed');
assert(d5.provenance?.proposalRecordId==='QA-PROPOSAL-DEAL-QA-005'&&d5.provenance?.operationsDecisionId==='QA-OPS-DEAL-QA-005','provenance lost in server projection');
assert(d5.outgoingUsdEquivalent===null&&d5.outgoingUsdEquivalentStatus==='TO_VERIFY','FX synthesized');

const production=[projectionSource,authoritySource].join('\n');
assert(!production.includes('MATERIALIZED_SCHEDULES'),'production still depends on MATERIALIZED_SCHEDULES');
for(const forbidden of ['DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','DEAL-2026-009','236250','672500','164400','470750','115080'])assert(!production.includes(forbidden),`runtime production source contains static schedule fixture: ${forbidden}`);
assert(authoritySource.includes('from portal_private.owner_payment_plan p'),'builder does not read canonical payment-plan business store');
assert(authoritySource.includes("p.schedule_authority_state='CONFIRMED'"),'builder does not require materialized schedule authority');
assert(authoritySource.includes("sourceKind:'FINANCE_PAYMENT_PLAN_MATERIALIZED'"),'builder does not mark materialized business source');
assert(!authoritySource.includes('ai_coordination_records'),'builder still promotes coordination evidence to business truth');
assert(!authoritySource.includes('APPROVE_FOR_NEXT_STAGE'),'builder still treats approval decision as mutation authority');
assert(aiSyncSource.includes('buildPaymentScheduleAuthority(sql,{incomingPayments,incomingPaymentAllocations,dealAllocationTotals,dealFinanceSummaries})'),'ai-sync is not wired to live materialized builder');
assert(aiSyncSource.includes('...paymentScheduleAuthority'),'ai-sync does not publish builder current-state');

for(const marker of ['alter table portal_private.owner_payment_plan','schedule_authority_state','proposal_record_id','conclusion_record_id','operations_decision_id','source_refs','source_timestamp','materialized_at','finance_materialize_payment_schedule(','finance_materialize_payment_schedule_trigger(','OWNER_AUTHORIZED_PR461_MIGRATION','DEAL-2026-009 intentionally remains unmaterialized'])assert(migrationSource.includes(marker),`materialization migration missing ${marker}`);
assert(migrationSource.includes('APPROVE_FOR_NEXT_STAGE is never mutation authority'),'migration authority boundary not documented');
for(const forbidden of ['236250','672500','164400','470750','115080','31002300'])assert(!migrationSource.includes(forbidden),`migration contains static payment amount ${forbidden}`);
assert(migrationSource.includes("if v_state='SENT' then raise exception"),'SENT trigger mutation guard missing');

assert(projectionSource.includes("bank_fact_status)!=='BANK_CONFIRMED'"),'BANK_CONFIRMED validation missing');
assert(projectionSource.includes("allocation_status)!=='VERIFIED'"),'VERIFIED allocation validation missing');
assert(projectionSource.includes('VERIFIED_PAYMENT_ALLOCATION_SUM_MISMATCH'),'exact allocation sum validation missing');
assert(!projectionSource.includes('.candidateDealIds')&&!authoritySource.includes('.candidateDealIds'),'candidateDealIds used as allocation');
assert(!production.toLowerCase().includes('central bank')&&!production.toLowerCase().includes('market fx')&&!production.toLowerCase().includes('pricing fx'),'synthetic FX source detected');
assert(runtimeSource.includes("ENDPOINT='/portal/payment-schedule-current'"),'frontend does not consume trusted endpoint');
assert(!runtimeSource.includes('obligationAmount-')&&!runtimeSource.includes('verifiedReceivedAmount-'),'frontend payment arithmetic detected');
assert(mainUiSource.includes("import paymentScheduleRuntime from './payment-schedule-runtime-v1.js'"),'schedule runtime not attached');
assert(backendQaSource.includes('buildPaymentScheduleAuthority')&&backendQaSource.includes("'/admin/ai-sync'")&&backendQaSource.includes('paymentScheduleRequest'),'backend integration chain QA missing');

console.log('ADMIN_PAYMENTS_MATERIALIZED_BUSINESS_SCHEDULE_SOURCE_QA=PASS');
console.log('AUTHORITATIVE_BUSINESS_STORE=PASS store=portal_private.owner_payment_plan');
console.log('COORDINATION_RECORDS_PROVENANCE_ONLY=PASS');
console.log('PAYMENT_ALLOCATION_SEPARATION=PASS');
console.log('SENT_DOES_NOT_CREATE_DUE=PASS');
console.log('KUZMASH_NO_INFERRED_SPLIT=PASS');
console.log('FX_NO_SYNTHESIS=PASS');
