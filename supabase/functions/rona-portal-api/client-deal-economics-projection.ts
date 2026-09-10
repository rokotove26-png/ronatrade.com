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
               w.business_status::text as workflow_business_status,
               coalesce(w.counter_offer_used,false) as counter_offer_used,
               w.finalized_at,
               d.quantity_tonnes as confirmed_quantity_tonnes,
               a.counter_price,
               nullif(trim(a.counter_currency::text),'') as counter_currency,
               coalesce(a.proposed_price,line.application_price) as application_price,
               coalesce(nullif(trim(a.proposed_currency::text),''),line.application_currency) as application_currency
          from portal_private.deals d
          join portal_private.client_applications a on a.linked_deal_key=d.id
          join portal_private.clients cl on cl.id=d.client_key
          join portal_private.contracts ct on ct.id=d.contract_key
          left join portal_private.owner_application_workflow w on w.application_key=a.id
          left join lateral (
            select coalesce(al.proposed_price,al.published_price) as application_price,
                   nullif(trim(al.currency::text),'') as application_currency
              from portal_private.application_lines al
             where al.application_key=a.id
             order by al.line_no
             limit 1
          ) line on true
         where cl.client_id=${requestClientId}
           and ct.contract_id=${requestContractId}
           and d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
           and d.client_key=a.client_key
           and d.contract_key=a.contract_key
         order by d.deal_id,
                  case
                    when coalesce(w.counter_offer_used,false)=true and w.finalized_at is not null then 0
                    when w.finalized_at is not null then 1
                    else 2
                  end,
                  w.finalized_at desc nulls last,
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
