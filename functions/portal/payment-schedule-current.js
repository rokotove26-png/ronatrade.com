const SCHEDULE_PROJECTION_CONTRACT='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2';
const FINANCE_PROJECTION_CONTRACT='ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1';
const FINANCE_SCHEDULE_CONTRACT='FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1';

const asArray=value=>Array.isArray(value)?value:[];
const asNumber=value=>{const n=Number(value);return Number.isFinite(n)?n:null};
const eqAmount=(a,b)=>{const x=asNumber(a),y=asNumber(b);return x!==null&&y!==null&&Math.abs(x-y)<0.000001};
const normalize=value=>String(value??'').trim().toUpperCase();
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;

function financeSummary(finance,dealId){return asArray(finance?.dealFinanceSummaries).find(row=>String(row?.deal_id||'')===dealId)||null}
function dealAllocationTotal(finance,dealId,currency){return asArray(finance?.dealAllocationTotals).find(row=>String(row?.deal_id||'')===dealId&&normalize(row?.currency)===currency)||null}
function bankPaymentMap(finance){const map=new Map();for(const row of asArray(finance?.incomingPayments)){if(normalize(row?.bank_fact_status)!=='BANK_CONFIRMED')continue;map.set(String(row?.payment_id||''),row)}return map}
function verifiedAllocations(finance,dealId,currency){
  const bank=bankPaymentMap(finance),rows=[];
  for(const row of asArray(finance?.incomingPaymentAllocations)){
    if(String(row?.deal_id||'')!==dealId||normalize(row?.currency)!==currency)continue;
    if(normalize(row?.allocation_status)!=='VERIFIED'||!['CONFIRMED','VERIFIED'].includes(normalize(row?.authority_state))||!normalize(row?.source_system).includes('RECONCIL')||!String(row?.source_version||'').trim()||!row?.source_timestamp)continue;
    const payment=bank.get(String(row?.payment_id||''));if(!payment||normalize(payment?.currency)!==currency)continue;
    const amount=asNumber(row?.allocated_amount);if(amount===null||amount<0)continue;rows.push({paymentId:String(row.payment_id),amount});
  }
  return{rows,total:round(rows.reduce((sum,row)=>sum+row.amount,0)),paymentIds:[...new Set(rows.map(row=>row.paymentId))]};
}
function rowProvenance(row){return{authority:'FINANCE_CURRENT_STATE',sourceKind:row?.sourceKind??null,sourceRecordId:row?.sourceRecordId??null,
  proposalRecordId:row?.proposalRecordId??null,conclusionRecordId:row?.conclusionRecordId??null,operationsDecisionId:row?.operationsDecisionId??row?.sourceDecisionRecordId??null,
  triggerRecordId:row?.triggerRecordId??null,sourceVersion:row?.sourceVersion??null,sourceTimestamp:row?.sourceTimestamp??null,materializedAt:row?.materializedAt??null,sourceRefs:asArray(row?.sourceRefs)}}
function failClosed(row,finance,errors){
  const dealId=String(row?.dealId||''),summary=financeSummary(finance,dealId);
  return{dealId,currency:null,paymentIds:[],obligationAmount:null,verifiedReceivedAmount:null,remainingAmount:null,currentDueAmount:null,deferredNotDueAmount:null,
    scheduleState:'TO_VERIFY',triggerState:'TO_VERIFY',nextTrancheCondition:'TO_VERIFY',projectionStatus:'TO_VERIFY',bankFactStatus:'TO_VERIFY',allocationStatus:'TO_VERIFY',
    financeStatus:'TO_VERIFY',accountingClosureStatus:row?.accountingClosureStatus??summary?.accounting_status??null,
    outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',validationErrors:errors,provenance:rowProvenance(row)};
}
function validateAuthoritativeRow(finance,row){
  const dealId=String(row?.dealId||''),currency=normalize(row?.currency),summary=financeSummary(finance,dealId),verified=verifiedAllocations(finance,dealId,currency),aggregate=dealAllocationTotal(finance,dealId,currency),errors=[];
  const obligation=asNumber(row?.obligationAmount),received=asNumber(row?.verifiedReceivedAmount),remaining=asNumber(row?.remainingAmount),currentDue=asNumber(row?.currentDueAmount),deferred=asNumber(row?.deferredNotDueAmount),state=normalize(row?.scheduleState),trigger=normalize(row?.triggerState);
  if(!dealId)errors.push('DEAL_ID_MISSING');if(!currency)errors.push('CURRENCY_MISSING');if(obligation===null||obligation<0)errors.push('OBLIGATION_INVALID');if(received===null||received<0)errors.push('VERIFIED_RECEIVED_INVALID');
  if(remaining===null||remaining<0)errors.push('REMAINING_INVALID');if(currentDue===null||currentDue<0)errors.push('CURRENT_DUE_INVALID');if(deferred===null||deferred<0)errors.push('NOT_DUE_INVALID');
  if(!summary)errors.push('FINANCE_SUMMARY_MISSING');if(summary&&normalize(summary.currency)!==currency)errors.push('SUMMARY_CURRENCY_MISMATCH');if(summary&&!eqAmount(summary.obligation_amount,obligation))errors.push('SUMMARY_OBLIGATION_MISMATCH');
  if(!eqAmount(verified.total,received))errors.push('VERIFIED_PAYMENT_ALLOCATION_SUM_MISMATCH');if(received>0&&verified.paymentIds.length===0)errors.push('BANK_CONFIRMED_PAYMENT_MISSING');if(aggregate&&!eqAmount(aggregate.allocated_amount,received))errors.push('DEAL_ALLOCATION_TOTAL_MISMATCH');
  if(!eqAmount(remaining,Math.max(0,(obligation??0)-(received??0))))errors.push('REMAINING_FORMULA_MISMATCH');if(!eqAmount((currentDue??0)+(deferred??0),remaining))errors.push('DUE_BUCKETS_MISMATCH');
  if(state==='PAID'&&(!eqAmount(remaining,0)||!eqAmount(currentDue,0)||!eqAmount(deferred,0)))errors.push('PAID_STATE_MISMATCH');
  if(state==='DEFERRED_NOT_DUE'&&(!eqAmount(currentDue,0)||!eqAmount(deferred,remaining)))errors.push('DEFERRED_STATE_MISMATCH');
  if(state==='DUE'&&(!eqAmount(currentDue,remaining)||!eqAmount(deferred,0)))errors.push('DUE_STATE_MISMATCH');
  if(state==='DUE'&&trigger&&trigger!=='CONFIRMED'&&trigger!=='NOT_APPLICABLE')errors.push('DUE_WITHOUT_AUTHORITATIVE_TRIGGER');if(trigger==='SENT')errors.push('SENT_IS_NOT_TRIGGER_CONFIRMATION');
  if(!['PAID','DEFERRED_NOT_DUE','DUE'].includes(state))errors.push('SCHEDULE_STATE_INVALID');if(errors.length)return failClosed(row,finance,errors);
  const fxStatus=normalize(row?.outgoingUsdEquivalentStatus),fx=asNumber(row?.outgoingUsdEquivalent),allowFx=fx!==null&&['BANK_CONFIRMED','TREASURY_CONFIRMED','BANK_TREASURY_CONFIRMED'].includes(fxStatus);
  return{dealId,currency,paymentIds:verified.paymentIds,obligationAmount:obligation,verifiedReceivedAmount:received,remainingAmount:remaining,currentDueAmount:currentDue,deferredNotDueAmount:deferred,
    scheduleState:state,triggerState:trigger||'NOT_APPLICABLE',nextTrancheCondition:row?.nextTrancheCondition??null,projectionStatus:'AUTHORITATIVE',bankFactStatus:received>0?'BANK_CONFIRMED':'NO_VERIFIED_RECEIPT',allocationStatus:received>0?'VERIFIED':'NO_VERIFIED_ALLOCATION',
    financeStatus:row?.financeStatus??summary?.finance_status??null,accountingClosureStatus:row?.accountingClosureStatus??summary?.accounting_status??null,outgoingUsdEquivalent:allowFx?fx:null,outgoingUsdEquivalentStatus:allowFx?fxStatus:'TO_VERIFY',
    validationErrors:[],provenance:rowProvenance(row)};
}
function validateHold(finance,row){
  const dealId=String(row?.dealId||''),summary=financeSummary(finance,dealId),errors=[];if(!dealId)errors.push('DEAL_ID_MISSING');if(!summary)errors.push('FINANCE_SUMMARY_MISSING');
  return{dealId,currency:null,paymentIds:[],obligationAmount:null,verifiedReceivedAmount:null,remainingAmount:null,currentDueAmount:null,deferredNotDueAmount:null,
    scheduleState:'TO_VERIFY',triggerState:'TO_VERIFY',nextTrancheCondition:null,projectionStatus:'TO_VERIFY',bankFactStatus:'TO_VERIFY',allocationStatus:'TO_VERIFY',financeStatus:'TO_VERIFY',
    accountingClosureStatus:row?.accountingClosureStatus??summary?.accounting_status??null,outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',validationErrors:errors.length?errors:[String(row?.reason||'FINANCE_PAYMENT_SCHEDULE_NOT_MATERIALIZED')],
    provenance:{authority:'FINANCE_CURRENT_STATE',authorityState:'FAIL_CLOSED'}};
}
function scheduleTotals(schedules){
  const map=new Map();for(const row of schedules){if(row?.projectionStatus!=='AUTHORITATIVE'||!row?.currency)continue;const current=asNumber(row.currentDueAmount),deferred=asNumber(row.deferredNotDueAmount);if(current===null||deferred===null)continue;
    const key=String(row.currency),prev=map.get(key)||{currency:key,currentDueAmount:0,deferredNotDueAmount:0};prev.currentDueAmount=round(prev.currentDueAmount+current);prev.deferredNotDueAmount=round(prev.deferredNotDueAmount+deferred);map.set(key,prev)}return[...map.values()];
}
export function buildPaymentScheduleProjection(financeFragment,generatedAt=new Date().toISOString()){
  const policy={frontendCalculation:false,candidateDealIdsAreAllocation:false,proportionalSplit:false,syntheticFx:false,sentApplicationCreatesDue:false,reconciledFinanceAllocationOnly:true};
  if(String(financeFragment?.paymentProjectionContract||'')!==FINANCE_PROJECTION_CONTRACT)return{generatedAt,projectionContract:SCHEDULE_PROJECTION_CONTRACT,sourceProjectionContract:String(financeFragment?.paymentProjectionContract||''),sourceScheduleContract:String(financeFragment?.paymentScheduleContract||''),authority:'FINANCE',schedulePolicy:policy,schedules:[],totalsByCurrency:[],projectionStatus:'TO_VERIFY',validationErrors:['FINANCE_PROJECTION_CONTRACT_MISMATCH']};
  if(String(financeFragment?.paymentScheduleContract||'')!==FINANCE_SCHEDULE_CONTRACT)return{generatedAt,projectionContract:SCHEDULE_PROJECTION_CONTRACT,sourceProjectionContract:FINANCE_PROJECTION_CONTRACT,sourceScheduleContract:String(financeFragment?.paymentScheduleContract||''),authority:'FINANCE',schedulePolicy:policy,schedules:[],totalsByCurrency:[],projectionStatus:'TO_VERIFY',validationErrors:['FINANCE_SCHEDULE_CURRENT_STATE_MISSING']};
  const authoritative=asArray(financeFragment?.paymentSchedules).map(row=>validateAuthoritativeRow(financeFragment,row)),seen=new Set(authoritative.map(row=>row.dealId));
  const holds=asArray(financeFragment?.paymentScheduleHolds).filter(row=>!seen.has(String(row?.dealId||''))).map(row=>validateHold(financeFragment,row));
  const schedules=[...authoritative,...holds].sort((a,b)=>String(a.dealId).localeCompare(String(b.dealId)));
  return{generatedAt,projectionContract:SCHEDULE_PROJECTION_CONTRACT,sourceProjectionContract:FINANCE_PROJECTION_CONTRACT,sourceScheduleContract:FINANCE_SCHEDULE_CONTRACT,authority:'FINANCE',
    scheduleMaterialization:'MATERIALIZED_FINANCE_BUSINESS_CURRENT_STATE',schedulePolicy:policy,schedules,totalsByCurrency:scheduleTotals(schedules),projectionStatus:'AUTHORITATIVE',validationErrors:[]};
}
function responseHeaders(base){const headers=new Headers(base||{});headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store, no-cache, must-revalidate');headers.set('pragma','no-cache');headers.set('x-rona-payment-schedule',SCHEDULE_PROJECTION_CONTRACT);return headers}
async function fetchTrusted(request,path){const target=new URL('/portal/owner-api',request.url);target.searchParams.set('path',path);const headers=new Headers({accept:'application/json'}),cookie=request.headers.get('cookie');if(cookie)headers.set('cookie',cookie);const requestId=request.headers.get('x-request-id');if(requestId)headers.set('x-request-id',requestId);return fetch(target,{method:'GET',headers,cache:'no-store'})}
export async function onRequest(context){
  const request=context.request;if(request.method!=='GET')return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:responseHeaders()});
  const syncResponse=await fetchTrusted(request,'/admin/ai-sync');if(!syncResponse.ok){const status=syncResponse.status===401?401:502;return new Response(JSON.stringify({ok:false,code:'PAYMENT_SCHEDULE_SOURCE_UNAVAILABLE'}),{status,headers:responseHeaders()})}
  const syncPayload=await syncResponse.json().catch(()=>null),finance=syncPayload?.data?.financeFragment;if(!finance||typeof finance!=='object')return new Response(JSON.stringify({ok:false,code:'FINANCE_PROJECTION_MISSING'}),{status:502,headers:responseHeaders()});
  const data=buildPaymentScheduleProjection(finance,syncPayload?.data?.generatedAt||new Date().toISOString());return new Response(JSON.stringify({ok:true,data}),{status:200,headers:responseHeaders()});
}
