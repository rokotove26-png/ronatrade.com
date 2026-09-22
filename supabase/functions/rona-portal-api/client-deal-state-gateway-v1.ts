// Canonical Client Deal State gateway.
// Adds one read-only deal-state endpoint on top of the exact currently deployed portal handler.
// All unrelated routes delegate byte-for-byte to the captured production handler.

import {
  sql,
  apiRoute,
  send,
  origins,
} from "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/dd8f9c561727d79d8134851677db3d22e84e18c8/supabase/functions/rona-portal-api/shared.ts";
import {
  CLIENT_DEAL_STATE_CONTRACT,
  projectClientCanonicalDealState,
} from "./client-deal-state-v1.mjs";

const LIVE_SOURCE =
  "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/dd8f9c561727d79d8134851677db3d22e84e18c8/supabase/functions/rona-portal-api/payments-v8-production-hardening.ts";

const nativeServe=Deno.serve.bind(Deno);
let liveHandler:any=null;

(Deno as any).serve=function captureLiveHandler(first:any,second?:any){
  const handler=typeof first==='function'?first:second;
  if(typeof handler!=='function')throw new Error('CLIENT_DEAL_STATE_LIVE_HANDLER_REQUIRED');
  liveHandler=handler;
  return{finished:Promise.resolve(),shutdown(){},ref(){},unref(){}};
};

await import(LIVE_SOURCE);
(Deno as any).serve=nativeServe;
if(typeof liveHandler!=='function')throw new Error('CLIENT_DEAL_STATE_LIVE_HANDLER_CAPTURE_FAILED');

function clean(value:unknown,max=200){
  const s=String(value??'').trim();
  return s&&s.length<=max?s:null;
}
function exactDealId(value:unknown){
  const s=clean(value,80);
  return s&&/^DEAL-\d{4}-\d{3,}$/i.test(s)?s:null;
}
function contextRequest(req:Request,clientId:string,contractId:string){
  const u=new URL(req.url);
  u.pathname=u.pathname.replace(/\/v1\/client\/deal-state$/,'/v1/client/context');
  u.search='';
  u.searchParams.set('clientId',clientId);
  u.searchParams.set('contractId',contractId);
  const headers=new Headers(req.headers);
  headers.set('accept','application/json');
  headers.set('x-rona-client-source','CLIENT_DEAL_STATE_V1');
  headers.set('x-rona-client-refresh-reason','DEAL_PASSPORT_OPEN');
  return new Request(u.toString(),{method:'GET',headers});
}
function exactApplication(payload:any,deal:any,dealId:string){
  const apps=Array.isArray(payload?.data?.applications)?payload.data.applications:[];
  const applicationId=String(deal?.passport_application_id||'').trim();
  if(applicationId){
    const exact=apps.find((a:any)=>String(a?.application_id||'').trim()===applicationId&&String(a?.deal_id||'').trim()===dealId);
    if(exact)return exact;
  }
  const matches=apps.filter((a:any)=>String(a?.deal_id||'').trim()===dealId);
  return matches.length===1?matches[0]:matches[0]||null;
}
async function exactMeta(clientId:string,contractId:string,dealId:string){
  const rows=await sql`
    select
      d.id::text as deal_key,
      d.deal_id,
      r.resource_status,
      r.resource_source,
      r.resource_confirmed_at,
      exists(
        select 1
        from portal_private.documents doc
        where doc.deal_key=d.id
          and upper(doc.document_type::text) in ('SIGNED_ADDENDUM','SIGNED_SUPPLEMENT','ПОДПИСАННОЕ ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ')
          and doc.authority_state::text in ('CONFIRMED','VERIFIED')
          and doc.lifecycle_state::text='ACTIVE'
      ) as signed_documents_confirmed
    from portal_private.deals d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    cross join lateral portal_private.resolve_deal_resource_state(d.id) r
    where cl.client_id=${clientId}
      and ct.contract_id=${contractId}
      and d.deal_id=${dealId}
    limit 2
  `;
  return rows.length===1?rows[0]:null;
}
async function railModel(meta:any,dealId:string){
  if(!meta?.deal_key)return null;
  try{
    const rows=await sql`
      select portal_private.rona_rail_deal_map_read_model_core_v2(
        ${meta.deal_key}::uuid,
        ${dealId}::text
      ) as data
    `;
    const model=rows[0]?.data;
    if(!model||String(model?.modelVersion||'')!=='RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4')return null;
    const deals=Array.isArray(model?.deals)?model.deals:[];
    if(deals.length!==1||String(deals[0]?.dealId||deals[0]?.deal_id||'')!==dealId)return null;
    return model;
  }catch(error){
    console.error('CLIENT_DEAL_STATE_RAIL_OPTIONAL_UNAVAILABLE',dealId,error);
    return null;
  }
}
async function dealState(req:Request,info:any){
  const origin=req.headers.get('origin');
  if(origin&&!origins.has(origin))return send(null,403,{ok:false,code:'ORIGIN_DENIED'});
  if(req.method!=='GET')return send(origin,405,{ok:false,code:'METHOD_NOT_ALLOWED'});

  // Authentication, effective Client role and Admin Client impersonation are enforced once by
  // the delegated production /v1/client/context handler below. Avoid a second auth round-trip here.

  const url=new URL(req.url);
  const clientId=clean(url.searchParams.get('clientId'),160);
  const contractId=clean(url.searchParams.get('contractId'),160);
  const dealId=exactDealId(url.searchParams.get('dealId'));
  if(!clientId||!contractId||!dealId)return send(origin,400,{ok:false,code:'CLIENT_DEAL_CONTEXT_REQUIRED'});

  const currentResponse:Response=await liveHandler(contextRequest(req,clientId,contractId),info);
  if(!currentResponse.ok){
    const body=await currentResponse.json().catch(()=>({ok:false,code:`CLIENT_CONTEXT_${currentResponse.status}`}));
    return send(origin,currentResponse.status,body);
  }
  const payload:any=await currentResponse.json().catch(()=>null);
  const data=payload?.data;
  const contract=data?.contract;
  if(String(contract?.client_id||'').trim()!==clientId||String(contract?.contract_id||'').trim()!==contractId){
    return send(origin,409,{ok:false,code:'CLIENT_DEAL_CONTEXT_MISMATCH'});
  }

  const deals=Array.isArray(data?.deals)?data.deals:[];
  const matches=deals.filter((d:any)=>String(d?.deal_id||'').trim()===dealId);
  if(matches.length!==1)return send(origin,404,{ok:false,code:'CLIENT_DEAL_NOT_FOUND'});
  const deal=matches[0];
  const application=exactApplication(payload,deal,dealId);
  const meta=await exactMeta(clientId,contractId,dealId);
  if(!meta)return send(origin,404,{ok:false,code:'CLIENT_DEAL_NOT_FOUND'});

  const rail=await railModel(meta,dealId);
  const state=projectClientCanonicalDealState({
    context:contract,
    deal,
    application,
    meta:{
      resource_status:meta.resource_status,
      resource_source:meta.resource_source,
      resource_confirmed_at:meta.resource_confirmed_at,
      signed_documents_confirmed:meta.signed_documents_confirmed===true,
      documents_source:'CURRENT_ACTIVE_CONFIRMED_DEAL_DOCUMENTS'
    },
    railModel:rail,
    generatedAt:new Date().toISOString()
  });

  const response=send(origin,200,{ok:true,data:state,projection_contract:CLIENT_DEAL_STATE_CONTRACT});
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-client-deal-state',CLIENT_DEAL_STATE_CONTRACT);
  headers.set('x-rona-client-deal-state-source','CONTEXT_FINANCE_V7_RESOURCE_RAIL_V4');
  headers.delete('content-length');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

nativeServe(async(req:Request,info:any)=>{
  const route=apiRoute(new URL(req.url));
  if(route==='/v1/client/deal-state')return await dealState(req,info);
  return await liveHandler(req,info);
});
