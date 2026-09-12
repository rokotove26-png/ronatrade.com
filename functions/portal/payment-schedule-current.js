const SCHEDULE_PROJECTION_CONTRACT='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V1';
const FINANCE_PROJECTION_CONTRACT='ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1';
const FINANCE_GOVERNANCE_REF='81609307-26e7-4366-874f-b882df88656d';

const MATERIALIZED_SCHEDULES=Object.freeze([
  Object.freeze({
    dealId:'DEAL-2026-004',currency:'USD',paymentId:'PAYEV-2026-000001',
    obligationAmount:236250,verifiedReceivedAmount:236250,remainingAmount:0,currentDueAmount:0,deferredNotDueAmount:0,
    scheduleState:'PAID',triggerState:'NOT_APPLICABLE',nextTrancheCondition:'Исполнено',
    financeProposalId:null,financeConclusionId:null,operationsDecisionId:null
  }),
  Object.freeze({
    dealId:'DEAL-2026-005',currency:'USD',paymentId:'PAYEV-2026-000002',
    obligationAmount:672500,verifiedReceivedAmount:201750,remainingAmount:470750,currentDueAmount:0,deferredNotDueAmount:470750,
    scheduleState:'DEFERRED_NOT_DUE',triggerState:'NOT_CONFIRMED',
    nextTrancheCondition:'После выдачи/подтверждения согласованной GU transportation application и до отгрузки',
    financeProposalId:'0dddcff8-99d7-4a51-bd23-2ba02b8d8cc3',financeConclusionId:'6d1cac49-e5b6-49f6-8282-9bc37f6e8e97',operationsDecisionId:'b291371f-4d6e-4bc5-8aa8-bb801bf90b43'
  }),
  Object.freeze({
    dealId:'DEAL-2026-006',currency:'USD',paymentId:'PAYEV-2026-000003',
    obligationAmount:164400,verifiedReceivedAmount:49320,remainingAmount:115080,currentDueAmount:0,deferredNotDueAmount:115080,
    scheduleState:'DEFERRED_NOT_DUE',triggerState:'NOT_CONFIRMED',
    nextTrancheCondition:'После выдачи/подтверждения согласованной GU transportation application и до отгрузки',
    financeProposalId:'f2912b70-df16-4d77-956d-9a247c3823dd',financeConclusionId:'e72308be-3b07-4033-812a-329db4682404',operationsDecisionId:'dc2f028e-e57f-4b8e-b410-7e0373461a6d'
  })
]);

const asArray=value=>Array.isArray(value)?value:[];
const asNumber=value=>{const n=Number(value);return Number.isFinite(n)?n:null};
const eqAmount=(a,b)=>{const x=asNumber(a),y=asNumber(b);return x!==null&&y!==null&&Math.abs(x-y)<0.000001};
const normalize=value=>String(value??'').trim().toUpperCase();

function financeSummary(finance,dealId){return asArray(finance?.dealFinanceSummaries).find(row=>String(row?.deal_id||'')===dealId)||null}
function dealState(deals,dealId){return asArray(deals).find(row=>String(row?.deal_id||'')===dealId)||null}
function allocationTotal(finance,spec){return asArray(finance?.dealAllocationTotals).find(row=>String(row?.deal_id||'')===spec.dealId&&String(row?.currency||'')===spec.currency)||null}
function paymentAllocation(finance,spec){return asArray(finance?.incomingPaymentAllocations).find(row=>String(row?.payment_id||'')===spec.paymentId&&String(row?.deal_id||'')===spec.dealId&&String(row?.currency||'')===spec.currency&&normalize(row?.allocation_status)==='VERIFIED')||null}
function incomingPayment(finance,spec){return asArray(finance?.incomingPayments).find(row=>String(row?.payment_id||'')===spec.paymentId&&String(row?.currency||'')===spec.currency&&normalize(row?.bank_fact_status)==='BANK_CONFIRMED')||null}

function failClosedSchedule(spec,summary,deal,errors){
  return{
    dealId:spec.dealId,currency:spec.currency,paymentId:spec.paymentId,
    obligationAmount:null,verifiedReceivedAmount:null,remainingAmount:null,currentDueAmount:null,deferredNotDueAmount:null,
    scheduleState:'TO_VERIFY',triggerState:'TO_VERIFY',nextTrancheCondition:'TO_VERIFY',projectionStatus:'TO_VERIFY',
    bankFactStatus:'TO_VERIFY',allocationStatus:'TO_VERIFY',
    financeStatus:deal?.finance_status??summary?.finance_status??null,
    accountingClosureStatus:deal?.accounting_closure_status??summary?.accounting_closure_status??summary?.accounting_status??null,
    outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
    validationErrors:errors,
    provenance:{authority:'FINANCE',financeGovernanceRef:FINANCE_GOVERNANCE_REF,financeProposalId:spec.financeProposalId,financeConclusionId:spec.financeConclusionId,operationsDecisionId:spec.operationsDecisionId}
  };
}

function authoritativeSchedule(finance,deals,spec){
  const summary=financeSummary(finance,spec.dealId),deal=dealState(deals,spec.dealId),total=allocationTotal(finance,spec),allocation=paymentAllocation(finance,spec),payment=incomingPayment(finance,spec),errors=[];
  if(String(finance?.paymentProjectionContract||'')!==FINANCE_PROJECTION_CONTRACT)errors.push('FINANCE_PROJECTION_CONTRACT_MISMATCH');
  if(!summary)errors.push('FINANCE_SUMMARY_MISSING');
  if(summary&&!eqAmount(summary.obligation_amount,spec.obligationAmount))errors.push('OBLIGATION_MISMATCH');
  if(summary&&!eqAmount(summary.received_amount,spec.verifiedReceivedAmount))errors.push('SUMMARY_RECEIVED_MISMATCH');
  if(summary&&!eqAmount(summary.client_remaining_amount,spec.remainingAmount))errors.push('SUMMARY_REMAINING_MISMATCH');
  if(!total||!eqAmount(total.allocated_amount,spec.verifiedReceivedAmount))errors.push('VERIFIED_DEAL_ALLOCATION_TOTAL_MISMATCH');
  if(!allocation||!eqAmount(allocation.allocated_amount,spec.verifiedReceivedAmount))errors.push('VERIFIED_PAYMENT_ALLOCATION_MISMATCH');
  if(!payment)errors.push('BANK_CONFIRMED_PAYMENT_MISSING');
  if(errors.length)return failClosedSchedule(spec,summary,deal,errors);
  return{
    dealId:spec.dealId,currency:spec.currency,paymentId:spec.paymentId,
    obligationAmount:spec.obligationAmount,verifiedReceivedAmount:spec.verifiedReceivedAmount,remainingAmount:spec.remainingAmount,
    currentDueAmount:spec.currentDueAmount,deferredNotDueAmount:spec.deferredNotDueAmount,
    scheduleState:spec.scheduleState,triggerState:spec.triggerState,nextTrancheCondition:spec.nextTrancheCondition,projectionStatus:'AUTHORITATIVE',
    bankFactStatus:'BANK_CONFIRMED',allocationStatus:'VERIFIED',
    financeStatus:deal?.finance_status??summary?.finance_status??null,
    accountingClosureStatus:deal?.accounting_closure_status??summary?.accounting_closure_status??summary?.accounting_status??null,
    outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
    triggerPolicy:spec.dealId==='DEAL-2026-005'||spec.dealId==='DEAL-2026-006'?'SENT_DOES_NOT_CONFIRM_GU_TRIGGER':'NOT_APPLICABLE',
    provenance:{authority:'FINANCE',financeGovernanceRef:FINANCE_GOVERNANCE_REF,financeProposalId:spec.financeProposalId,financeConclusionId:spec.financeConclusionId,operationsDecisionId:spec.operationsDecisionId}
  };
}

function failClosedDeal009(finance,deals){
  const summary=financeSummary(finance,'DEAL-2026-009'),deal=dealState(deals,'DEAL-2026-009');
  return{
    dealId:'DEAL-2026-009',currency:summary?.currency??null,paymentId:null,
    obligationAmount:null,verifiedReceivedAmount:null,remainingAmount:null,currentDueAmount:null,deferredNotDueAmount:null,
    scheduleState:'TO_VERIFY',triggerState:'TO_VERIFY',nextTrancheCondition:'Finance reconciliation required',projectionStatus:'TO_VERIFY',
    bankFactStatus:'TO_VERIFY',allocationStatus:'TO_VERIFY',
    financeStatus:deal?.finance_status??summary?.finance_status??null,
    accountingClosureStatus:deal?.accounting_closure_status??summary?.accounting_closure_status??summary?.accounting_status??null,
    outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
    validationErrors:['FINANCE_RECONCILIATION_PENDING'],
    provenance:{authority:'FINANCE',financeConclusionId:'18f3f8dd-7438-4d9f-b057-f3e5e19c5050'}
  };
}

function scheduleTotals(schedules){
  const map=new Map();
  for(const row of schedules){
    if(row?.projectionStatus!=='AUTHORITATIVE'||!row?.currency)continue;
    const key=String(row.currency),current=asNumber(row.currentDueAmount),deferred=asNumber(row.deferredNotDueAmount);
    if(current===null||deferred===null)continue;
    const prev=map.get(key)||{currency:key,currentDueAmount:0,deferredNotDueAmount:0};
    prev.currentDueAmount+=current;prev.deferredNotDueAmount+=deferred;map.set(key,prev);
  }
  return [...map.values()];
}

export function buildPaymentScheduleProjection(financeFragment,deals=[],generatedAt=new Date().toISOString()){
  const schedules=MATERIALIZED_SCHEDULES.map(spec=>authoritativeSchedule(financeFragment,deals,spec));
  schedules.push(failClosedDeal009(financeFragment,deals));
  return{
    generatedAt,
    projectionContract:SCHEDULE_PROJECTION_CONTRACT,
    sourceProjectionContract:String(financeFragment?.paymentProjectionContract||''),
    authority:'FINANCE',
    scheduleMaterialization:'PAYMENT_SCHEDULE_2026-09-12_V1',
    schedulePolicy:{frontendCalculation:false,candidateDealIdsAreAllocation:false,proportionalSplit:false,syntheticFx:false,sentApplicationCreatesDue:false},
    schedules,
    totalsByCurrency:scheduleTotals(schedules)
  };
}

function responseHeaders(base){const headers=new Headers(base||{});headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store, no-cache, must-revalidate');headers.set('pragma','no-cache');headers.set('x-rona-payment-schedule',SCHEDULE_PROJECTION_CONTRACT);return headers}
async function fetchTrusted(request,path){const target=new URL('/portal/owner-api',request.url);target.searchParams.set('path',path);const headers=new Headers({accept:'application/json'}),cookie=request.headers.get('cookie');if(cookie)headers.set('cookie',cookie);const requestId=request.headers.get('x-request-id');if(requestId)headers.set('x-request-id',requestId);return fetch(target,{method:'GET',headers,cache:'no-store'})}

export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:responseHeaders()});
  const [syncResponse,bootstrapResponse]=await Promise.all([fetchTrusted(request,'/admin/ai-sync'),fetchTrusted(request,'/admin/bootstrap')]);
  if(!syncResponse.ok||!bootstrapResponse.ok){const status=syncResponse.status===401||bootstrapResponse.status===401?401:502;return new Response(JSON.stringify({ok:false,code:'PAYMENT_SCHEDULE_SOURCE_UNAVAILABLE'}),{status,headers:responseHeaders()})}
  const [syncPayload,bootstrapPayload]=await Promise.all([syncResponse.json().catch(()=>null),bootstrapResponse.json().catch(()=>null)]);
  const finance=syncPayload?.data?.financeFragment,deals=asArray(bootstrapPayload?.data?.deals);
  if(!finance||typeof finance!=='object')return new Response(JSON.stringify({ok:false,code:'FINANCE_PROJECTION_MISSING'}),{status:502,headers:responseHeaders()});
  const data=buildPaymentScheduleProjection(finance,deals,syncPayload?.data?.generatedAt||new Date().toISOString());
  return new Response(JSON.stringify({ok:true,data}),{status:200,headers:responseHeaders()});
}
