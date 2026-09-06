import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
const enrichmentSql = DB ? postgres(DB,{prepare:false,max:1,idle_timeout:1,connect_timeout:3,max_lifetime:15}) : null;
const nativeServe:any = Deno.serve.bind(Deno);
const MAIN_MARKER = "/rona-portal-api";
const PREVIEW_ROUTE = "/v1/client/context";
const inflight = new Map<string,Promise<Response>>();

function normalizedRequest(req:Request):Request|null {
  if(req.method!=="GET") return null;
  const incoming=new URL(req.url);
  if(!incoming.pathname.endsWith(PREVIEW_ROUTE)) return null;
  const normalized=new URL(req.url);
  normalized.pathname=`${MAIN_MARKER}${PREVIEW_ROUTE}`;
  return new Request(normalized,req);
}

async function enrichApplications(response:Response):Promise<Response> {
  if(!response.ok||!enrichmentSql||(response.headers.get("content-type")||"").includes("application/json")) return response;
  try {
    const payload:any=await response.clone().json();
    const applications=Array.isArray(payload?.data?.applications)?payload.data.applications:[];
    const ids=[...new Set(applications.map((a:any)=>String(a?.application_id||"").trim()).filter(Boolean))];
    if(!ids.length) return response;
    const rows=await enrichmentSql`
      select a.application_id,
             line.application_price,
             line.application_currency,
             case
               when coalesce(resource.resource_status,'')='RESOURCE_CONFIRMED' then 'RESOURCE_CONFIRMED'
               when w.supplier_approved_at is not null then 'RESOURCE_CONFIRMED'
               else 'RESOURCE_NOT_CONFIRMED'
             end as resource_status,
             case
               when coalesce(resource.resource_status,'')='RESOURCE_CONFIRMED' then 'Ресурс подтвержден'
               when w.supplier_approved_at is not null then 'Ресурс подтвержден'
               else 'Ресурс не подтвержден'
             end as resource_label,
             coalesce(resource.resource_confirmed_at,w.supplier_approved_at) as resource_confirmed_at,
             case
               when coalesce(resource.resource_status,'')<>'' then resource.resource_source
               when w.supplier_approved_at is not null then 'OWNER_APPLICATION_WORKFLOW'
               else 'NO_AUTHORITATIVE_RESOURCE_FACT'
             end as resource_source
        from portal_private.client_applications a
        left join lateral (
          select coalesce(al.proposed_price,al.published_price) as application_price,
                 trim(al.currency::text) as application_currency
            from portal_private.application_lines al
           where al.application_key=a.id
           order by al.line_no
           limit 1
        ) line on true
        left join portal_private.owner_application_workflow w on w.application_key=a.id
        left join lateral portal_private.resolve_deal_resource_state(a.linked_deal_key) resource on a.linked_deal_key is not null
       where a.application_id in (select value from jsonb_array_elements_text(${enrichmentSql.json(ids)}::jsonb))
    `;
    const byId=new Map(rows.map((r:any)=>[String(r.application_id),r]));
    for(const application of applications){
      const row:any=byId.get(String(application.application_id));
      if(!row) continue;
      application.application_price=row.application_price;
      application.application_currency=row.application_currency;
      application.resource_status=row.resource_status;
      application.resource_label=row.resource_label;
      application.resource_confirmed_at=row.resource_confirmed_at;
      application.resource_source=row.resource_source;
    }
    const headers=new Headers(response.headers);
    headers.delete("content-length");
    headers.set("x-rona-pr429-preview-backend","candidate-6bef355-context-only");
    return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
  } catch(error) {
    console.error("PR429 preview context enrichment failed",error);
    return response;
  }
}

(Deno as any).serve=function patchedServe(first:any,second?:any){
  const handler=typeof first==="function"?first:second;
  const options=typeof first==="function"?undefined:first;
  if(typeof handler!=="function") return nativeServe(first,second);
  const wrapped=async(req:Request,info:any)=>{
    const normalized=normalizedRequest(req);
    if(!normalized) return new Response(JSON.stringify({ok:false,code:"PR429_PREVIEW_CONTEXT_ONLY"}),{status:404,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
    const authorization=normalized.headers.get("authorization")||"";
    const key=`${authorization}\n${new URL(normalized.url).search}`;
    const existing=inflight.get(key);
    if(existing) return (await existing).clone();
    const task=(async()=>enrichApplications(await handler(normalized,info)))();
    inflight.set(key,task);
    try{return (await task).clone()}
    finally{if(inflight.get(key)===task) inflight.delete(key)}
  };
  return options===undefined?nativeServe(wrapped):nativeServe(options,wrapped);
};

// Isolated non-production transport only. The candidate backend source is pinned to
// the exact Owner-tested PR HEAD whose projectClientDeals() defines passport_amount,
// passport_currency, passport_amount_source and passport_application_id.
import "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/6bef3559f42bcaf9a50a34871110a6fee38cbd5b/supabase/functions/rona-portal-api/index.ts";
