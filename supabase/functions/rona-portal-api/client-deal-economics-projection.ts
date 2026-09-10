import { sql } from "./shared.ts";
import { applyClientDealPassportEconomics } from "./client-deal-economics.js";

const PROJECTION_VERSION='owner-production-regression-430-authoritative-economics-v1';
const previousServe:any=Deno.serve.bind(Deno);

function exactContext(payload:any,clientId:string,contractId:string):boolean{
  const responseClientId=String(payload?.data?.contract?.client_id||'').trim();
  const responseContractId=String(payload?.data?.contract?.contract_id||'').trim();
  return Boolean(clientId&&contractId&&responseClientId===clientId&&responseContractId===contractId);
}

(Deno as any).serve=function clientDealEconomicsServe(first:any,second?:any){
  const handler=typeof first==='function'?first:second;
  const options=typeof first==='function'?undefined:first;
  if(typeof handler!=='function')return previousServe(first,second);

  const wrapped=async(req:Request,info:any)=>{
    const response:Response=await handler(req,info);
    try{
      const url=new URL(req.url);
      if(req.method!=='GET'||!url.pathname.endsWith('/v1/client/context')||!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return response;

      const payload:any=await response.clone().json();
      const requestClientId=String(url.searchParams.get('clientId')||'').trim();
      const requestContractId=String(url.searchParams.get('contractId')||'').trim();
      if(!exactContext(payload,requestClientId,requestContractId))return response;

      const deals=Array.isArray(payload?.data?.deals)?payload.data.deals:[];
      const dealIds=[...new Set(deals.map((deal:any)=>String(deal?.deal_id||'').trim()).filter(Boolean))];
      if(!dealIds.length)return response;

      const rows=await sql`
        select d.deal_id,
               a.application_id,
               a.status::text as application_status,
               aw.business_status::text as workflow_business_status,
               coalesce(aw.counter_offer_used,false) as counter_offer_used,
               aw.client_counter_response::text as client_counter_response,
               aw.finalized_at,
               case when dw.quantity_confirmed_at is not null then dw.quantity_tonnes_value else null end as confirmed_quantity_tonnes,
               aw.counter_price,
               nullif(trim(aw.counter_currency::text),'') as counter_currency,
               a.proposed_price as application_price,
               nullif(trim(a.proposed_currency::text),'') as application_currency,
               dr.registered_at
          from portal_private.deals d
          join portal_private.deal_registrations dr on dr.deal_key=d.id
          join portal_private.client_applications a on a.id=dr.application_key
          join portal_private.clients cl on cl.id=d.client_key
          join portal_private.contracts ct on ct.id=d.contract_key
          left join portal_private.owner_application_workflow aw on aw.application_key=a.id
          left join portal_private.owner_deal_workflow dw on dw.deal_key=d.id
         where cl.client_id=${requestClientId}
           and ct.contract_id=${requestContractId}
           and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
           and a.linked_deal_key=d.id
           and d.client_key=a.client_key
           and d.contract_key=a.contract_key
         order by d.deal_id,
                  dr.registered_at desc,
                  aw.finalized_at desc nulls last,
                  a.application_id desc
      `;

      const byDeal=new Map<string,any>();
      for(const row of rows){
        const dealId=String(row?.deal_id||'').trim();
        if(dealId&&!byDeal.has(dealId))byDeal.set(dealId,row);
      }

      let changed=false;
      for(const deal of deals){
        const dealId=String(deal?.deal_id||'').trim();
        const row=byDeal.get(dealId);
        if(!row)continue;
        applyClientDealPassportEconomics(deal,row);
        changed=true;
      }
      if(!changed)return response;

      const headers=new Headers(response.headers);
      headers.delete('content-length');
      headers.set('content-type','application/json; charset=utf-8');
      headers.set('x-rona-client-deal-economics',PROJECTION_VERSION);
      return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
    }catch(error){
      console.error('client deal economics projection failed',error);
      return response;
    }
  };

  return options===undefined?previousServe(wrapped):previousServe(options,wrapped);
};
