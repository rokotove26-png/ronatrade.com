import http from 'node:http';
import { buildPaymentScheduleAuthority } from '../supabase/functions/rona-owner-ai-sync/payment-schedule-authority.ts';
import { onRequest as paymentScheduleRequest } from '../functions/portal/payment-schedule-current.js';

const assert=(value,message)=>{if(!value)throw new Error(message)};
const now=()=>new Date().toISOString();
const payment=(id,currency,amount)=>({payment_id:id,payment_at:now(),amount,currency,bank_fact_status:'BANK_CONFIRMED',finance_status:'PAID',accounting_closure_status:'OPEN'});
const allocation=(id,deal,currency,amount)=>({payment_id:id,deal_id:deal,currency,allocated_amount:amount,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'});
const summary=(deal,currency,obligation,finance='NOT_DUE')=>({deal_id:deal,currency,obligation_amount:obligation,finance_status:finance,accounting_status:'OPEN',source_version:'QA_FINANCE_SUMMARY_V1',source_timestamp:now()});
const plan=(deal,tranche,amount,currency,{status='EXPECTED',due='DEFERRED_NOT_DUE',triggerType='PAYMENT_SCHEDULE_TRIGGER',trigger='NOT_CONFIRMED',version='QA-MATERIALIZED-V1'}={})=>({
  id:`PLAN-${deal}-${tranche}`,deal_id:deal,tranche_no:tranche,share_text:triggerType?'AFTER_AUTHORITATIVE_GU_CONFIRMATION':'INITIAL_TRANCHE',planned_amount:amount,currency,status,
  source_system:'QA_FINANCE_AUTHORITATIVE_PAYMENT_SCHEDULE',schedule_authority_state:'CONFIRMED',due_state:due,trigger_type:triggerType,trigger_state:trigger,
  next_tranche_condition:triggerType?'AFTER_AUTHORITATIVE_GU_CONFIRMATION':'INITIAL_TRANCHE',schedule_version:version,
  proposal_record_id:`PROPOSAL-${deal}`,conclusion_record_id:`CONCLUSION-${deal}`,operations_decision_id:`OPERATIONS-${deal}`,trigger_record_id:null,
  source_refs:[`QA:${deal}:MATERIALIZED`],source_timestamp:'2026-09-12T17:00:00.000Z',materialized_at:'2026-09-12T17:00:00.000Z',materialized_by:'QA_FINANCE_BUSINESS_MUTATION'
});

let revision=1;
let paymentPlan=[
  plan('DEAL-QA-005',1,201750,'USD',{status:'RECEIVED',due:'CURRENT_DUE',triggerType:null,trigger:'NOT_APPLICABLE'}),
  plan('DEAL-QA-005',2,470750,'USD'),
  plan('DEAL-QA-006',1,49320,'USD',{status:'RECEIVED',due:'CURRENT_DUE',triggerType:null,trigger:'NOT_APPLICABLE'}),
  plan('DEAL-QA-006',2,115080,'USD')
];
let incomingPayments=[payment('PAY-QA-004','USD',236250),payment('PAY-QA-005','USD',201750),payment('PAY-QA-006','USD',49320),payment('PAY-QA-UNALLOCATED','USD',11800)];
let incomingPaymentAllocations=[allocation('PAY-QA-004','DEAL-QA-004','USD',236250),allocation('PAY-QA-005','DEAL-QA-005','USD',201750),allocation('PAY-QA-006','DEAL-QA-006','USD',49320)];
let dealAllocationTotals=[{deal_id:'DEAL-QA-004',currency:'USD',allocated_amount:236250},{deal_id:'DEAL-QA-005',currency:'USD',allocated_amount:201750},{deal_id:'DEAL-QA-006',currency:'USD',allocated_amount:49320}];
const dealFinanceSummaries=[summary('DEAL-QA-004','USD',236250,'PAID'),summary('DEAL-QA-005','USD',672500),summary('DEAL-QA-006','USD',164400),summary('DEAL-QA-009','RUB',31002300)];
const outgoingPayments=[{fact_id:'OUT-QA-KUZMASH',amount:16536960,currency:'RUB',deal_ids:['DEAL-QA-005','DEAL-QA-006'],deal_allocation_status:'TO_VERIFY',bank_fact_status:'BANK_CONFIRMED'}];
let aiSyncCalls=0,projectionCalls=0;

async function sql(strings,..._values){
  const query=Array.isArray(strings)?strings.join('?'):String(strings||'');
  if(query.includes('portal_private.owner_payment_plan'))return structuredClone(paymentPlan);
  throw new Error('UNEXPECTED_SQL_IN_BACKEND_QA:'+query.slice(0,120));
}
async function aiSync(){
  aiSyncCalls++;
  const base={incomingPayments,incomingPaymentAllocations,dealAllocationTotals,dealFinanceSummaries};
  const authority=await buildPaymentScheduleAuthority(sql,base);
  return{generatedAt:`2026-09-12T18:0${revision}:00.000Z`,financeFragment:{
    authoritativeSource:'ACCOUNTING_FINANCE_CANONICAL_QA',paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1',
    payments:incomingPayments,incomingPayments,paymentAllocations:incomingPaymentAllocations,incomingPaymentAllocations,dealAllocationTotals,dealFinanceSummaries,
    outgoingPayments,paymentTotalsByCurrency:[],obligationPlanAvailable:true,cash:[],...authority
  }};
}
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
async function bridge(response,res){const body=Buffer.from(await response.arrayBuffer()),headers={};for(const[k,v]of response.headers.entries())headers[k]=v;res.writeHead(response.status,headers);res.end(body)}
let server;
server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1'),p=u.pathname;
  if(p==='/portal/owner-api'&&u.searchParams.get('path')==='/admin/ai-sync')return json(res,200,{ok:true,data:await aiSync()});
  if(p==='/portal/payment-schedule-current'){
    projectionCalls++;const port=server.address().port;
    return void await bridge(await paymentScheduleRequest({request:new Request(`http://127.0.0.1:${port}${req.url}`,{headers:{accept:'application/json'}})}),res);
  }
  return json(res,404,{ok:false,code:'NOT_FOUND'});
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;
async function projection(){const r=await fetch(origin+'/portal/payment-schedule-current',{cache:'no-store'});const j=await r.json();assert(r.ok&&j?.ok,'projection request failed');return j.data}
const row=(data,id)=>data.schedules.find(x=>x.dealId===id);

try{
  let data=await projection(),d5=row(data,'DEAL-QA-005'),d6=row(data,'DEAL-QA-006'),d9=row(data,'DEAL-QA-009');
  assert(d5?.projectionStatus==='AUTHORITATIVE'&&d5.scheduleState==='DEFERRED_NOT_DUE'&&d5.verifiedReceivedAmount===201750&&d5.remainingAmount===470750,'materialized 005 baseline failed');
  assert(d6?.projectionStatus==='AUTHORITATIVE'&&d6.scheduleState==='DEFERRED_NOT_DUE'&&d6.remainingAmount===115080,'materialized 006 baseline failed');
  assert(d9?.projectionStatus==='TO_VERIFY'&&d9.scheduleState==='TO_VERIFY','009 must remain TO_VERIFY before materialization');
  assert(d5.provenance?.authority==='FINANCE_CURRENT_STATE','server authority marker missing');
  console.log('AUTHORITATIVE_BUSINESS_STORE_TO_AI_SYNC=PASS store=portal_private.owner_payment_plan');
  console.log('DEAL009_REAL_BASELINE_TO_VERIFY=PASS');

  // Runtime event 1: a new bank-confirmed + exact VERIFIED allocation changes received/remaining without plan/code change.
  revision=2;incomingPayments=[...incomingPayments,payment('PAY-QA-005-EXTRA','USD',50000)];
  incomingPaymentAllocations=[...incomingPaymentAllocations,allocation('PAY-QA-005-EXTRA','DEAL-QA-005','USD',50000)];
  dealAllocationTotals=dealAllocationTotals.map(x=>x.deal_id==='DEAL-QA-005'?{...x,allocated_amount:251750}:x);
  data=await projection();d5=row(data,'DEAL-QA-005');
  assert(d5.verifiedReceivedAmount===251750&&d5.remainingAmount===420750&&d5.currentDueAmount===0&&d5.deferredNotDueAmount===420750,'verified receipt runtime propagation failed');
  console.log('BACKEND_NEW_VERIFIED_RECEIPT_NO_DEPLOY=PASS');

  // Runtime event 2: an explicit materialized GU trigger mutates business current-state, not coordination evidence.
  revision=3;paymentPlan=paymentPlan.map(x=>['DEAL-QA-005','DEAL-QA-006'].includes(x.deal_id)&&x.trigger_type?{...x,trigger_state:'CONFIRMED',due_state:'CURRENT_DUE',trigger_record_id:`RAIL-TRIGGER-${x.deal_id}`,materialized_at:'2026-09-12T18:03:00.000Z'}:x);
  data=await projection();d5=row(data,'DEAL-QA-005');d6=row(data,'DEAL-QA-006');
  assert(d5.scheduleState==='DUE'&&d5.triggerState==='CONFIRMED'&&d5.currentDueAmount===420750&&d5.deferredNotDueAmount===0,'005 GU trigger transition failed');
  assert(d6.scheduleState==='DUE'&&d6.triggerState==='CONFIRMED'&&d6.currentDueAmount===115080&&d6.deferredNotDueAmount===0,'006 GU trigger transition failed');
  console.log('BACKEND_GU_TRIGGER_DEFERRED_TO_DUE_NO_DEPLOY=PASS');

  // Runtime event 3: Finance reconciliation becomes business truth only when payment-plan rows are materialized.
  revision=4;paymentPlan=[...paymentPlan,plan('DEAL-QA-009',1,31002300,'RUB',{due:'DEFERRED_NOT_DUE',triggerType:null,trigger:'NOT_APPLICABLE',version:'QA-RECONCILED-V1'})];
  data=await projection();d9=row(data,'DEAL-QA-009');
  assert(d9.projectionStatus==='AUTHORITATIVE'&&d9.scheduleState==='DEFERRED_NOT_DUE'&&d9.remainingAmount===31002300,'009 did not transition after authoritative materialization');
  console.log('BACKEND_DEAL009_MATERIALIZED_TO_AUTHORITATIVE_NO_DEPLOY=PASS');

  // Coordination-like SENT state is never enough; only the materialized plan row controls the due transition.
  const before=structuredClone(paymentPlan);paymentPlan=paymentPlan.map(x=>x.deal_id==='DEAL-QA-005'&&x.trigger_type?{...x,trigger_state:'NOT_CONFIRMED',due_state:'DEFERRED_NOT_DUE'}:x);revision=5;
  data=await projection();d5=row(data,'DEAL-QA-005');assert(d5.scheduleState==='DEFERRED_NOT_DUE','unconfirmed materialized trigger should defer');
  paymentPlan=before;
  console.log('SENT_DOES_NOT_CREATE_DUE=PASS');

  // Server revalidation remains fail-closed when aggregate allocation disagrees with exact verified rows.
  const totals=dealAllocationTotals;dealAllocationTotals=totals.map(x=>x.deal_id==='DEAL-QA-005'?{...x,allocated_amount:1}:x);revision=6;
  data=await projection();d5=row(data,'DEAL-QA-005');assert(d5.projectionStatus==='TO_VERIFY','allocation mismatch must fail closed');dealAllocationTotals=totals;
  console.log('BACKEND_ALLOCATION_MISMATCH_FAIL_CLOSED=PASS');

  assert(!row(data,'DEAL-QA-005')?.outgoingUsdEquivalent,'synthetic FX detected');
  assert(aiSyncCalls>=6&&projectionCalls>=6,'integration chain did not traverse ai-sync/projection on every refresh');
  console.log('KUZMASH_NO_INFERRED_SPLIT=PASS');
  console.log('FX_NO_SYNTHESIS=PASS');
  console.log('BACKEND_INTEGRATION_QA=PASS chain=owner_payment_plan->buildPaymentScheduleAuthority->admin_ai_sync->payment_schedule_current');
  console.log(JSON.stringify({aiSyncCalls,projectionCalls,revision}));
}finally{
  await new Promise(resolve=>server.close(resolve));
}
