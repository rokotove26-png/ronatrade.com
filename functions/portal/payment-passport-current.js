const PASSPORT_CONTRACT='ADMIN_PAYMENT_PASSPORT_AUTHORITY_V2';
const SCREEN_CONTRACT='ADMIN_PAYMENTS_OWNER_CURRENT_STATE_V1';
const CLIENT_RECEIPT_CONTRACT='FINANCE_CLIENT_RECEIPTS_PAYMENT_AMOUNT_V2';
const ALLOCATION_CONTRACT='FINANCE_RECONCILED_PAYMENT_ALLOCATION_V1';
const asArray=value=>Array.isArray(value)?value:[];
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const activeAuthority=value=>['CONFIRMED','VERIFIED'].includes(upper(value));
const samePayment=(row,id)=>s(row?.payment_id)===id;
function allocationReconciled(row){return upper(row?.allocation_status)==='VERIFIED'&&activeAuthority(row?.authority_state)&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')&&upper(row?.source_system).includes('RECONCIL')&&!!s(row?.source_version)&&!!row?.source_timestamp}
function canonicalPayment(row){return{
  paymentId:s(row?.payment_id),date:row?.payment_at??null,direction:upper(row?.payment_direction)||null,paymentKind:upper(row?.payment_kind)||null,
  payer:s(row?.payer_name)||null,beneficiary:s(row?.beneficiary_name)||null,counterparty:s(row?.counterparty_name)||null,purpose:s(row?.original_payment_purpose)||null,
  amount:n(row?.amount),currency:upper(row?.currency),bankReference:s(row?.bank_transaction_reference)||null,bankFactStatus:upper(row?.bank_fact_status)||null,
  financeStatus:upper(row?.finance_status)||null,financeVerificationStatus:upper(row?.finance_verification_status)||null,accountingStatus:upper(row?.accounting_closure_status)||null,
  dealAllocationApplicability:upper(row?.deal_allocation_applicability)||null,allocationReviewStatus:upper(row?.allocation_review_status)||null,
  sourceSystem:s(row?.source_system)||null,sourceVersion:s(row?.source_version)||null,sourceTimestamp:row?.source_timestamp??null
}}
function explicitLinkedPayments(finance,paymentId,kind){
  return asArray(finance?.payments).filter(row=>upper(row?.payment_kind)===kind&&activeAuthority(row?.authority_state)&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')&&[row?.source_payment_id,row?.linked_payment_id,row?.parent_payment_id].some(v=>s(v)===paymentId)).map(canonicalPayment);
}
export function buildPaymentPassportProjection(finance,paymentId,generatedAt=new Date().toISOString()){
  const id=s(paymentId),errors=[];
  if(!/^[A-Z0-9][A-Z0-9-]{3,100}$/.test(id))errors.push('PAYMENT_ID_INVALID');
  if(String(finance?.ownerPaymentScreenContract||'')!==SCREEN_CONTRACT)errors.push('OWNER_PAYMENT_SCREEN_CONTRACT_MISMATCH');
  if(String(finance?.clientReceiptContract||'')!==CLIENT_RECEIPT_CONTRACT)errors.push('CLIENT_RECEIPT_CONTRACT_MISMATCH');
  if(String(finance?.allocationReconciliationContract||'')!==ALLOCATION_CONTRACT)errors.push('ALLOCATION_RECONCILIATION_CONTRACT_MISMATCH');
  const sourceRows=asArray(finance?.payments).filter(row=>samePayment(row,id));
  if(sourceRows.length!==1)errors.push(sourceRows.length?'PAYMENT_ID_NOT_UNIQUE':'PAYMENT_NOT_FOUND');
  const paymentRow=sourceRows[0]||null,payment=paymentRow?canonicalPayment(paymentRow):null;
  if(paymentRow&&(!activeAuthority(paymentRow?.authority_state)||upper(paymentRow?.bank_fact_status)!=='BANK_CONFIRMED'||(paymentRow?.lifecycle_state&&upper(paymentRow.lifecycle_state)!=='ACTIVE')))errors.push('PAYMENT_NOT_AUTHORITATIVE');
  if(errors.length)return{generatedAt,passportContract:PASSPORT_CONTRACT,paymentId:id,projectionStatus:'TO_VERIFY',validationErrors:errors,payment,allocations:[],totals:{paymentAmount:payment?.amount??null,currency:payment?.currency??null,allocatedTotal:null,unallocatedResidue:null,allocationProjectionStatus:'TO_VERIFY'},linkedBankFees:[],linkedFxConversions:[],fundsTrace:{status:'NOT_ESTABLISHED',directSourceUseLinks:[],note:'Прямая трассировка использования данного платежа не установлена'}};
  const currency=upper(paymentRow?.currency),rawAllocations=asArray(finance?.paymentAllocations).filter(row=>samePayment(row,id)&&upper(row?.currency)===currency&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE'));
  const allocations=rawAllocations.filter(allocationReconciled).map(row=>({paymentId:id,dealId:s(row?.deal_id)||null,allocatedAmount:n(row?.allocated_amount),currency,allocationStatus:upper(row?.allocation_status)||null,financeStatus:upper(row?.finance_status)||null,accountingStatus:upper(row?.accounting_closure_status)||null,allocationReference:s(row?.allocation_reference)||null,allocatedAt:row?.allocated_at??null,sourceSystem:s(row?.source_system)||null,sourceVersion:s(row?.source_version)||null,sourceTimestamp:row?.source_timestamp??null})).filter(row=>row.dealId&&row.allocatedAmount!==null&&row.allocatedAmount>=0);
  const amount=n(paymentRow?.amount),allocatedTotal=round(allocations.reduce((sum,row)=>sum+Number(row.allocatedAmount||0),0)),hasUnreconciled=rawAllocations.some(row=>!allocationReconciled(row));
  let unallocatedResidue=amount===null?null:round(amount-allocatedTotal),allocationProjectionStatus='TO_VERIFY';
  const notApplicable=upper(paymentRow?.deal_allocation_applicability)==='NOT_APPLICABLE';
  if(notApplicable&&rawAllocations.length===0){allocationProjectionStatus='NOT_APPLICABLE';unallocatedResidue=null}
  else if(amount!==null&&amount>=0&&!hasUnreconciled&&allocatedTotal<=amount+0.000001){allocationProjectionStatus=allocatedTotal===0?'UNALLOCATED':unallocatedResidue>0.000001?'PARTIALLY_ALLOCATED':'ALLOCATED'}
  const linkedBankFees=explicitLinkedPayments(finance,id,'BANK_FEE'),linkedFxConversions=explicitLinkedPayments(finance,id,'FX_CONVERSION');
  return{generatedAt,passportContract:PASSPORT_CONTRACT,paymentId:id,projectionStatus:'AUTHORITATIVE',validationErrors:[],payment,allocations,
    totals:{paymentAmount:amount,currency,allocatedTotal,unallocatedResidue,allocationProjectionStatus,allocationAuthority:ALLOCATION_CONTRACT,unreconciledAllocationRows:rawAllocations.filter(row=>!allocationReconciled(row)).length},
    linkedBankFees,linkedFxConversions,
    fundsTrace:{status:'NOT_ESTABLISHED',directSourceUseLinks:[],note:'Прямая трассировка использования данного платежа не установлена'}
  };
}
function responseHeaders(base){const headers=new Headers(base||{});headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store, no-cache, must-revalidate');headers.set('pragma','no-cache');headers.set('x-rona-payment-passport',PASSPORT_CONTRACT);return headers}
async function fetchTrusted(request,path){const target=new URL('/portal/owner-api',request.url);target.searchParams.set('path',path);const headers=new Headers({accept:'application/json'}),cookie=request.headers.get('cookie');if(cookie)headers.set('cookie',cookie);const requestId=request.headers.get('x-request-id');if(requestId)headers.set('x-request-id',requestId);return fetch(target,{method:'GET',headers,cache:'no-store'})}
export async function onRequest(context){
  const request=context.request;if(request.method!=='GET')return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:responseHeaders()});
  const paymentId=s(new URL(request.url).searchParams.get('paymentId'));if(!/^[A-Z0-9][A-Z0-9-]{3,100}$/.test(paymentId))return new Response(JSON.stringify({ok:false,code:'PAYMENT_PASSPORT_PAYMENT_ID_INVALID'}),{status:400,headers:responseHeaders()});
  const syncResponse=await fetchTrusted(request,'/admin/ai-sync');if(!syncResponse.ok){const status=[401,403].includes(syncResponse.status)?syncResponse.status:502;return new Response(JSON.stringify({ok:false,code:status===403?'PAYMENT_PASSPORT_ACCESS_DENIED':'PAYMENT_PASSPORT_SOURCE_UNAVAILABLE'}),{status,headers:responseHeaders()})}
  const syncPayload=await syncResponse.json().catch(()=>null),finance=syncPayload?.data?.financeFragment;if(!finance||typeof finance!=='object')return new Response(JSON.stringify({ok:false,code:'FINANCE_PROJECTION_MISSING'}),{status:502,headers:responseHeaders()});
  const data=buildPaymentPassportProjection(finance,paymentId,syncPayload?.data?.generatedAt||new Date().toISOString());if(data.validationErrors?.includes('PAYMENT_NOT_FOUND'))return new Response(JSON.stringify({ok:false,code:'PAYMENT_PASSPORT_PAYMENT_NOT_FOUND'}),{status:404,headers:responseHeaders()});
  return new Response(JSON.stringify({ok:true,data}),{status:200,headers:responseHeaders()});
}
