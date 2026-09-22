import postgres from "npm:postgres@3.4.7";
import {createRemoteJWKSet,jwtVerify} from "npm:jose@6.1.0";
import {CLIENT_RAIL_CANONICAL_CONTRACT,projectClientRailCanonical} from "./client-rail-canonical-projection-v1.mjs";
import {CLIENT_DEAL_STATE_CONTRACT,projectClientCanonicalDealState} from "./client-deal-state-v1.mjs";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"https://sxawrwzeobaqwwmlkzws.supabase.co";
const DB=Deno.env.get("SUPABASE_DB_URL");
if(!DB)throw new Error("SUPABASE_DB_URL missing");
const sql=postgres(DB,{prepare:false,max:2,idle_timeout:1,connect_timeout:3,max_lifetime:15});
const PROD=`${SUPABASE_URL}/functions/v1/rona-portal-api`;
const SLUG='rona-portal-api-candidate-20260817';
const VERSION='CLIENT_RAIL_ISOLATED_V1_PLUS_CANONICAL_DEAL_STATE_V1';
const SOURCE='SERVER_AUTHORITATIVE_REALIZATION_V2_CURRENT_PROJECTION';
const QA_AUDIENCE='rona-issue430-postrelease-proof';
const QA_WORKFLOW='/ronatrade.com/.github/workflows/client-postrelease-state-consistency-qa.yml@';
const GH_JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const norm=(v:unknown)=>String(v??'').trim();
const upper=(v:unknown)=>norm(v).toUpperCase();
const routeOf=(pathname:string)=>{const marker=`/${SLUG}`;const i=pathname.indexOf(marker);return i>=0?(pathname.slice(i+marker.length)||'/'):pathname};
function send(status:number,body:unknown,headersIn?:Headers){const h=new Headers(headersIn||undefined);h.set('content-type','application/json; charset=utf-8');h.set('cache-control','no-store');h.set('x-rona-portal-backend-slot','candidate');h.set('x-rona-portal-backend-version',VERSION);h.delete('content-length');h.delete('etag');return new Response(JSON.stringify(body),{status,headers:h})}
async function proxy(req:Request,route:string,search:string){const h=new Headers();for(const name of ['authorization','content-type','accept','x-request-id','x-correlation-id','x-idempotency-key','x-current-document-id','x-rona-client-source','x-rona-client-refresh-reason','x-rona-admin-impersonation-token','x-rona-impersonation-tab']){const v=req.headers.get(name);if(v)h.set(name,v)}if(!h.has('accept'))h.set('accept','application/json');const init:RequestInit={method:req.method,headers:h};if(!['GET','HEAD'].includes(req.method))init.body=await req.clone().arrayBuffer();return fetch(`${PROD}${route}${search}`,init)}
const resourceLabel=(s:string)=>s==='RESOURCE_CONFIRMED'?'Ресурс подтверждён':s==='RESOURCE_DENIED'?'Ресурс не подтверждён':'Ресурс ожидает подтверждения';
function realization(deal:any,row:any){const business=upper(row.deal_business_status||deal?.business_status),closed=['CLOSED','COMPLETED','DONE'].includes(business),resource=upper(row.resource_status)||'RESOURCE_PENDING',docs=Boolean(row.signed_supplement_document_key&&row.signed_supplement_checked_at),resourceDone=resource==='RESOURCE_CONFIRMED',resourceDenied=resource==='RESOURCE_DENIED',payment=upper(deal?.payment_status),paid=['PAID','PAYMENT_CONFIRMED'].includes(payment),overdue=payment==='OVERDUE',executing=business==='EXECUTING';const st=(key:string,state:string,detail:string)=>({key,state,detail});return{source:SOURCE,stages:[st('contract','DONE','Сделка зарегистрирована'),st('documents',closed||docs?'DONE':'CURRENT',closed||docs?'Подписанные документы подтверждены системой':'Ожидается подтверждение подписанных документов'),st('resource',closed||resourceDone?'DONE':resourceDenied?'BLOCKED':docs?'CURRENT':'PENDING',closed||resourceDone?'Ресурс подтверждён':resourceDenied?'Ресурс не подтверждён':'Ожидается подтверждение ресурса'),st('payment',closed||paid?'DONE':overdue?'BLOCKED':resourceDone?'CURRENT':'PENDING',closed||paid?'Оплата подтверждена':overdue?'Оплата просрочена':'Ожидается подтверждение оплаты'),st('logistics',closed?'DONE':executing?'CURRENT':'PENDING',closed?'Отгрузка и поставка завершены':executing?'Сделка находится в исполнении':'Отгрузка ещё не подтверждена'),st('close',closed?'DONE':'PENDING',closed?'Сделка завершена':'Завершение сделки ещё не подтверждено')]}}
async function rowsFor(clientId:string|null,contractId:string|null,dealIds:string[]){return sql`
 select d.deal_id,d.business_status::text as deal_business_status,r.resource_status,r.resource_source,r.resource_confirmed_at,w.signed_supplement_document_key,w.signed_supplement_checked_at
 from portal_private.deals d
 join portal_private.clients cl on cl.id=d.client_key
 join portal_private.contracts ct on ct.id=d.contract_key
 left join portal_private.owner_deal_workflow w on w.deal_key=d.id
 left join lateral portal_private.resolve_deal_resource_state(d.id) r on true
 where d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
   and (${clientId}::text is null or cl.client_id=${clientId})
   and (${contractId}::text is null or ct.contract_id=${contractId})
 order by d.deal_id`}
async function enrich(payload:any,clientId:string,contractId:string){const rc=norm(payload?.data?.contract?.client_id),rk=norm(payload?.data?.contract?.contract_id);if(rc!==clientId||rk!==contractId)throw new Error('CONTEXT_SCOPE_MISMATCH');const deals:any[]=Array.isArray(payload?.data?.deals)?payload.data.deals:[],ids:string[]=[...new Set<string>(deals.map((d:any)=>norm(d?.deal_id)).filter((v:string)=>Boolean(v)))];if(!ids.length)return payload;const rows=await rowsFor(clientId,contractId,ids),map=new Map(rows.map((r:any)=>[norm(r.deal_id),r]));for(const deal of deals){const row:any=map.get(norm(deal?.deal_id));if(!row)continue;const resource=upper(row.resource_status)||'RESOURCE_PENDING';deal.resource_status=resource;deal.resource_label=resourceLabel(resource);deal.resource_source=norm(row.resource_source)||'NO_AUTHORITATIVE_RESOURCE_FACT';deal.resource_confirmed_at=row.resource_confirmed_at||null;deal.resource_confirmed=resource==='RESOURCE_CONFIRMED';deal.realization_status=realization(deal,row)}return payload}
async function clientRailCanonical(req:Request,u:URL){
  if(req.method!=='GET')return send(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  const clientId=norm(u.searchParams.get('clientId')),contractId=norm(u.searchParams.get('contractId'));
  if(!clientId||!contractId)return send(400,{ok:false,code:'CLIENT_CONTRACT_CONTEXT_REQUIRED'});

  // Authorization is delegated to the already-stable production Client context route.
  // Only an exact successful context response may unlock the read-only Rail projection.
  const contextUpstream=await proxy(req,'/v1/client/context','?clientId='+encodeURIComponent(clientId)+'&contractId='+encodeURIComponent(contractId));
  const contextPayload:any=await contextUpstream.clone().json().catch(()=>null);
  if(!contextUpstream.ok||!contextPayload||contextPayload.ok===false){
    return send(contextUpstream.status,contextPayload||{ok:false,code:'CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE'},contextUpstream.headers);
  }
  const responseClientId=norm(contextPayload?.data?.contract?.client_id);
  const responseContractId=norm(contextPayload?.data?.contract?.contract_id);
  if(responseClientId!==clientId||responseContractId!==contractId){
    return send(404,{ok:false,code:'CONTEXT_NOT_FOUND'});
  }

  try{
    const contexts=await sql`
      select cl.id as client_key,cl.client_id,ct.id as contract_key,ct.contract_id
      from portal_private.clients cl
      join portal_private.contracts ct on ct.client_key=cl.id
      where cl.client_id=${clientId} and ct.contract_id=${contractId}
      limit 2
    `;
    if(contexts.length!==1)return send(404,{ok:false,code:'CONTEXT_NOT_FOUND'});
    const context=contexts[0];
    const deals=await sql`
      select d.id as deal_key,d.deal_id,d.business_status,d.lifecycle_state::text as lifecycle_state
      from portal_private.deals d
      where d.client_key=${context.client_key}::uuid
        and d.contract_key=${context.contract_key}::uuid
        and d.lifecycle_state='ACTIVE'
      order by d.deal_id
    `;
    const readModels:any[]=[];
    for(const deal of deals){
      const rows=await sql`
        select portal_private.rona_rail_deal_map_read_model_core_v1(d.id,d.deal_id) as data
        from portal_private.deals d
        where d.id=${deal.deal_key}::uuid
          and d.deal_id=${deal.deal_id}::text
          and d.client_key=${context.client_key}::uuid
          and d.contract_key=${context.contract_key}::uuid
          and d.lifecycle_state='ACTIVE'
        limit 1
      `;
      const model=rows[0]?.data,modelDeals=Array.isArray(model?.deals)?model.deals:[];
      if(!model||String(model.modelVersion||'')!=='RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4'||modelDeals.length!==1||String(modelDeals[0]?.dealId||'')!==String(deal.deal_id)||String(modelDeals[0]?.dealKey||'')!==String(deal.deal_key)){
        return send(503,{ok:false,code:'CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE',retryable:true});
      }
      readModels.push(model);
    }
    const data=projectClientRailCanonical({context:{client_id:clientId,contract_id:contractId},deals,readModels});
    return send(200,{ok:true,data,projection_contract:CLIENT_RAIL_CANONICAL_CONTRACT});
  }catch(error){
    console.error('CLIENT_RAIL_ISOLATED_BACKEND_FAILED',error);
    return send(503,{ok:false,code:'CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE',retryable:true});
  }
}

function exactApplication(payload:any,deal:any,dealId:string){
  const applications=Array.isArray(payload?.data?.applications)?payload.data.applications:[];
  const passportApplicationId=norm(deal?.passport_application_id);
  if(passportApplicationId){
    const exact=applications.find((a:any)=>norm(a?.application_id)===passportApplicationId&&(norm(a?.deal_id)===dealId||!norm(a?.deal_id)));
    if(exact)return exact;
  }
  const byDeal=applications.filter((a:any)=>norm(a?.deal_id)===dealId);
  return byDeal.length===1?byDeal[0]:byDeal[0]||null;
}
async function canonicalDealMeta(clientId:string,contractId:string,dealId:string){
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
async function canonicalDealRail(meta:any,dealId:string){
  if(!meta?.deal_key)return null;
  try{
    const rows=await sql`
      select portal_private.rona_rail_deal_map_read_model_core_v1(
        ${meta.deal_key}::uuid,
        ${dealId}::text
      ) as data
    `;
    const model=rows[0]?.data,modelDeals=Array.isArray(model?.deals)?model.deals:[];
    if(!model||String(model.modelVersion||'')!=='RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4'||modelDeals.length!==1||norm(modelDeals[0]?.dealId||modelDeals[0]?.deal_id)!==dealId)return null;
    return model;
  }catch(error){
    console.error('CLIENT_DEAL_STATE_RAIL_OPTIONAL_UNAVAILABLE',dealId,error);
    return null;
  }
}
async function clientDealState(req:Request,u:URL){
  if(req.method!=='GET')return send(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  const clientId=norm(u.searchParams.get('clientId')),contractId=norm(u.searchParams.get('contractId')),dealId=norm(u.searchParams.get('dealId'));
  if(!clientId||!contractId||!/^DEAL-\d{4}-\d{3,}$/i.test(dealId))return send(400,{ok:false,code:'CLIENT_DEAL_CONTEXT_REQUIRED'});

  // Authorization and effective Client/Admin-impersonation scope are delegated to the
  // stable production Client context endpoint before any direct database read occurs.
  const contextSearch='?clientId='+encodeURIComponent(clientId)+'&contractId='+encodeURIComponent(contractId);
  const contextUpstream=await proxy(req,'/v1/client/context',contextSearch);
  const payload:any=await contextUpstream.clone().json().catch(()=>null);
  if(!contextUpstream.ok||!payload||payload.ok===false){
    return send(contextUpstream.status,payload||{ok:false,code:'CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE'},contextUpstream.headers);
  }
  const responseClientId=norm(payload?.data?.contract?.client_id),responseContractId=norm(payload?.data?.contract?.contract_id);
  if(responseClientId!==clientId||responseContractId!==contractId)return send(404,{ok:false,code:'CONTEXT_NOT_FOUND'});

  const dealRows=(Array.isArray(payload?.data?.deals)?payload.data.deals:[]).filter((d:any)=>norm(d?.deal_id)===dealId);
  if(dealRows.length!==1)return send(404,{ok:false,code:'CLIENT_DEAL_NOT_FOUND'});
  const deal=dealRows[0],application=exactApplication(payload,deal,dealId),meta=await canonicalDealMeta(clientId,contractId,dealId);
  if(!meta)return send(404,{ok:false,code:'CLIENT_DEAL_NOT_FOUND'});

  const railModel=await canonicalDealRail(meta,dealId);
  const state=projectClientCanonicalDealState({
    context:payload.data.contract,
    deal,
    application,
    meta:{
      resource_status:meta.resource_status,
      resource_source:meta.resource_source,
      resource_confirmed_at:meta.resource_confirmed_at,
      signed_documents_confirmed:meta.signed_documents_confirmed===true,
      documents_source:'CURRENT_ACTIVE_CONFIRMED_DEAL_DOCUMENTS'
    },
    railModel,
    generatedAt:new Date().toISOString()
  });
  const response=send(200,{ok:true,data:state,projection_contract:CLIENT_DEAL_STATE_CONTRACT});
  const h=new Headers(response.headers);
  h.set('x-rona-client-deal-state',CLIENT_DEAL_STATE_CONTRACT);
  h.set('x-rona-client-deal-state-source','PRODUCTION_CONTEXT_FINANCE_V7_RESOURCE_RAIL_V4');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
async function verifyQa(req:Request){const auth=norm(req.headers.get('authorization'));if(!auth.startsWith('Bearer '))throw new Error('QA_OIDC_REQUIRED');const {payload}=await jwtVerify(auth.slice(7).trim(),GH_JWKS,{issuer:'https://token.actions.githubusercontent.com',audience:QA_AUDIENCE});if(payload.repository!=='rokotove26-png/ronatrade.com'||payload.event_name!=='pull_request'||!String(payload.workflow_ref||'').includes(QA_WORKFLOW))throw new Error('QA_IDENTITY_DENIED')}
async function qa(req:Request){await verifyQa(req);const body:any=await req.json().catch(()=>null),rawIds:any[]=Array.isArray(body?.dealIds)?body.dealIds:[],ids:string[]=[...new Set<string>(rawIds.map((v:any)=>norm(v)).filter((v:string)=>/^DEAL-[A-Z0-9-]{1,64}$/i.test(v)))].slice(0,10);if(!ids.length)return send(400,{ok:false,code:'QA_DEAL_IDS_REQUIRED'});const rows=await rowsFor(null,null,ids);const map=new Map(rows.map((r:any)=>[norm(r.deal_id),r]));return send(200,{ok:true,proof:'ISSUE430_POSTRELEASE_STATE_READ_ONLY',candidate_version:VERSION,production_business_data_mutation:false,paid_resources:false,rows:ids.map(id=>{const r:any=map.get(id);return r?{deal_id:id,found:true,business_status:r.deal_business_status,resource_status:upper(r.resource_status)||'RESOURCE_PENDING',resource_source:norm(r.resource_source)||'NO_AUTHORITATIVE_RESOURCE_FACT',resource_confirmed_at:r.resource_confirmed_at||null,signed_documents_confirmed:Boolean(r.signed_supplement_document_key&&r.signed_supplement_checked_at)}:{deal_id:id,found:false}})})}
Deno.serve(async(req:Request)=>{try{const u=new URL(req.url),route=routeOf(u.pathname);if(route==='/__qa/issue430/postrelease-state'&&req.method==='POST')return await qa(req);if(route==='/v1/client/rail-canonical')return await clientRailCanonical(req,u);if(route==='/v1/client/deal-state')return await clientDealState(req,u);if(!route.startsWith('/v1/client/'))return send(404,{ok:false,code:'ROUTE_NOT_FOUND'});const upstream=await proxy(req,route,u.search),ct=upstream.headers.get('content-type')||'';if(!ct.includes('application/json'))return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:upstream.headers});const payload:any=await upstream.json().catch(()=>null);if(!upstream.ok||!payload||payload.ok===false)return send(upstream.status,payload||{ok:false,code:`UPSTREAM_${upstream.status}`},upstream.headers);if(req.method==='GET'&&route==='/v1/client/context'){const clientId=norm(u.searchParams.get('clientId')),contractId=norm(u.searchParams.get('contractId'));if(!clientId||!contractId)return send(400,{ok:false,code:'CLIENT_CONTRACT_CONTEXT_REQUIRED'});await enrich(payload,clientId,contractId)}return send(upstream.status,payload,upstream.headers)}catch(error){const code=String((error as any)?.message||'SERVER_ERROR');console.error('issue430 postrelease candidate',code);if(code.startsWith('QA_')||code.includes('JWT')||code.includes('signature'))return send(403,{ok:false,code:'QA_AUTH_FORBIDDEN'});return send(code==='CONTEXT_SCOPE_MISMATCH'?409:500,{ok:false,code:code==='CONTEXT_SCOPE_MISMATCH'?code:'SERVER_ERROR'})}});
