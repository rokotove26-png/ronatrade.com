// Stage 2 production compatibility wrapper for the existing rona-portal-api function slug.
// Preserves the durable Client Intake projection while delegating to the local reconciled bootstrap.

import postgres from "postgres";

export const PRODUCTION_PORTAL_API_SOURCE_PIN="STAGE2_LOCAL_RECONCILED_BOOTSTRAP";
export const CLIENT_INTAKE_STAGE21_CONTRACT="RONA_CLIENT_INTAKE_STAGE21_PROJECTION_V1";

const DB=Deno.env.get("SUPABASE_DB_URL");
const intakeSql=DB?postgres(DB,{prepare:false,max:1,idle_timeout:1,connect_timeout:3,max_lifetime:15}):null;
const originalServe=Deno.serve.bind(Deno);

function routeOf(req:Request){
  const url=new URL(req.url),marker='/rona-portal-api',at=url.pathname.indexOf(marker);
  return at>=0?(url.pathname.slice(at+marker.length)||'/'):url.pathname;
}
async function jsonPayload(response:Response){
  if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return null;
  try{return await response.clone().json()}catch{return null}
}
function replaceJson(response:Response,payload:any){
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('content-type','application/json; charset=utf-8');
  headers.set('x-rona-client-intake-stage21',CLIENT_INTAKE_STAGE21_CONTRACT);
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
async function submitContract(sourceKind:string,sourceId:string){
  if(!intakeSql)return null;
  const rows=await intakeSql`select intake_id::text,durable_id::text,source_id,submitted_at,status from portal_private.client_intake_submit_contract_v1(${sourceKind},${sourceId})`;
  return rows.length===1?rows[0]:null;
}
async function reverseEventActorRole(sourceId:string){
  if(!intakeSql)return null;
  const rows=await intakeSql`select actor_role::text as actor_role from portal_private.portal_reverse_events where event_id=${sourceId} limit 1`;
  return rows.length===1?String(rows[0].actor_role):null;
}
async function lkIntakes(audience:'CLIENT'|'ADMIN',clientId:string|null,contractId:string|null){
  if(!intakeSql)return[];
  return await intakeSql`
    select intake_id::text,durable_id::text,source_kind,source_id,actionable_type,status,routing_reason,
           responsible_role,submitted_at,effective_payload,client_id,contract_id,deal_id
    from portal_private.client_intake_projection_for_lk_v1(${audience},${clientId},${contractId})
  `;
}
async function lkLogicalApplications(audience:'CLIENT'|'ADMIN',clientId:string|null,contractId:string|null){
  if(!intakeSql)return[];
  return await intakeSql`
    select application_key::text,application_id,product,quantity_tonnes,destination,price_mode,
           application_status,submitted_at,updated_at,linked_intakes
    from portal_private.client_intake_application_projection_for_lk_v1(${audience},${clientId},${contractId})
  `;
}
function effectiveQuantity(row:any){
  const value=row?.effective_payload?.quantity_tonnes;
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
}
function intakeFields(row:any){
  return {intake_id:String(row.intake_id),durable_id:String(row.durable_id),source_id:String(row.source_id),actionable_type:String(row.actionable_type),intake_status:String(row.status),intake_submitted_at:row.submitted_at,intake_routing_reason:row.routing_reason??null,intake_responsible_role:row.responsible_role??null,intake_contract:'RONA_CLIENT_INTAKE_V1'};
}
function applicationDetailType(value:any){return String(value||'').toUpperCase().startsWith('APPLICATION_DETAILS_')}
function mergeIntoApplications(existing:any[],intakes:any[],logicalApplications:any[]){
  const rows=Array.isArray(existing)?existing.map((x:any)=>({...x})):[];
  const byApplication=new Map(rows.map((x:any)=>[String(x.application_id||''),x]));

  // Authoritative application-key projection is one row per existing client_applications.id.
  // Detail reverse-events remain durable linked intake identities; they never become a second app row.
  for(const logical of Array.isArray(logicalApplications)?logicalApplications:[]){
    const applicationId=String(logical?.application_id||'');if(!applicationId)continue;
    let target=byApplication.get(applicationId);
    if(!target){
      target={application_id:applicationId,record_kind:'CLIENT_APPLICATION',product:logical.product??null,quantity_tonnes:logical.quantity_tonnes==null?null:Number(logical.quantity_tonnes),destination:logical.destination??null,price_mode:logical.price_mode??null,status:logical.application_status??null,submitted_at:logical.submitted_at??null,updated_at:logical.updated_at??logical.submitted_at??null};
      rows.push(target);byApplication.set(applicationId,target);
    }
    const linked=Array.isArray(logical.linked_intakes)?logical.linked_intakes:[];
    target.client_intakes=linked;
    target.application_details_intakes=linked.filter((x:any)=>applicationDetailType(x?.actionable_type));
    const primary=linked.find((x:any)=>x?.source_kind==='CLIENT_APPLICATION')||linked[0];
    if(primary)Object.assign(target,intakeFields(primary));
  }

  for(const intake of intakes){
    if(intake.source_kind==='CLIENT_APPLICATION'){
      const target=byApplication.get(String(intake.source_id));
      if(target){Object.assign(target,intakeFields(intake));const q=effectiveQuantity(intake);if(q!==null)target.quantity_tonnes=q;target.effective_payload=intake.effective_payload}
      continue;
    }
    if(intake.source_kind!=='PORTAL_REVERSE_EVENT')continue;
    const q=effectiveQuantity(intake),p=intake.effective_payload||{};
    if(applicationDetailType(intake.actionable_type)){
      const linkedApplicationId=String(p.application_id||'');
      const target=linkedApplicationId?byApplication.get(linkedApplicationId):null;
      if(target){
        const linked=Array.isArray(target.application_details_intakes)?target.application_details_intakes:[];
        if(!linked.some((x:any)=>String(x?.intake_id||'')===String(intake.intake_id)))linked.push({...intakeFields(intake),source_kind:intake.source_kind});
        target.application_details_intakes=linked;
        continue;
      }
      // A malformed/unresolved application-details event stays visible as a failed request record;
      // it is never projected as an authoritative application.
    }
    rows.push({application_id:String(intake.source_id),request_id:String(intake.source_id),record_kind:'CLIENT_REQUEST',linked_application_id:applicationDetailType(intake.actionable_type)?String(p.application_id||'')||null:null,product:p.product??null,quantity_tonnes:q,destination:p?.destination?.station??p.destination??null,price_mode:p?.commercial?.price_mode??null,status:String(intake.status),submitted_at:intake.submitted_at,updated_at:intake.submitted_at,effective_payload:p,...intakeFields(intake)});
  }
  return rows;
}
async function durabilityMissing(response:Response){
  return replaceJson(new Response(null,{status:500,statusText:'Internal Server Error',headers:response.headers}),{ok:false,code:'CLIENT_INTAKE_DURABILITY_MISSING'});
}

async function enrich(req:Request,response:Response){
  if(!intakeSql||!response.ok)return response;
  const route=routeOf(req),payload:any=await jsonPayload(response);if(!payload)return response;

  if(req.method==='POST'&&route==='/v1/client/applications'){
    const sourceId=String(payload?.application?.application_id||'');if(!sourceId)return response;
    const row=await submitContract('CLIENT_APPLICATION',sourceId);if(!row)return durabilityMissing(response);
    const contract={intake_id:String(row.intake_id),durable_id:String(row.durable_id),source_id:String(row.source_id),submitted_at:row.submitted_at,status:String(row.status)};
    payload.application={...payload.application,...contract};Object.assign(payload,contract);return replaceJson(response,payload);
  }

  if(req.method==='POST'&&route==='/v1/events'){
    const sourceId=String(payload?.event?.event_id||'');if(!sourceId)return response;
    if(await reverseEventActorRole(sourceId)!=='CLIENT')return response;
    const row=await submitContract('PORTAL_REVERSE_EVENT',sourceId);if(!row)return durabilityMissing(response);
    const contract={intake_id:String(row.intake_id),durable_id:String(row.durable_id),source_id:String(row.source_id),submitted_at:row.submitted_at,status:String(row.status)};
    payload.event={...payload.event,...contract};Object.assign(payload,contract);return replaceJson(response,payload);
  }

  if(req.method==='GET'&&route==='/v1/client/context'){
    const url=new URL(req.url),clientId=String(url.searchParams.get('clientId')||''),contractId=String(url.searchParams.get('contractId')||'');
    if(payload?.data&&clientId&&contractId){
      const [intakes,logicalApplications]=await Promise.all([lkIntakes('CLIENT',clientId,contractId),lkLogicalApplications('CLIENT',clientId,contractId)]);
      payload.data.applications=mergeIntoApplications(payload.data.applications,intakes,logicalApplications);
      payload.data.client_intake_projection_contract=CLIENT_INTAKE_STAGE21_CONTRACT;
      return replaceJson(response,payload);
    }
  }
  if(req.method==='GET'&&route==='/v1/admin/bootstrap'&&payload?.data){
    const [intakes,logicalApplications]=await Promise.all([lkIntakes('ADMIN',null,null),lkLogicalApplications('ADMIN',null,null)]);
    payload.data.applications=mergeIntoApplications(payload.data.applications,intakes,logicalApplications);
    payload.data.client_intake_projection_contract=CLIENT_INTAKE_STAGE21_CONTRACT;
    return replaceJson(response,payload);
  }
  return response;
}

// Outer wrapper is installed first. The pinned production bootstrap installs its own Deno.serve
// wrapper and ultimately registers through this one, so Stage 2.2 decorates the real handlers.
(Deno as any).serve=function stage21Serve(first:any,second?:any){
  const handler=typeof first==='function'?first:second,options=typeof first==='function'?undefined:first;
  if(typeof handler!=='function')return originalServe(first,second);
  const wrapped=(req:Request,info:any)=>Promise.resolve(handler(req,info)).then((r:Response)=>enrich(req,r));
  return options===undefined?originalServe(wrapped):originalServe(options,wrapped);
};

await import("./bootstrap.ts");