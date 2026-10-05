// Payments V8 production hardening wrapper.
// Keeps the exact current production portal handler and adds only server-side aggregate/version projection
// plus a client-safe receipt-detail overlay sourced from the same Finance authorities used by Client Payments.
import { buildConfirmedFundingAggregate, buildPaymentsCurrencyAggregates } from '../_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';
import { sql, apiRoute, authenticate, send } from './shared.ts';
import { isAuthDbUnavailable } from './auth-db-connect-recovery.mjs';

const BASELINE='5aceffe2725a904e8e0ded562e483f012e861085';
const CLIENT_RECEIPT_DETAIL_CONTRACT='CLIENT_RECEIPT_DETAIL_RECONCILIATION_V1';
const EXECUTION_MONITORING_SCOPE='ADMIN_PAYMENTS_EXECUTION_ACTIVE_ONLY_V1';
const CLIENT_DEAL_EXECUTION_EXIT_CONTRACT='CLIENT_DEAL_RAIL_COMPLETION_ATTENTION_AND_PAYMENTS_EXIT_V1';
const CLIENT_DEAL_CLOSEOUT_CONTRACT='CLIENT_DEAL_CLOSEOUT_PROJECTION_V1';

function paymentMoneyAmount(value:any){
  const raw=value&&typeof value==='object'&&'amount' in value?value.amount:value;
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}
function paymentMoneyAuthority(value:any){
  return String(value&&typeof value==='object'?value.status||'':'').trim().toUpperCase();
}
function paymentDealExitedExecutionMonitoring(deal:any,railCompletedDealIds:Set<string>){
  const dealId=String(deal?.deal_id||'').trim();
  if(!dealId||!railCompletedDealIds.has(dealId))return false;
  const total=paymentMoneyAmount(deal?.total_to_receive);
  const received=paymentMoneyAmount(deal?.verified_received);
  const remaining=paymentMoneyAmount(deal?.remaining_to_receive);
  return String(deal?.financial_status||'').trim().toUpperCase()==='PAID'
    && paymentMoneyAuthority(deal?.total_to_receive)==='AUTHORITATIVE'
    && paymentMoneyAuthority(deal?.verified_received)==='AUTHORITATIVE'
    && paymentMoneyAuthority(deal?.remaining_to_receive)==='AUTHORITATIVE'
    && total!==null && total>0
    && remaining!==null && Math.abs(remaining)<=0.01
    && received!==null && received+0.01>=total;
}
async function railCompletedDealIds(){
  const rows=await sql`
    select distinct d.deal_id
    from portal_private.rail_deal_monitoring_control_v1 c
    join portal_private.deals d on d.id=c.deal_key
    where upper(c.monitoring_state)='COMPLETED'
  `;
  return new Set<string>(rows.map((row:any)=>String(row?.deal_id||'').trim()).filter(Boolean));
}
async function excludeDealsExitedExecutionMonitoring(projection:any){
  const completed=await railCompletedDealIds();
  const excluded:string[]=[];
  projection.deals=projection.deals.filter((deal:any)=>{
    if(!paymentDealExitedExecutionMonitoring(deal,completed))return true;
    excluded.push(String(deal?.deal_id||'').trim());
    return false;
  });
  projection.execution_monitoring_scope=EXECUTION_MONITORING_SCOPE;
  projection.execution_monitoring_excluded_deal_ids=excluded.sort();
  projection.execution_monitoring_excluded_count=excluded.length;
  return projection;
}
const nativeServe=Deno.serve.bind(Deno);
let capturedHandler:any=null;

(Deno as any).serve=function capturePortalHandler(first:any,second?:any){
  const handler=typeof first==='function'?first:second;
  if(typeof handler!=='function')throw new Error('PAYMENTS_V8_BASELINE_HANDLER_REQUIRED');
  capturedHandler=handler;
  return {finished:Promise.resolve(),shutdown(){},ref(){},unref(){}};
};

await import('./application-business-bootstrap-v2.ts');
(Deno as any).serve=nativeServe;
if(typeof capturedHandler!=='function')throw new Error('PAYMENTS_V8_BASELINE_HANDLER_CAPTURE_FAILED');

async function sessionAuthority(req:Request){
  if(req.method!=='GET'||apiRoute(new URL(req.url))!=='/session/authority')return null;
  const ctx=await authenticate(req);
  if(!ctx)return send(req.headers.get('origin'),401,{ok:false,code:'PORTAL_ACCESS_DENIED'});
  return send(req.headers.get('origin'),200,{
    ok:true,
    authority:'PORTAL_SESSION_AUTHORITY_V1',
    user:{portal_user_id:ctx.user,display_name:ctx.name,roles:ctx.roles},
    session:{id:ctx.sid,state:'ACTIVE',expires_at:ctx.exp}
  });
}

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
  await excludeDealsExitedExecutionMonitoring(projection);
  projection.currency_aggregates=buildPaymentsCurrencyAggregates(projection.deals);
  projection.funding_aggregate=buildConfirmedFundingAggregate(projection.deals);
  projection.projection_version_key=projectionVersionKey(projection);
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-payments-v8-hardening','server-aggregates-live-refresh-v2-execution-scope');
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
function clientDealsArray(payload:any,route:string){
  if(route==='/v1/client/context')return Array.isArray(payload?.data?.deals)?payload.data.deals:null;
  return Array.isArray(payload?.deals)?payload.deals:null;
}
function clientDealTerminal(deal:any){
  const business=String(deal?.business_status||deal?.current_status||'').trim().toUpperCase();
  const accounting=String(deal?.accounting_closure_status||'').trim().toUpperCase();
  const lifecycle=String(deal?.lifecycle_state||'').trim().toUpperCase();
  return ['CLOSED','COMPLETED','DONE','CANCELLED','RESOURCE_DENIED','REJECTED'].includes(business)
    || ['CLOSED','COMPLETED','DONE'].includes(accounting)
    || ['ARCHIVED','SUPERSEDED'].includes(lifecycle)
    || Boolean(deal?.closed_at);
}
function clientFullyPaidAuthoritative(deal:any){
  const total=paymentMoneyAmount(deal?.payment_obligation_amount);
  const received=paymentMoneyAmount(deal?.payment_received_amount);
  const remaining=paymentMoneyAmount(deal?.payment_remaining_amount);
  const percent=paymentMoneyAmount(deal?.payment_percent);
  const source=String(deal?.payment_source||'').trim().toUpperCase();
  const authority=String(deal?.payment_authority_state||'').trim().toUpperCase();
  const status=String(deal?.payment_status||'').trim().toUpperCase();
  if(status!=='PAID'||total===null||total<=0||received===null||received+0.01<total)return false;
  if(source==='FINANCE_V7_AUTHORITATIVE')return authority==='AUTHORITATIVE'&&remaining!==null&&Math.abs(remaining)<=0.01;
  if(source==='OWNER_DEAL_FINANCE_SUMMARY')return percent!==null&&percent>=100;
  return false;
}
async function hardenClientExecutionExit(req:Request,response:Response){
  if(req.method!=='GET'||apiRoute(new URL(req.url))!=='/v1/client/context'||!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return response;

  const url=new URL(req.url);
  const requestedClientId=String(url.searchParams.get('clientId')||'').trim();
  const requestedContractId=String(url.searchParams.get('contractId')||'').trim();
  if(!requestedClientId||!requestedContractId)return response;

  const payload=await response.clone().json().catch(()=>null);
  if(!payload)return response;
  const contract=clientContract(payload,'/v1/client/context');
  const responseClientId=String(contract?.client_id||'').trim();
  const responseContractId=String(contract?.contract_id||'').trim();
  if(responseClientId!==requestedClientId||responseContractId!==requestedContractId)return response;

  const deals=clientDealsArray(payload,'/v1/client/context');
  if(!deals)return response;
  const dealIds=[...new Set(deals.map((deal:any)=>String(deal?.deal_id||'').trim()).filter(Boolean))];
  if(!dealIds.length)return response;

  const rows=await sql`
    select
      d.deal_id,
      coalesce(mc.monitoring_state,'ACTIVE') as rail_monitoring_state,
      mc.completed_at as rail_monitoring_completed_at
    from portal_private.deals d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    left join portal_private.rail_deal_monitoring_control_v1 mc on mc.deal_key=d.id
    where cl.client_id=${responseClientId}
      and ct.contract_id=${responseContractId}
      and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
    order by d.deal_id
  `;
  const railByDeal=new Map(rows.map((row:any)=>[String(row?.deal_id||'').trim(),row]));
  const closeoutIds:string[]=[];

  for(const deal of deals){
    const dealId=String(deal?.deal_id||'').trim();
    const rail:any=railByDeal.get(dealId);
    const railCompleted=String(rail?.rail_monitoring_state||'').trim().toUpperCase()==='COMPLETED';
    const terminal=clientDealTerminal(deal);
    const fullyPaid=clientFullyPaidAuthoritative(deal);
    const closeout=railCompleted&&fullyPaid&&!terminal;
    deal.rail_monitoring_completed_at=rail?.rail_monitoring_completed_at||null;
    deal.post_rail_completion_attention=closeout;
    if(closeout){
      deal.client_deal_stage='ATTENTION';
      deal.client_deal_stage_label='Требует внимания';
      deal.client_deal_stage_source='RAIL_COMPLETED_AND_100_PERCENT_PAID_OWNER_RULE_V2';
      closeoutIds.push(dealId);
    }
    const paymentsExit=railCompleted&&fullyPaid;
    deal.client_payments_monitoring_active=!paymentsExit;
    deal.client_payments_monitoring_exclusion_reason=paymentsExit?'RAIL_COMPLETED_AND_100_PERCENT_PAID':null;
    deal.client_payments_monitoring_source=CLIENT_DEAL_EXECUTION_EXIT_CONTRACT;
  }

  if(closeoutIds.length){
    const closeoutRows=await sql`
      with scoped as (
        select
          d.id as deal_key,
          d.deal_id,
          ct.current_external_contract_number,
          a.product,
          a.delivery_basis,
          a.quantity_tonnes as source_quantity_tonnes,
          a.proposed_price as source_proposed_price,
          trim(a.proposed_currency::text) as source_proposed_currency,
          fv8.total_to_receive as obligation_amount,
          greatest(
            coalesce(fv8.total_to_receive,0)
            - coalesce(fv8.due_now,0)
            - coalesce(fv8.expected_not_due,0)
            - coalesce(fv8.future_conditional,0),0
          ) as received_amount,
          trim(fv8.obligation_currency::text) as finance_currency
        from portal_private.deals d
        join portal_private.clients cl on cl.id=d.client_key
        join portal_private.contracts ct on ct.id=d.contract_key
        left join lateral (
          select rr.application_key
          from portal_private.deal_registrations rr
          where rr.deal_key=d.id
          order by rr.registered_at desc
          limit 1
        ) rr on true
        left join portal_private.client_applications a on a.id=rr.application_key
        left join lateral (
          select f.*
          from portal_private.deal_finance_authority_payments_v8_read_v1 f
          where f.deal_key=d.id
            and f.is_terminal=true
            and upper(coalesce(f.authority_state,''))='AUTHORITATIVE'
            and upper(coalesce(f.lifecycle_state,''))='CURRENT'
            and f.source_locked=true
          order by f.effective_at desc nulls last,f.created_at desc
          limit 1
        ) fv8 on true
        where cl.client_id=${responseClientId}
          and ct.contract_id=${responseContractId}
          and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(closeoutIds)}::jsonb))
      ),
      trusted_wagons as (
        select distinct cp.effective_deal_key as deal_key,cp.wagon_number
        from portal_private.rail_operational_current_position_v1 cp
        join scoped s on s.deal_key=cp.effective_deal_key
        where cp.position_status='TRUSTED'
          and cp.wagon_number is not null
      ),
      weight_observations as (
        select
          r.effective_deal_key as deal_key,
          r.wagon_number,
          r.source_object_id,
          r.source_received_at,
          cell.cargo_weight_tonnes
        from portal_private.rail_xlsx_resolution_effective_v1 r
        join trusted_wagons tw
          on tw.deal_key=r.effective_deal_key
         and tw.wagon_number=r.wagon_number
        cross join lateral (
          select
            case
              when jsonb_typeof(c->'rawValue')='number' then (c->>'rawValue')::numeric
              when coalesce(c->>'rawValue','') ~ '^[0-9]+([.,][0-9]+)?$' then replace(c->>'rawValue',',','.')::numeric
              else null::numeric
            end as cargo_weight_tonnes
          from jsonb_array_elements(coalesce(r.source_row->'cells','[]'::jsonb)) c
          where lower(btrim(coalesce(c->>'header','')))='вес груза'
          limit 1
        ) cell
        where cell.cargo_weight_tonnes>0
      ),
      per_wagon as (
        select
          tw.deal_key,
          tw.wagon_number,
          count(distinct wo.cargo_weight_tonnes)::int as weight_variant_count,
          min(wo.cargo_weight_tonnes) as stable_weight_tonnes,
          count(distinct wo.source_object_id)::int as weight_source_count
        from trusted_wagons tw
        left join weight_observations wo
          on wo.deal_key=tw.deal_key
         and wo.wagon_number=tw.wagon_number
        group by tw.deal_key,tw.wagon_number
      ),
      quantity as (
        select
          s.deal_key,
          count(pw.wagon_number)::int as trusted_wagon_count,
          count(pw.wagon_number) filter(
            where pw.weight_variant_count=1
              and pw.stable_weight_tonnes>0
              and pw.weight_source_count>0
          )::int as stable_weight_wagon_count,
          case
            when count(pw.wagon_number)>0
             and count(pw.wagon_number)=count(pw.wagon_number) filter(
               where pw.weight_variant_count=1
                 and pw.stable_weight_tonnes>0
                 and pw.weight_source_count>0
             )
            then sum(pw.stable_weight_tonnes)
            else null::numeric
          end as actual_quantity_tonnes
        from scoped s
        left join per_wagon pw on pw.deal_key=s.deal_key
        group by s.deal_key
      )
      select
        s.deal_id,
        s.current_external_contract_number,
        s.product,
        s.delivery_basis,
        q.trusted_wagon_count,
        q.stable_weight_wagon_count,
        q.actual_quantity_tonnes,
        case
          when coalesce(s.source_proposed_price,0)>0
           and coalesce(s.source_quantity_tonnes,0)>0
           and upper(btrim(coalesce(s.source_proposed_currency,'')))=upper(btrim(coalesce(s.finance_currency,'')))
           and coalesce(s.obligation_amount,0)>0
           and abs(s.source_proposed_price*s.source_quantity_tonnes-s.obligation_amount)<=0.01
          then s.source_proposed_price
          else null::numeric
        end as unit_price,
        s.received_amount as paid_amount,
        s.finance_currency as currency
      from scoped s
      left join quantity q on q.deal_key=s.deal_key
      order by s.deal_id
    `;
    const closeoutByDeal=new Map(closeoutRows.map((row:any)=>[String(row?.deal_id||'').trim(),row]));
    for(const deal of deals){
      const dealId=String(deal?.deal_id||'').trim();
      if(!closeoutIds.includes(dealId))continue;
      const row:any=closeoutByDeal.get(dealId);
      const actualQuantity=paymentMoneyAmount(row?.actual_quantity_tonnes);
      const unitPrice=paymentMoneyAmount(row?.unit_price);
      const paidAmount=paymentMoneyAmount(row?.paid_amount);
      const actualAmount=actualQuantity!==null&&unitPrice!==null?Math.round((actualQuantity*unitPrice+Number.EPSILON)*100)/100:null;
      const balance=actualAmount!==null&&paidAmount!==null?Math.round((actualAmount-paidAmount+Number.EPSILON)*100)/100:null;
      const ready=actualQuantity!==null&&actualQuantity>0
        && unitPrice!==null&&unitPrice>0
        && paidAmount!==null
        && Number(row?.trusted_wagon_count||0)>0
        && Number(row?.trusted_wagon_count||0)===Number(row?.stable_weight_wagon_count||0);
      deal.closeout_stage='CLOSEOUT';
      deal.closeout_product_status='SHIPPED';
      deal.closeout_product_status_label='Отгружено';
      deal.closeout_projection_state=ready?'READY':'SOURCE_INCOMPLETE';
      deal.closeout_actual_quantity_tonnes=ready?actualQuantity:null;
      deal.closeout_deal_unit_price=ready?unitPrice:null;
      deal.closeout_currency=String(row?.currency||deal?.payment_currency||'').trim()||null;
      deal.closeout_paid_amount=ready?paidAmount:null;
      deal.closeout_actual_amount=ready?actualAmount:null;
      deal.closeout_balance_amount=ready?balance:null;
      deal.closeout_balance_direction=!ready||balance===null?null:balance>0.01?'CLIENT_OWES_RONA':balance<-0.01?'RONA_OWES_CLIENT':'SETTLED';
      deal.closeout_contract_number=String(row?.current_external_contract_number||contract?.current_external_contract_number||'').trim()||null;
      deal.closeout_delivery_basis=String(row?.delivery_basis||'').trim()||null;
      deal.closeout_product=String(row?.product||'').trim()||null;
      deal.closeout_quantity_source=ready?'RAIL_LOGISTICS_TRUSTED_WAGONS_STABLE_WEIGHT_HISTORY_V1':null;
      deal.closeout_price_source=ready?'CLIENT_APPLICATION_PRICE_RECONCILED_TO_FINANCE_V8_V1':null;
      deal.closeout_projection_source=CLIENT_DEAL_CLOSEOUT_CONTRACT;
    }
  }

  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-client-deal-execution-exit',CLIENT_DEAL_EXECUTION_EXIT_CONTRACT);
  headers.set('x-rona-client-deal-closeout',CLIENT_DEAL_CLOSEOUT_CONTRACT);
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
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
  let base:Response;
  try {
    const authority=await sessionAuthority(req);
    if(authority)return authority;
    base=await capturedHandler(req,info);
  } catch(error) {
    if(isAuthDbUnavailable(error))
      return send(req.headers.get('origin'),503,{ok:false,code:'AUTH_BACKEND_UNAVAILABLE',request_id:(error as {requestId:string}).requestId});
    throw error;
  }
  const adminHardened:Response=await hardenBootstrap(req,base);
  let clientHardened:Response=adminHardened;
  try{
    clientHardened=await hardenClientExecutionExit(req,adminHardened);
  }catch(error){
    console.error('CLIENT_DEAL_EXECUTION_EXIT_PROJECTION_FAIL',error);
  }
  try{
    return await hardenClientReceiptDetails(req,clientHardened);
  }catch(error){
    console.error('CLIENT_RECEIPT_DETAIL_RECONCILIATION_FAIL',error);
    return clientHardened;
  }
});
