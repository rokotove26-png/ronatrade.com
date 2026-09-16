// Application-only adapter over the verified deployed Stage 2.4 source lineage.
// Non-application routes, including Payments/Finance, delegate without modification.
import {sql,authenticate,apiRoute,send,uuid} from 'https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/77588541119bb1a96375beed3e853e067ab1422f/supabase/functions/rona-portal-api/shared.ts';
import {applyCanonicalApplications,APPLICATION_BUSINESS_CONTRACT} from '../../../functions/portal/application-business-contract-v2.js';
export const APPLICATION_PREDECESSOR_SOURCE='c4e93c8445a84aa987588558823533be2d1f4511';
const originalServe:any=Deno.serve.bind(Deno);
const canonicalNumber=/^.+-IN-[0-9]{4}-[0-9]{3,}$/;
function replacement(response:Response,body:unknown,status=response.status){
 const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
 headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store');
 headers.set('x-rona-application-business',APPLICATION_BUSINESS_CONTRACT);
 return new Response(JSON.stringify(body,(_k,v)=>typeof v==='bigint'?v.toString():v),{status,headers});
}
function fail(response:Response,code:string,sourceId?:string){
 return replacement(response,{ok:false,code,business_contract:APPLICATION_BUSINESS_CONTRACT,
  ...(sourceId?{source_id:sourceId,recovery_state:'AUTOMATIC_RECONCILIATION_PENDING'}:{})},503);
}
function idHeader(request:Request,name:string){const value=request.headers.get(name);return value&&uuid.test(value)?value:crypto.randomUUID()}
async function atomicSubmit(request:Request,body:any){
 const origin=request.headers.get('origin');
 if(origin&&!new Set(['https://ronaoil.com','https://www.ronaoil.com']).has(origin))return send(null,403,{ok:false,code:'ORIGIN_DENIED'});
 const ctx=await authenticate(request);
 if(!ctx?.roles.includes('CLIENT'))return send(origin,403,{ok:false,code:'CLIENT_ACCESS_DENIED'});
 const key=request.headers.get('x-idempotency-key');
 if(!key||key!==body?.idempotencyKey)return send(origin,400,{ok:false,code:'APPLICATION_INTENT_KEY_MISMATCH'});
 try{
  const rows=await sql`select portal_private.submit_client_application_bundle_v2(${ctx.auth}::uuid,${ctx.sid}::uuid,
    ${sql.json(body)}::jsonb,${idHeader(request,'x-request-id')}::uuid,${idHeader(request,'x-correlation-id')}::uuid) as receipt`;
  const receipt=rows[0]?.receipt;
  if(rows.length!==1||!canonicalNumber.test(receipt?.application_id||'')||receipt?.bundle_complete!==true)
   return send(origin,503,{ok:false,code:'APPLICATION_DURABLE_CONTRACT_MISSING'});
  return send(origin,200,{ok:true,application:receipt,...receipt});
 }catch(error){
  const message=error instanceof Error?error.message:'';
  const code=message.includes('IDEMPOTENCY_PAYLOAD_CONFLICT')?'APPLICATION_IDEMPOTENCY_PAYLOAD_CONFLICT':
   message.includes('RETIRED_NO_RESUBMISSION')?'APPLICATION_RETIRED_NO_RESUBMISSION':
   message.includes('CONTEXT_DENIED')?'CLIENT_PRICE_CONTEXT_DENIED':
   message.includes('DETAILS_SOURCE_CONFLICT')?'APPLICATION_DETAILS_SOURCE_CONFLICT':'APPLICATION_SUBMIT_NOT_COMMITTED';
  const status=code==='CLIENT_PRICE_CONTEXT_DENIED'?403:code.includes('CONFLICT')?409:code.includes('RETIRED')?410:503;
  return send(origin,status,{ok:false,code,business_contract:APPLICATION_BUSINESS_CONTRACT});
 }
}
async function decorate(request:Request,response:Response){
 const route=apiRoute(new URL(request.url));
 const read=request.method==='GET'&&(route==='/v1/client/context'||route==='/v1/admin/bootstrap');
 const submit=request.method==='POST'&&(route==='/v1/client/applications'||route==='/v1/events');
 if((!read&&!submit)||!response.ok)return response;
 let payload:any;try{payload=await response.clone().json()}catch{return fail(response,'APPLICATION_RESPONSE_INVALID')}
 if(read){
  if(!payload?.data||!Array.isArray(payload.data.applications))return fail(response,'APPLICATION_READ_CONTRACT_MISSING');
  const client=route==='/v1/client/context',url=new URL(request.url);
  const clientId=client?url.searchParams.get('clientId'):null,contractId=client?url.searchParams.get('contractId'):null;
  if(client&&(!clientId||!contractId))return fail(response,'APPLICATION_CLIENT_SCOPE_MISSING');
  try{
   const rows=await sql`select portal_private.application_business_projection_v2(${client?'CLIENT':'ADMIN'},${clientId},${contractId}) as projection`;
   if(rows.length!==1)return fail(response,'APPLICATION_PROJECTION_MISSING');
   payload.data=applyCanonicalApplications(payload.data,rows[0].projection,client?{clientId,contractId}:null);
   return replacement(response,payload);
  }catch{return fail(response,'APPLICATION_CANONICAL_PROJECTION_UNAVAILABLE')}
 }
 const sourceId=String(route==='/v1/events'?payload?.event?.event_id||'':payload?.application?.application_id||'');
 if(!sourceId)return fail(response,'APPLICATION_SOURCE_RECEIPT_MISSING');
 try{
  const rows=await sql`select i.intake_id::text,i.durable_id::text,i.source_record_id,i.actionable_type,i.routing_state,
    r.application_id,r.retired_at,i.source_submitted_at,
    exists(select 1 from portal_private.client_intake_task_links_v1 l where l.intake_id=i.intake_id) as task_linked
   from portal_private.client_intake_v1 i left join portal_private.client_application_registry_v2 r
    on r.application_key=i.application_key
   where i.source_kind=${route==='/v1/events'?'PORTAL_REVERSE_EVENT':'CLIENT_APPLICATION'} and i.source_record_id=${sourceId}`;
  // Non-Client reverse events were authorized by their existing handler; leave them unchanged.
  if(!rows.length&&route==='/v1/events')return response;
  if(rows.length!==1)return fail(response,'APPLICATION_DURABILITY_MISSING',sourceId);
  const row=rows[0];
  if(route==='/v1/events'&&row.actionable_type!=='DELIVERED_PRICE_CALCULATION_REQUEST_V1')return response;
  if(!canonicalNumber.test(String(row.application_id||''))||row.retired_at||!row.task_linked)
   return fail(response,'APPLICATION_CANONICAL_REGISTRATION_PENDING',sourceId);
  const receipt={application_id:row.application_id,intake_id:row.intake_id,durable_id:row.durable_id,
   source_id:row.source_record_id,submitted_at:row.source_submitted_at,routing_state:row.routing_state,
   business_contract:APPLICATION_BUSINESS_CONTRACT};
  if(route==='/v1/events')payload.event={...payload.event,...receipt};else payload.application={...payload.application,...receipt};
  Object.assign(payload,receipt);return replacement(response,payload);
 }catch{return fail(response,'APPLICATION_CANONICAL_REGISTRATION_PENDING',sourceId)}
}
(Deno as any).serve=function applicationBusinessServe(first:any,second?:any){
 const handler=typeof first==='function'?first:second,options=typeof first==='function'?undefined:first;
 if(typeof handler!=='function')return originalServe(first,second);
 const wrapped=async(request:Request,info:any)=>{
  if(request.method==='POST'&&apiRoute(new URL(request.url))==='/v1/client/applications'){
   const body=await request.clone().json().catch(()=>null);
   if(body&&Object.prototype.hasOwnProperty.call(body,'applicationDetails'))return atomicSubmit(request,body);
  }
  return decorate(request,await handler(request,info));
 };
 return options===undefined?originalServe(wrapped):originalServe(options,wrapped);
};
await import('https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/c4e93c8445a84aa987588558823533be2d1f4511/supabase/functions/rona-portal-api/stage24-bootstrap.ts');
