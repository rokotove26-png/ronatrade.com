import { sql } from "./shared.ts";
import { applyClientPaymentAuthorityV7, failClosedClientPaymentV7 } from "./client-payments-v7.js";

const PROJECTION_VERSION='client-payments-finance-v7-authoritative-v1';
const previousServe:any=Deno.serve.bind(Deno);

function targetRoute(pathname:string){
  if(pathname.endsWith('/v1/client/context'))return 'context';
  if(pathname.endsWith('/v1/client/deals'))return 'deals';
  if(pathname.endsWith('/v1/client/payments'))return 'payments';
  return null;
}
function contextMatches(payload:any,clientId:string,contractId:string){
  return String(payload?.data?.contract?.client_id||'').trim()===clientId&&String(payload?.data?.contract?.contract_id||'').trim()===contractId;
}
function arraysFor(payload:any,route:string){
  if(route==='context')return{deals:Array.isArray(payload?.data?.deals)?payload.data.deals:[],payments:Array.isArray(payload?.data?.payments)?payload.data.payments:[]};
  if(route==='deals')return{deals:Array.isArray(payload?.deals)?payload.deals:[],payments:[]};
  if(route==='payments')return{deals:[],payments:Array.isArray(payload?.payments)?payload.payments:[]};
  return{deals:[],payments:[]};
}
function jsonResponse(response:Response,payload:any,state='ok'){
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('x-rona-client-payments-v7',`${PROJECTION_VERSION}:${state}`);
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
function failClosedPayload(payload:any,route:string,reason:string){
  const {deals,payments}=arraysFor(payload,route);
  for(const deal of deals)failClosedClientPaymentV7(deal,reason);
  if(Array.isArray(payments))payments.splice(0,payments.length);
  return payload;
}

(Deno as any).serve=function clientPaymentsFinanceV7Serve(first:any,second?:any){
  const handler=typeof first==='function'?first:second;
  const options=typeof first==='function'?undefined:first;
  if(typeof handler!=='function')return previousServe(first,second);

  const wrapped=async(req:Request,info:any)=>{
    const response:Response=await handler(req,info);
    let payload:any=null;
    let route:string|null=null;
    try{
      const url=new URL(req.url);
      route=targetRoute(url.pathname);
      if(req.method!=='GET'||!route||!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return response;

      payload=await response.clone().json();
      const clientId=String(url.searchParams.get('clientId')||'').trim();
      const contractId=String(url.searchParams.get('contractId')||'').trim();
      if(!clientId||!contractId)return response;
      if(route==='context'&&!contextMatches(payload,clientId,contractId))return response;

      const {deals,payments}=arraysFor(payload,route);
      const dealIds=[...new Set([
        ...deals.map((deal:any)=>String(deal?.deal_id||'').trim()),
        ...payments.map((payment:any)=>String(payment?.deal_id||'').trim())
      ].filter(Boolean))];
      if(!dealIds.length)return response;

      const authorityRows=await sql`
        select d.deal_id,
               a.id::text as id,
               a.total_to_receive,
               trim(a.obligation_currency::text) as obligation_currency,
               a.finance_status,
               a.documentary_status,
               a.due_now,
               a.expected_not_due,
               a.future_conditional,
               a.source_version,
               a.source_timestamp
          from portal_private.deals d
          join portal_private.clients cl on cl.id=d.client_key
          join portal_private.contracts ct on ct.id=d.contract_key
          join portal_private.deal_finance_authority_v7 a on a.deal_key=d.id
         where cl.client_id=${clientId}
           and ct.contract_id=${contractId}
           and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
           and a.source_locked=true
           and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
           and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
           and not exists(
             select 1
               from portal_private.deal_finance_authority_v7 newer
              where newer.supersedes_id=a.id
                and newer.source_locked=true
                and upper(newer.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
                and upper(newer.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
           )
         order by d.deal_id,a.effective_at desc,a.created_at desc
      `;

      const receiptRows=await sql`
        select d.deal_id,
               trim(p.currency::text) as currency,
               sum(pa.allocated_amount) as amount,
               jsonb_agg(distinct p.payment_id) as payment_ids
          from portal_private.payment_allocations pa
          join portal_private.payments p on p.id=pa.payment_key
          join portal_private.deals d on d.id=pa.deal_key
          join portal_private.clients cl on cl.id=d.client_key
          join portal_private.contracts ct on ct.id=d.contract_key
         where cl.client_id=${clientId}
           and ct.contract_id=${contractId}
           and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
           and p.bank_fact_status::text='BANK_CONFIRMED'
           and p.payment_direction::text='INCOMING'
           and p.payment_kind::text='CLIENT_PAYMENT'
           and p.authority_state::text in ('VERIFIED','CONFIRMED')
           and p.lifecycle_state::text='ACTIVE'
           and pa.allocation_status::text='VERIFIED'
           and pa.authority_state::text in ('VERIFIED','CONFIRMED')
           and pa.lifecycle_state::text='ACTIVE'
         group by d.deal_id,trim(p.currency::text)
         order by d.deal_id,trim(p.currency::text)
      `;

      const authoritiesByDeal=new Map<string,any[]>(),receiptsByDeal=new Map<string,any[]>(),allowedPaymentIds=new Set<string>();
      for(const row of authorityRows){
        const dealId=String(row?.deal_id||'').trim();
        if(!dealId)continue;
        const bucket=authoritiesByDeal.get(dealId)||[];
        bucket.push(row);
        authoritiesByDeal.set(dealId,bucket);
      }
      for(const row of receiptRows){
        const dealId=String(row?.deal_id||'').trim();
        if(!dealId)continue;
        const bucket=receiptsByDeal.get(dealId)||[];
        bucket.push(row);
        receiptsByDeal.set(dealId,bucket);
        const ids=Array.isArray(row?.payment_ids)?row.payment_ids:[];
        for(const id of ids){const normalized=String(id||'').trim();if(normalized)allowedPaymentIds.add(normalized)}
      }
      for(const deal of deals){
        const dealId=String(deal?.deal_id||'').trim();
        applyClientPaymentAuthorityV7(deal,authoritiesByDeal.get(dealId)||[],receiptsByDeal.get(dealId)||[]);
      }
      if(Array.isArray(payments)){
        const incoming=payments.filter((payment:any)=>allowedPaymentIds.has(String(payment?.payment_id||'').trim()));
        for(const payment of incoming){
          payment.bank_fact_status='BANK_CONFIRMED';
          payment.payment_direction='INCOMING';
          payment.payment_kind='CLIENT_PAYMENT';
        }
        payments.splice(0,payments.length,...incoming);
      }

      return jsonResponse(response,payload,'authoritative');
    }catch(error){
      console.error('client payments Finance V7 projection failed',error);
      if(payload&&route){
        try{return jsonResponse(response,failClosedPayload(payload,route,'FINANCE_V7_PROJECTION_ERROR'),'fail-closed')}catch{}
      }
      return response;
    }
  };

  return options===undefined?previousServe(wrapped):previousServe(options,wrapped);
};
