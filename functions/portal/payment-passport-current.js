const PASSPORT_CONTRACT='ADMIN_PAYMENT_PASSPORT_AUTHORITY_V1';
const SCREEN_CONTRACT='ADMIN_PAYMENTS_OWNER_CURRENT_STATE_V1';
const CLIENT_RECEIPT_CONTRACT='FINANCE_CLIENT_RECEIPTS_PAYMENT_AMOUNT_V2';
const asArray=value=>Array.isArray(value)?value:[];
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const activeAuthority=value=>['CONFIRMED','VERIFIED'].includes(upper(value));

function paymentMap(finance){return new Map(asArray(finance?.payments).map(row=>[s(row?.payment_id),row]).filter(([id])=>id))}
function summaryMap(finance){return new Map(asArray(finance?.paymentAllocationSummaries).map(row=>[s(row?.payment_id),row]).filter(([id])=>id))}
function scheduleRow(finance,dealId){return asArray(finance?.paymentSchedules).find(row=>s(row?.dealId)===dealId)||null}
function scheduleHold(finance,dealId){return asArray(finance?.paymentScheduleHolds).find(row=>s(row?.dealId)===dealId)||null}
function dealSummary(finance,dealId){return asArray(finance?.dealFinanceCurrentState).find(row=>s(row?.deal_id)===dealId)||asArray(finance?.dealFinanceSummaries).find(row=>s(row?.deal_id)===dealId)||null}
function clientPaymentValid(row){return upper(row?.payment_direction)==='INCOMING'&&upper(row?.payment_kind)==='CLIENT_PAYMENT'&&upper(row?.bank_fact_status)==='BANK_CONFIRMED'&&upper(row?.finance_verification_status)==='VERIFIED'&&activeAuthority(row?.authority_state)&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')}
function allocationValid(row){return upper(row?.allocation_status)==='VERIFIED'&&activeAuthority(row?.authority_state)&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')}
function canonicalPayment(row){return{
  paymentId:s(row?.payment_id),date:row?.payment_at??null,amount:n(row?.amount),currency:upper(row?.currency),payer:s(row?.payer_name)||null,beneficiary:s(row?.beneficiary_name)||null,
  counterparty:s(row?.counterparty_name)||null,counterpartyRole:s(row?.counterparty_role)||null,purpose:s(row?.original_payment_purpose)||null,
  bankReference:s(row?.bank_transaction_reference)||null,bankFactStatus:upper(row?.bank_fact_status)||null,financeStatus:upper(row?.finance_status)||null,
  accountingStatus:upper(row?.accounting_closure_status)||null,paymentDirection:upper(row?.payment_direction)||null,paymentKind:upper(row?.payment_kind)||null,
  financeVerificationStatus:upper(row?.finance_verification_status)||null,allocationReviewStatus:upper(row?.allocation_review_status)||null,
  dealAllocationApplicability:upper(row?.deal_allocation_applicability)||null,sourceSystem:s(row?.source_system)||null,sourceVersion:s(row?.source_version)||null,sourceTimestamp:row?.source_timestamp??null
}}
function outgoingPayment(finance,row){const p=paymentMap(finance).get(s(row?.fact_id))||null;return{
  paymentId:s(row?.fact_id),date:row?.payment_at??p?.payment_at??null,beneficiary:s(row?.beneficiary_name)||s(p?.counterparty_name)||null,beneficiaryRole:s(row?.beneficiary_role)||s(p?.counterparty_role)||null,
  purpose:s(row?.purpose)||s(p?.original_payment_purpose)||null,amount:n(row?.amount??p?.amount),currency:upper(row?.currency??p?.currency),bankReference:s(row?.bank_document)||s(p?.bank_transaction_reference)||null,
  bankFactStatus:upper(row?.bank_fact_status??p?.bank_fact_status)||null,dealAllocationStatus:upper(row?.deal_allocation_status)||null,financeStatus:upper(p?.finance_status)||null,accountingStatus:upper(p?.accounting_closure_status)||null,
  flowKind:upper(row?.flow_kind)||upper(p?.payment_kind)||null,sourceDocument:s(row?.source_document)||null,sourceVersion:s(row?.source_version)||s(p?.source_version)||null,sourceTimestamp:row?.source_timestamp??p?.source_timestamp??null
}}

export function buildPaymentPassportProjection(finance,dealId,generatedAt=new Date().toISOString()){
  const id=s(dealId),errors=[];
  if(!/^DEAL-[A-Z0-9-]{3,80}$/.test(id))errors.push('DEAL_ID_INVALID');
  if(String(finance?.ownerPaymentScreenContract||'')!==SCREEN_CONTRACT)errors.push('OWNER_PAYMENT_SCREEN_CONTRACT_MISMATCH');
  if(String(finance?.clientReceiptContract||'')!==CLIENT_RECEIPT_CONTRACT)errors.push('CLIENT_RECEIPT_CONTRACT_MISMATCH');
  const summary=dealSummary(finance,id);if(!summary)errors.push('DEAL_FINANCE_SUMMARY_MISSING');
  if(errors.length)return{generatedAt,passportContract:PASSPORT_CONTRACT,dealId:id,projectionStatus:'TO_VERIFY',validationErrors:errors,clientReceipts:[],allocations:[],relatedOutgoings:[],bankFees:[],unallocatedBankFees:[],fxConversions:[],unallocatedOutgoings:[],fundsTrace:{status:'NOT_ESTABLISHED',directSourceUseLinks:[]}};

  const payments=paymentMap(finance),allocSummary=summaryMap(finance);
  const allocations=[];for(const row of asArray(finance?.incomingPaymentAllocations)){
    if(s(row?.deal_id)!==id||!allocationValid(row))continue;const payment=payments.get(s(row?.payment_id));if(!payment||!clientPaymentValid(payment)||upper(payment.currency)!==upper(row.currency))continue;
    const amount=n(row?.allocated_amount);if(amount===null||amount<0)continue;const ps=allocSummary.get(s(row.payment_id));
    allocations.push({paymentId:s(row.payment_id),dealId:id,allocatedAmount:amount,currency:upper(row.currency),allocationStatus:'VERIFIED',allocatedTotal:n(ps?.allocated_total),unallocatedResidue:n(ps?.unallocated_amount),allocationProjectionStatus:upper(ps?.allocation_projection_status)||'TO_VERIFY',allocationReference:s(row?.allocation_reference)||null,allocatedAt:row?.allocated_at??null});
  }
  const receiptIds=[...new Set(allocations.map(row=>row.paymentId))];
  const clientReceipts=receiptIds.map(paymentId=>canonicalPayment(payments.get(paymentId))).filter(row=>row.paymentId);
  const verifiedReceivedAmount=round(allocations.reduce((sum,row)=>sum+Number(row.allocatedAmount||0),0));
  const schedule=scheduleRow(finance,id),hold=scheduleHold(finance,id),scheduleAuthoritative=upper(summary?.payment_schedule_projection_status)==='AUTHORITATIVE'&&!!schedule;
  const scheduleStatus=scheduleAuthoritative?'AUTHORITATIVE':'TO_VERIFY';
  const obligation=scheduleAuthoritative?n(schedule?.obligationAmount):null,remaining=scheduleAuthoritative?n(schedule?.remainingAmount):null;
  const allocationCurrencies=[...new Set(allocations.map(row=>upper(row?.currency)).filter(Boolean))];
  const totalsCurrency=scheduleAuthoritative?upper(schedule?.currency):(allocationCurrencies.length===1?allocationCurrencies[0]:null);

  const related=asArray(finance?.outgoingPayments).filter(row=>upper(row?.deal_allocation_status)==='CONFIRMED'&&asArray(row?.deal_ids).map(s).includes(id));
  const relatedOutgoings=related.filter(row=>upper(row?.flow_kind)!=='BANK_FEE').map(row=>outgoingPayment(finance,row));
  const bankFees=related.filter(row=>upper(row?.flow_kind)==='BANK_FEE').map(row=>outgoingPayment(finance,row));

  const canonical=asArray(finance?.payments).filter(row=>upper(row?.bank_fact_status)==='BANK_CONFIRMED'&&activeAuthority(row?.authority_state)&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE'));
  const unallocatedBankFees=canonical.filter(row=>upper(row?.payment_kind)==='BANK_FEE'&&upper(row?.allocation_review_status)!=='VERIFIED').map(canonicalPayment);
  const fxConversions=canonical.filter(row=>upper(row?.payment_kind)==='FX_CONVERSION').map(canonicalPayment);
  const unallocatedOutgoings=canonical.filter(row=>upper(row?.payment_direction)==='OUTGOING'&&upper(row?.payment_kind)==='COUNTERPARTY_PAYMENT'&&upper(row?.allocation_review_status)!=='VERIFIED').map(canonicalPayment);

  const passport={generatedAt,passportContract:PASSPORT_CONTRACT,projectionStatus:scheduleAuthoritative?'AUTHORITATIVE':'TO_VERIFY',validationErrors:[],
    dealId:id,client:{clientId:s(summary?.client_id)||null,clientName:s(summary?.client_name)||null},financeStatus:scheduleAuthoritative?(s(summary?.finance_status)||null):'TO_VERIFY',accountingClosureStatus:s(summary?.accounting_status)||null,
    clientReceipts,allocations,totals:{currency:totalsCurrency,obligationAmount:obligation,verifiedReceivedAmount,remainingAmount:remaining,currentDueAmount:scheduleAuthoritative?n(schedule?.currentDueAmount):null,deferredNotDueAmount:scheduleAuthoritative?n(schedule?.deferredNotDueAmount):null,scheduleStatus,scheduleState:scheduleAuthoritative?(schedule?.scheduleState??'TO_VERIFY'):'TO_VERIFY'},
    relatedOutgoings,bankFees,unallocatedBankFees,fxConversions,unallocatedOutgoings,
    scheduleEvidence:scheduleAuthoritative?{sourceKind:s(schedule?.sourceKind)||null,sourceRecordId:s(schedule?.sourceRecordId)||null,sourceVersion:s(schedule?.sourceVersion)||null,sourceTimestamp:schedule?.sourceTimestamp??null,materializedAt:schedule?.materializedAt??null}:{reason:s(hold?.reason)||'FINANCE_PAYMENT_SCHEDULE_NOT_MATERIALIZED',validationErrors:asArray(hold?.validationErrors)},
    fundsTrace:{status:'NOT_ESTABLISHED',directSourceUseLinks:[],label:'Связанные расходы по сделке',note:'Прямая трассировка source → use не утверждается без authoritative Treasury/bank source-lock.'}
  };
  return passport;
}

function responseHeaders(base){const headers=new Headers(base||{});headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store, no-cache, must-revalidate');headers.set('pragma','no-cache');headers.set('x-rona-payment-passport',PASSPORT_CONTRACT);return headers}
async function fetchTrusted(request,path){const target=new URL('/portal/owner-api',request.url);target.searchParams.set('path',path);const headers=new Headers({accept:'application/json'}),cookie=request.headers.get('cookie');if(cookie)headers.set('cookie',cookie);const requestId=request.headers.get('x-request-id');if(requestId)headers.set('x-request-id',requestId);return fetch(target,{method:'GET',headers,cache:'no-store'})}
export async function onRequest(context){
  const request=context.request;if(request.method!=='GET')return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:responseHeaders()});
  const dealId=s(new URL(request.url).searchParams.get('dealId'));if(!/^DEAL-[A-Z0-9-]{3,80}$/.test(dealId))return new Response(JSON.stringify({ok:false,code:'PAYMENT_PASSPORT_DEAL_ID_INVALID'}),{status:400,headers:responseHeaders()});
  const syncResponse=await fetchTrusted(request,'/admin/ai-sync');if(!syncResponse.ok){const status=[401,403].includes(syncResponse.status)?syncResponse.status:502;return new Response(JSON.stringify({ok:false,code:status===403?'PAYMENT_PASSPORT_ACCESS_DENIED':'PAYMENT_PASSPORT_SOURCE_UNAVAILABLE'}),{status,headers:responseHeaders()})}
  const syncPayload=await syncResponse.json().catch(()=>null),finance=syncPayload?.data?.financeFragment;if(!finance||typeof finance!=='object')return new Response(JSON.stringify({ok:false,code:'FINANCE_PROJECTION_MISSING'}),{status:502,headers:responseHeaders()});
  const data=buildPaymentPassportProjection(finance,dealId,syncPayload?.data?.generatedAt||new Date().toISOString());if(data.validationErrors?.includes('DEAL_FINANCE_SUMMARY_MISSING'))return new Response(JSON.stringify({ok:false,code:'PAYMENT_PASSPORT_DEAL_NOT_FOUND'}),{status:404,headers:responseHeaders()});
  return new Response(JSON.stringify({ok:true,data}),{status:200,headers:responseHeaders()});
}
