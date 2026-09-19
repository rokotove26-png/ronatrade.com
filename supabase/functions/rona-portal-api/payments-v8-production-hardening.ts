// Payments V8 production hardening wrapper.
// Keeps the exact current production portal handler and adds only server-side aggregate/version projection
// plus a client-safe receipt-detail overlay sourced from the same Finance authorities used by Client Payments.
import { buildConfirmedFundingAggregate, buildPaymentsCurrencyAggregates } from '../_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';
import { sql, apiRoute } from './shared.ts';

const BASELINE='5aceffe2725a904e8e0ded562e483f012e861085';
const CLIENT_RECEIPT_DETAIL_CONTRACT='CLIENT_RECEIPT_DETAIL_RECONCILIATION_V1';
const nativeServe=Deno.serve.bind(Deno);
let capturedHandler:any=null;

(Deno as any).serve=function capturePortalHandler(first:any,second?:any){
  const handler=typeof first==='function'?first:second;
  if(typeof handler!=='function')throw new Error('PAYMENTS_V8_BASELINE_HANDLER_REQUIRED');
  capturedHandler=handler;
  return {finished:Promise.resolve(),shutdown(){},ref(){},unref(){}};
};

await import('https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/5aceffe2725a904e8e0ded562e483f012e861085/supabase/functions/rona-portal-api/application-business-bootstrap-v2.ts');
(Deno as any).serve=nativeServe;
if(typeof capturedHandler!=='function')throw new Error('PAYMENTS_V8_BASELINE_HANDLER_CAPTURE_FAILED');

function isAdminBootstrap(req:Request){
  return req.method==='GET' && new URL(req.url).pathname.endsWith('/v1/admin/bootstrap');
}
function clientPaymentRoute(req:Request){
  if(req.method!=='GET')return null;
  const route=apiRoute(new URL(req.url));
  return ['/v1/client/context','/v1/client/payments'].includes(route)?route:null;
}
function projectionVersionKey(projection:any){
  const ids=Array.isArray(projection?.deals)?projection.deals.map((d:any)=>String(d?.deal_id||'')).filter(Boolean).sort():[];
  return [
    String(projection?.source_as_of||''),
    String(projection?.generated_at||projection?.generatedAt||''),
    String(projection?.finance_authority_projection_reconciliation?.version||''),
    ids.join(','),
  ].join('|');
}
async function hardenBootstrap(req:Request,response:Response){
  if(!isAdminBootstrap(req)||!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return response;
  const payload=await response.clone().json().catch(()=>null);
  const projection=payload?.data?.paymentsV7Projection;
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7'||!Array.isArray(projection.deals))return response;
  projection.currency_aggregates=buildPaymentsCurrencyAggregates(projection.deals);
  projection.funding_aggregate=buildConfirmedFundingAggregate(projection.deals);
  projection.projection_version_key=projectionVersionKey(projection);
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-payments-v8-hardening','server-aggregates-live-refresh-v1');
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

function clientContract(payload:any,route:string){
  if(route==='/v1/client/context')return payload?.data?.contract||null;
  return payload?.contract||payload?.data?.contract||null;
}
function clientPaymentsArray(payload:any,route:string){
  if(route==='/v1/client/context')return Array.isArray(payload?.data?.payments)?payload.data.payments:null;
  return Array.isArray(payload?.payments)?payload.payments:null;
}
async function hardenClientReceiptDetails(req:Request,response:Response){
  const route=clientPaymentRoute(req);
  if(!route||!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return response;

  const url=new URL(req.url);
  const requestedClientId=String(url.searchParams.get('clientId')||'').trim();
  const requestedContractId=String(url.searchParams.get('contractId')||'').trim();
  if(!requestedClientId||!requestedContractId)return response;

  const payload=await response.clone().json().catch(()=>null);
  if(!payload)return response;
  const contract=clientContract(payload,route);
  const responseClientId=String(contract?.client_id||'').trim();
  const responseContractId=String(contract?.contract_id||'').trim();
  if(responseClientId!==requestedClientId||responseContractId!==requestedContractId)return response;

  const projected=clientPaymentsArray(payload,route);
  if(!projected)return response;

  // One client-safe row per real incoming Payment. Deal attribution is exposed only when the
  // payment has exactly one active allocation inside this exact authorized client/contract.
  // RECEIVED_UNVERIFIED is never rewritten as a bank fact: it is marked separately as a
  // Finance-confirmed client receipt when backed by the immutable owner-confirmed Finance event.
  const rows=await sql`
    with scoped as (
      select
        p.id as payment_key,
        p.payment_id,
        p.amount,
        trim(p.currency::text) as currency,
        p.payment_at,
        p.bank_fact_status::text as bank_fact_status,
        p.finance_verification_status::text as finance_verification_status,
        p.source_system,
        p.source_version,
        count(distinct d.id) as deal_count,
        min(d.deal_id) as single_deal_id,
        bool_or(
          p.bank_fact_status::text='BANK_CONFIRMED'
          and pa.allocation_status::text='VERIFIED'
        ) as bank_confirmed,
        bool_or(
          p.bank_fact_status::text='RECEIVED_UNVERIFIED'
          and p.finance_verification_status::text='VERIFIED'
          and p.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'
          and pa.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'
          and pa.allocation_status::text in ('ALLOCATED','VERIFIED')
          and exists (
            select 1
            from portal_private.finance_events_v7 fe
            where fe.payment_key=p.id
              and fe.event_type='OWNER_CONFIRMED_RECEIPT_MATERIALIZED'
              and fe.actor_id='AI-FINANCE'
              and fe.actor_role='FINANCE'
              and coalesce((fe.result_snapshot->>'accepted')::boolean,false)=true
          )
        ) as owner_confirmed
      from portal_private.payments p
      join portal_private.payment_allocations pa
        on pa.payment_key=p.id
       and pa.lifecycle_state::text='ACTIVE'
       and pa.authority_state::text in ('VERIFIED','CONFIRMED')
       and pa.allocation_status::text in ('ALLOCATED','VERIFIED')
      join portal_private.deals d on d.id=pa.deal_key
      join portal_private.clients cl on cl.id=d.client_key
      join portal_private.contracts ct on ct.id=d.contract_key
      where cl.client_id=${responseClientId}
        and ct.contract_id=${responseContractId}
        and p.lifecycle_state::text='ACTIVE'
        and p.authority_state::text in ('VERIFIED','CONFIRMED')
        and p.payment_direction::text='INCOMING'
        and p.payment_kind::text='CLIENT_PAYMENT'
        and (
          p.bank_fact_status::text='BANK_CONFIRMED'
          or (
            p.bank_fact_status::text='RECEIVED_UNVERIFIED'
            and p.finance_verification_status::text='VERIFIED'
            and p.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'
          )
        )
        and not exists (
          select 1
          from portal_private.payment_allocations other_pa
          join portal_private.deals other_d on other_d.id=other_pa.deal_key
          join portal_private.clients other_cl on other_cl.id=other_d.client_key
          join portal_private.contracts other_ct on other_ct.id=other_d.contract_key
          where other_pa.payment_key=p.id
            and other_pa.lifecycle_state::text='ACTIVE'
            and other_pa.authority_state::text in ('VERIFIED','CONFIRMED')
            and (
              other_cl.client_id<>${responseClientId}
              or other_ct.contract_id<>${responseContractId}
            )
        )
      group by p.id,p.payment_id,p.amount,trim(p.currency::text),p.payment_at,
               p.bank_fact_status::text,p.finance_verification_status::text,
               p.source_system,p.source_version
    )
    select
      payment_id,
      amount,
      currency,
      payment_at,
      bank_fact_status,
      finance_verification_status,
      source_system,
      source_version,
      case when deal_count=1 then single_deal_id else null end as deal_id,
      case
        when bank_confirmed then 'BANK_CONFIRMED'
        when owner_confirmed then 'FINANCE_CONFIRMED'
        else null
      end as client_receipt_status
    from scoped
    where bank_confirmed=true or owner_confirmed=true
    order by payment_at,payment_id
  `;

  projected.splice(0,projected.length,...rows.map((row:any)=>({
    payment_id:String(row?.payment_id||''),
    deal_id:row?.deal_id?String(row.deal_id):null,
    amount:row?.amount,
    currency:String(row?.currency||'').trim(),
    payment_at:row?.payment_at||null,
    bank_fact_status:String(row?.bank_fact_status||''),
    finance_verification_status:String(row?.finance_verification_status||''),
    client_receipt_status:String(row?.client_receipt_status||''),
    source_system:String(row?.source_system||''),
    source_version:String(row?.source_version||''),
    payment_direction:'INCOMING',
    payment_kind:'CLIENT_PAYMENT',
  })));

  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-client-receipt-detail',`${CLIENT_RECEIPT_DETAIL_CONTRACT}:authoritative`);
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

nativeServe(async(req:Request,info:any)=>{
  const base:Response=await capturedHandler(req,info);
  const adminHardened:Response=await hardenBootstrap(req,base);
  try{
    return await hardenClientReceiptDetails(req,adminHardened);
  }catch(error){
    console.error('CLIENT_RECEIPT_DETAIL_RECONCILIATION_FAIL',error);
    return adminHardened;
  }
});
