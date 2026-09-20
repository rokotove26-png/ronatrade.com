// Production entrypoint: application business contract + Finance V7 client payments projection.
// Non-payment behavior delegates to the exact verified production predecessor.
import {sql,authenticate,apiRoute} from './shared.ts';
import {createApplicationBusinessHandler} from '../_shared/client-application-business-v2/handler.mjs';
import {applyClientPaymentAuthorityV7,failClosedClientPaymentV7} from './client-payments-v7.js';

const CLIENT_PAYMENTS_V7_CONTRACT='CLIENT_PAYMENTS_FINANCE_V7_AUTHORITATIVE_V1';
const paymentsNativeServe:any=Deno.serve.bind(Deno);
function paymentRoute(url:URL){const route=apiRoute(url);return ['/v1/client/context','/v1/client/deals','/v1/client/payments'].includes(route)?route:null}
function paymentArrays(payload:any,route:string){
 if(route==='/v1/client/context')return{deals:Array.isArray(payload?.data?.deals)?payload.data.deals:[],payments:Array.isArray(payload?.data?.payments)?payload.data.payments:[]};
 if(route==='/v1/client/deals')return{deals:Array.isArray(payload?.deals)?payload.deals:[],payments:[]};
 return{deals:[],payments:Array.isArray(payload?.payments)?payload.payments:[]};
}
function paymentResponse(base:Response,payload:any,state:string){
 const headers=new Headers(base.headers);headers.delete('content-length');headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store');
 headers.set('x-rona-client-payments-v7',`${CLIENT_PAYMENTS_V7_CONTRACT}:${state}`);
 return new Response(JSON.stringify(payload),{status:base.status,statusText:base.statusText,headers});
}
function failClosedPayments(payload:any,route:string,reason:string){const {deals,payments}=paymentArrays(payload,route);for(const deal of deals)failClosedClientPaymentV7(deal,reason);if(Array.isArray(payments))payments.splice(0,payments.length);return payload}
async function projectClientPaymentsV7(req:Request,response:Response){
 const url=new URL(req.url),route=paymentRoute(url);if(req.method!=='GET'||!route||!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return response;
 let payload:any=null;
 try{
  payload=await response.clone().json();
  const clientId=String(url.searchParams.get('clientId')||'').trim(),contractId=String(url.searchParams.get('contractId')||'').trim();
  if(!clientId||!contractId)return response;
  if(route==='/v1/client/context'){
   const responseClientId=String(payload?.data?.contract?.client_id||'').trim(),responseContractId=String(payload?.data?.contract?.contract_id||'').trim();
   if(responseClientId!==clientId||responseContractId!==contractId)return paymentResponse(response,failClosedPayments(payload,route,'FINANCE_V7_CONTEXT_MISMATCH'),'fail-closed');
  }
  const {deals,payments}=paymentArrays(payload,route);
  const dealIds=[...new Set([...deals.map((d:any)=>String(d?.deal_id||'').trim()),...payments.map((p:any)=>String(p?.deal_id||'').trim())].filter(Boolean))];
  if(!dealIds.length)return paymentResponse(response,payload,'authoritative-empty');
  const authorities=await sql`
   select d.deal_id,a.id::text as id,a.total_to_receive,trim(a.obligation_currency::text) as obligation_currency,
          a.finance_status,a.documentary_status,a.due_now,a.expected_not_due,a.future_conditional,a.source_version,a.source_timestamp
     from portal_private.deals d
     join portal_private.clients cl on cl.id=d.client_key
     join portal_private.contracts ct on ct.id=d.contract_key
     join portal_private.deal_finance_authority_v7 a on a.deal_key=d.id
    where cl.client_id=${clientId} and ct.contract_id=${contractId}
      and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
      and a.source_locked=true
      and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
      and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
      and not exists(select 1 from portal_private.deal_finance_authority_v7 newer where newer.supersedes_id=a.id and newer.source_locked=true
        and upper(newer.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(newer.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'))
    order by d.deal_id,a.effective_at desc,a.created_at desc`;
  const receipts=await sql`
   select d.deal_id,trim(p.currency::text) as currency,sum(pa.allocated_amount) as amount,jsonb_agg(distinct p.payment_id) as payment_ids
     from portal_private.payment_allocations pa
     join portal_private.payments p on p.id=pa.payment_key
     join portal_private.deals d on d.id=pa.deal_key
     join portal_private.clients cl on cl.id=d.client_key
     join portal_private.contracts ct on ct.id=d.contract_key
    where cl.client_id=${clientId} and ct.contract_id=${contractId}
      and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
      and p.bank_fact_status::text='BANK_CONFIRMED' and p.payment_direction::text='INCOMING' and p.payment_kind::text='CLIENT_PAYMENT'
      and p.authority_state::text in ('VERIFIED','CONFIRMED') and p.lifecycle_state::text='ACTIVE'
      and pa.allocation_status::text='VERIFIED' and pa.authority_state::text in ('VERIFIED','CONFIRMED') and pa.lifecycle_state::text='ACTIVE'
    group by d.deal_id,trim(p.currency::text) order by d.deal_id,trim(p.currency::text)`;
  const authorityByDeal=new Map<string,any[]>(),receiptByDeal=new Map<string,any[]>(),allowedPaymentIds=new Set<string>();
  for(const row of authorities){const id=String(row?.deal_id||'').trim();if(!id)continue;const list=authorityByDeal.get(id)||[];list.push(row);authorityByDeal.set(id,list)}
  for(const row of receipts){const id=String(row?.deal_id||'').trim();if(!id)continue;const list=receiptByDeal.get(id)||[];list.push(row);receiptByDeal.set(id,list);for(const paymentId of Array.isArray(row?.payment_ids)?row.payment_ids:[]){const v=String(paymentId||'').trim();if(v)allowedPaymentIds.add(v)}}
  for(const deal of deals){const id=String(deal?.deal_id||'').trim();applyClientPaymentAuthorityV7(deal,authorityByDeal.get(id)||[],receiptByDeal.get(id)||[])}
  if(Array.isArray(payments)){const incoming=payments.filter((p:any)=>allowedPaymentIds.has(String(p?.payment_id||'').trim()));for(const payment of incoming){payment.bank_fact_status='BANK_CONFIRMED';payment.payment_direction='INCOMING';payment.payment_kind='CLIENT_PAYMENT'}payments.splice(0,payments.length,...incoming)}
  return paymentResponse(response,payload,'authoritative');
 }catch(error){console.error('CLIENT_PAYMENTS_FINANCE_V7_FAIL',error);return payload?paymentResponse(response,failClosedPayments(payload,route,'FINANCE_V7_PROJECTION_ERROR'),'fail-closed'):response}
}
(Deno as any).serve=function clientPaymentsV7Serve(first:any,second?:any){
 const handler=typeof first==='function'?first:second,options=typeof first==='function'?undefined:first;if(typeof handler!=='function')return paymentsNativeServe(first,second);
 const wrapped=(req:Request,info:any)=>Promise.resolve(handler(req,info)).then((response:Response)=>projectClientPaymentsV7(req,response));
 return options===undefined?paymentsNativeServe(wrapped):paymentsNativeServe(options,wrapped);
};

const applicationNativeServe:any=Deno.serve.bind(Deno);
(Deno as any).serve=function applicationBusinessServe(first:any,second?:any){
 const handler=typeof first==='function'?first:second,options=typeof first==='function'?undefined:first;
 if(typeof handler!=='function')return applicationNativeServe(first,second);
 const wrapped=createApplicationBusinessHandler(handler,{sql,authenticate,apiRoute});
 return options===undefined?applicationNativeServe(wrapped):applicationNativeServe(options,wrapped);
};
await import('./stage24-bootstrap.ts');
