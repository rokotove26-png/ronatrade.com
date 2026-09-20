import {applyCanonicalApplications,APPLICATION_BUSINESS_CONTRACT} from '../../../../functions/portal/application-business-contract-v2.js';
const businessId=/^.+-IN-[0-9]{4}-[0-9]{3,}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origins=new Set(['https://ronaoil.com','https://www.ronaoil.com']);
const requestId=(request,name)=>uuid.test(request.headers.get(name)||'')?request.headers.get(name):crypto.randomUUID();
function response(body,status=200,base){
 const headers=new Headers(base?.headers);headers.delete('content-length');headers.delete('etag');
 headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store');
 headers.set('x-rona-application-business',APPLICATION_BUSINESS_CONTRACT);
 return new Response(JSON.stringify(body),{status,headers});
}
function failure(error,base){
 const message=String(error?.message||error||'');
 const code=message.includes('POLICY_NOT_ACTIVE')?'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE':
 message.includes('AUTHORITY_UNAVAILABLE')?'APPLICATION_OPERATIONS_AUTHORITY_UNAVAILABLE':
 message.includes('SESSION_DENIED')?'APPLICATION_SESSION_DENIED':
 message.includes('SCOPE_DENIED')||message.includes('CONTEXT_DENIED')?'APPLICATION_SCOPE_DENIED':
 message.includes('RETIRED_NO_RESUBMISSION')?'APPLICATION_RETIRED_NO_RESUBMISSION':
 message.includes('CONFLICT')?'APPLICATION_SOURCE_OR_IDEMPOTENCY_CONFLICT':'APPLICATION_TRANSACTION_NOT_COMMITTED';
 return response({ok:false,code,business_contract:APPLICATION_BUSINESS_CONTRACT},
  code.includes('SESSION')?401:code.includes('SCOPE')?403:code.includes('RETIRED')?410:code.includes('CONFLICT')?409:503,base);
}
async function applicationProjection(sql,ctx,client,clientId,contractId){
 const impersonation=ctx?.impersonation;
 const adminEntityClient=Boolean(
  client&&impersonation?.effectiveRole==='CLIENT'&&
  impersonation?.subjectMode==='ADMIN_ENTITY'&&impersonation?.readOnly===true
 );
 const portalUserClient=Boolean(
  client&&impersonation?.effectiveRole==='CLIENT'&&
  impersonation?.subjectMode==='PORTAL_USER'
 );
 if(!adminEntityClient&&!portalUserClient){
  return sql`select portal_private.application_business_authorized_v2(${ctx.auth}::uuid,${ctx.sid}::uuid,${client?'CLIENT':'ADMIN'},${clientId},${contractId}) as projection`;
 }
 const targetClientKey=String(impersonation?.targetClientKey||'').trim();
 if(!uuid.test(targetClientKey))throw new Error('APPLICATION_SCOPE_DENIED');
 if(adminEntityClient){
  const scope=await sql`
   select 1
     from portal_private.clients cl
     join portal_private.contracts ct on ct.client_key=cl.id
    where cl.id=${targetClientKey}::uuid
      and cl.client_id=${clientId}
      and ct.contract_id=${contractId}
      and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and cl.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and ct.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
      and ct.authority_state<>'REJECTED'::portal_private.authority_state_enum
    limit 1
  `;
  if(scope.length!==1)throw new Error('APPLICATION_SCOPE_DENIED');
  return sql`select portal_private.application_business_projection_v2('CLIENT',${clientId},${contractId}) as projection`;
 }
 const effectiveUserId=String(impersonation?.effectiveUserId||ctx?.user||'').trim();
 if(!uuid.test(effectiveUserId))throw new Error('APPLICATION_SCOPE_DENIED');
 const scope=await sql`
  select ct.id::text as contract_key
    from portal_private.client_user_bindings b
    join portal_private.clients cl on cl.id=b.client_key
    join portal_private.contracts ct on ct.id=b.contract_key and ct.client_key=cl.id
   where b.user_id=${effectiveUserId}::uuid
     and b.client_key=${targetClientKey}::uuid
     and b.status='ACTIVE'::portal_private.binding_status_enum
     and b.revoked_at is null
     and cl.client_id=${clientId}
     and ct.contract_id=${contractId}
     and portal_private.client_user_has_contract_access(${effectiveUserId}::uuid,ct.id,now())
   limit 1
 `;
 if(scope.length!==1)throw new Error('APPLICATION_SCOPE_DENIED');
 const contractKey=String(scope[0].contract_key||'').trim();
 if(!uuid.test(contractKey))throw new Error('APPLICATION_SCOPE_DENIED');
 return sql`
  with base as (
    select portal_private.application_business_projection_v2('CLIENT',${clientId},${contractId}) as projection
  ), filtered as (
    select coalesce(jsonb_agg(r.v order by r.ordinal),'[]'::jsonb) as applications
      from base
      cross join lateral jsonb_array_elements(base.projection->'applications') with ordinality r(v,ordinal)
      join portal_private.client_applications a on a.application_id=r.v->>'application_id'
     where a.client_key=${targetClientKey}::uuid
       and a.contract_key=${contractKey}::uuid
       and (
         a.linked_deal_key is null
         or portal_private.client_user_has_deal_access(${effectiveUserId}::uuid,a.linked_deal_key,now())
       )
  )
  select base.projection||jsonb_build_object(
    'applications',filtered.applications,
    'application_kpi',portal_private.application_business_kpi_v2(filtered.applications)
  ) as projection
    from base cross join filtered
 `;
}

export function createApplicationBusinessHandler(delegate,{sql,authenticate,apiRoute}){
 return async function applicationBusinessHandler(request,info){
  const url=new URL(request.url),route=apiRoute(url);
  const capabilities=request.method==='GET'&&route==='/v1/client/applications/capabilities';
  const collection=request.method==='GET'&&(route==='/v1/client/context'||route==='/v1/admin/bootstrap');
  const passport=request.method==='GET'?route.match(/^\/v1\/(client|admin)\/applications\/([^/]+)\/passport$/):null;
  let body=null,kind=null;
  if(request.method==='POST'&&(route==='/v1/client/applications'||route==='/v1/events')){
   body=await request.clone().json().catch(()=>null);
   if(route==='/v1/client/applications')kind='STANDARD';
   else if(body?.payload?.message_type==='DELIVERED_PRICE_CALCULATION_REQUEST_V1'||body?.authority_domain==='PRICE_CALCULATION')kind='DELIVERED';
  }
  if(!collection&&!passport&&!kind&&!capabilities)return delegate(request,info);
  const origin=request.headers.get('origin');
  if(origin&&!origins.has(origin))return response({ok:false,code:'ORIGIN_DENIED'},403);
  let ctx;
  try{ctx=await authenticate(request)}catch{return response({ok:false,code:'APPLICATION_SESSION_DENIED'},401)}
  if(!ctx?.auth||!ctx?.sid)return response({ok:false,code:'APPLICATION_SESSION_DENIED'},401);
  const client=capabilities||kind||passport?.[1]==='client'||route==='/v1/client/context';
  if(!ctx?.roles?.includes(client?'CLIENT':'ADMIN'))return response({ok:false,code:'APPLICATION_SCOPE_DENIED'},403);
  if(capabilities){try{await sql`select portal_private.application_operations_authority_v2() as authority`;return response({ok:true,business_contract:APPLICATION_BUSINESS_CONTRACT,atomic_submit:true})}catch(error){return failure(error)}}
  if(kind){
   const key=request.headers.get('x-idempotency-key');
   if(!body||!key||key!==(kind==='STANDARD'?body.idempotencyKey:body.idempotency_key))return response({ok:false,code:'APPLICATION_INTENT_KEY_MISMATCH'},400);
   if(kind==='STANDARD'&&(!body.applicationDetails||typeof body.applicationDetails!=='object'))return response({ok:false,code:'ATOMIC_APPLICATION_DETAILS_REQUIRED'},400);
   try{
    const correlationHeader=request.headers.get('x-correlation-id');
    const correlationId=correlationHeader&&uuid.test(correlationHeader)?correlationHeader:(ctx?.impersonation?.correlationId||crypto.randomUUID());
    const ids=[requestId(request,'x-request-id'),correlationId];
    const impersonated=ctx?.impersonation?.effectiveRole==='CLIENT';
    const rows=kind==='STANDARD'?
     impersonated?
      await sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${ctx.impersonation.id}::uuid,${ctx.actorUser}::uuid,${ctx.actorAuth}::uuid,${ctx.sid}::uuid,${ctx.user}::uuid,${sql.json(body)}::jsonb,${ids[0]}::uuid,${ids[1]}::uuid) as receipt`:
      await sql`select portal_private.submit_client_application_bundle_v2(${ctx.auth}::uuid,${ctx.sid}::uuid,${sql.json(body)}::jsonb,${ids[0]}::uuid,${ids[1]}::uuid) as receipt`:
     impersonated?
      await sql`select portal_private.submit_admin_impersonated_delivered_application_bundle_v2(${ctx.impersonation.id}::uuid,${ctx.actorUser}::uuid,${ctx.actorAuth}::uuid,${ctx.sid}::uuid,${ctx.user}::uuid,${sql.json(body)}::jsonb,${ids[0]}::uuid,${ids[1]}::uuid) as receipt`:
      await sql`select portal_private.submit_delivered_application_bundle_v2(${ctx.auth}::uuid,${ctx.sid}::uuid,${sql.json(body)}::jsonb,${ids[0]}::uuid,${ids[1]}::uuid) as receipt`;
    const receipt=rows[0]?.receipt;
    if(rows.length!==1||!businessId.test(receipt?.application_id||'')||receipt?.bundle_complete!==true||!receipt.intake_id||!receipt.durable_id)throw new Error('APPLICATION_COMMIT_CONTRACT_MISSING');
    return response({ok:true,...receipt,application:receipt,...(kind==='DELIVERED'?{event:receipt}:{})});
   }catch(error){return failure(error)}
  }
  let base;
  if(collection){base=await delegate(request,info);if(!base.ok)return base;}
  const clientId=client?url.searchParams.get('clientId'):null,contractId=client?url.searchParams.get('contractId'):null;
  if(client&&(!clientId||!contractId))return response({ok:false,code:'APPLICATION_CLIENT_SCOPE_MISSING'},400,base);
  try{
   const rows=await applicationProjection(sql,ctx,client,clientId,contractId);
   if(rows.length!==1)throw new Error('APPLICATION_PROJECTION_MISSING');
   const projection=rows[0].projection;
   if(passport){
    const id=decodeURIComponent(passport[2]);if(!businessId.test(id))return response({ok:false,code:'CANONICAL_APPLICATION_ID_REQUIRED'},400);
    const data=applyCanonicalApplications({},projection,client?{clientId,contractId}:null);
    const application=data.applications.find(row=>row.application_id===id);
    return application?response({ok:true,data:{application,business_contract:APPLICATION_BUSINESS_CONTRACT}}):response({ok:false,code:'APPLICATION_NOT_FOUND'},404);
   }
   const payload=await base.clone().json();
   payload.data=applyCanonicalApplications(payload.data,projection,client?{clientId,contractId}:null);
   return response(payload,base.status,base);
  }catch(error){return failure(error,base)}
 };
}
