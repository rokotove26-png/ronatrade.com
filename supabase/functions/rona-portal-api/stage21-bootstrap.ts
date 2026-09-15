// PR #528 Stage 2.1 candidate entrypoint for the EXISTING rona-portal-api function slug.
// DO NOT deploy from this PR. It wraps the exact active production source lineage instead of main.
// Active production source pin verified before this change:
// 77588541119bb1a96375beed3e853e067ab1422f

import postgres from "postgres";

export const PRODUCTION_PORTAL_API_SOURCE_PIN="77588541119bb1a96375beed3e853e067ab1422f";
export const CLIENT_INTAKE_STAGE21_CONTRACT="RONA_CLIENT_INTAKE_STAGE21_PROJECTION_V1";

const DB=Deno.env.get("SUPABASE_DB_URL");
const intakeSql=DB?postgres(DB,{prepare:false,max:1,idle_timeout:1,connect_timeout:3,max_lifetime:15}):null;
const originalServe=Deno.serve.bind(Deno);

function routeOf(req:Request){
  const url=new URL(req.url);
  const marker='/rona-portal-api';
  const at=url.pathname.indexOf(marker);
  return at>=0?(url.pathname.slice(at+marker.length)||'/'):url.pathname;
}

async function jsonPayload(response:Response){
  if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return null;
  try{return await response.clone().json()}catch{return null}
}

function replaceJson(response:Response,payload:any){
  const headers=new Headers(response.headers);headers.delete('content-length');
  headers.set('x-rona-client-intake-stage21',CLIENT_INTAKE_STAGE21_CONTRACT);
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

async function submitContract(sourceKind:string,sourceId:string){
  if(!intakeSql)return null;
  const rows=await intakeSql`
    select intake_id::text,durable_id::text,source_id,submitted_at,status
    from portal_private.client_intake_submit_contract_v1(${sourceKind},${sourceId})
  `;
  return rows.length===1?rows[0]:null;
}

async function lkIntakes(audience:'CLIENT'|'ADMIN',clientId:string|null,contractId:string|null){
  if(!intakeSql)return[];
  return await intakeSql`
    select intake_id::text,durable_id::text,source_kind,source_id,actionable_type,status,routing_reason,
           responsible_role,submitted_at,effective_payload,client_id,contract_id,deal_id
    from portal_private.client_intake_projection_for_lk_v1(${audience},${clientId},${contractId})
  `;
}

function effectiveQuantity(row:any){
  const value=row?.effective_payload?.quantity_tonnes;
  const n=Number(value);return Number.isFinite(n)?n:null;
}

function intakeFields(row:any){
  return {
    intake_id:String(row.intake_id),
    durable_id:String(row.durable_id),
    source_id:String(row.source_id),
    actionable_type:String(row.actionable_type),
    intake_status:String(row.status),
    intake_submitted_at:row.submitted_at,
    intake_routing_reason:row.routing_reason??null,
    intake_responsible_role:row.responsible_role??null,
    intake_contract:'RONA_CLIENT_INTAKE_V1'
  };
}

function mergeIntoApplications(existing:any[],intakes:any[]){
  const rows=Array.isArray(existing)?existing.map((x:any)=>({...x})):[];
  const byApplication=new Map(rows.map((x:any)=>[String(x.application_id||''),x]));
  for(const intake of intakes){
    if(intake.source_kind==='CLIENT_APPLICATION'){
      const target=byApplication.get(String(intake.source_id));
      if(target){
        Object.assign(target,intakeFields(intake));
        const q=effectiveQuantity(intake);if(q!==null)target.quantity_tonnes=q;
        target.effective_payload=intake.effective_payload;
      }
      continue;
    }
    if(intake.source_kind!=='PORTAL_REVERSE_EVENT')continue;
    const q=effectiveQuantity(intake),p=intake.effective_payload||{};
    rows.push({
      application_id:String(intake.source_id),
      request_id:String(intake.source_id),
      record_kind:'CLIENT_REQUEST',
      product:p.product??null,
      quantity_tonnes:q,
      destination:p?.destination?.station??p.destination??null,
      price_mode:p?.commercial?.price_mode??null,
      status:String(intake.status),
      submitted_at:intake.submitted_at,
      updated_at:intake.submitted_at,
      effective_payload:p,
      ...intakeFields(intake)
    });
  }
  return rows;
}

async function enrich(req:Request,response:Response){
  if(!intakeSql||!response.ok)return response;
  const route=routeOf(req),payload:any=await jsonPayload(response);if(!payload)return response;

  if(req.method==='POST'&&route==='/v1/client/applications'){
    const sourceId=String(payload?.application?.application_id||'');if(!sourceId)return response;
    const row=await submitContract('CLIENT_APPLICATION',sourceId);
    if(!row)return replaceJson(new Response(null,{status:500,headers:response.headers}),{ok:false,code:'CLIENT_INTAKE_DURABILITY_MISSING'});
    const contract={intake_id:String(row.intake_id),durable_id:String(row.durable_id),source_id:String(row.source_id),submitted_at:row.submitted_at,status:String(row.status)};
    payload.application={...payload.application,...contract};Object.assign(payload,contract);
    return replaceJson(response,payload);
  }

  if(req.method==='POST'&&route==='/v1/events'){
    const sourceId=String(payload?.event?.event_id||'');
    const actionable=sourceId&&String(payload?.event?.processing_state||'').toUpperCase()!=='REJECTED';
    if(!actionable)return response;
    const row=await submitContract('PORTAL_REVERSE_EVENT',sourceId);
    if(!row)return replaceJson(new Response(null,{status:500,headers:response.headers}),{ok:false,code:'CLIENT_INTAKE_DURABILITY_MISSING'});
    const contract={intake_id:String(row.intake_id),durable_id:String(row.durable_id),source_id:String(row.source_id),submitted_at:row.submitted_at,status:String(row.status)};
    payload.event={...payload.event,...contract};Object.assign(payload,contract);
    return replaceJson(response,payload);
  }

  if(req.method==='GET'&&route==='/v1/client/context'){
    const url=new URL(req.url),clientId=String(url.searchParams.get('clientId')||''),contractId=String(url.searchParams.get('contractId')||'');
    if(payload?.data&&clientId&&contractId){
      const intakes=await lkIntakes('CLIENT',clientId,contractId);
      payload.data.applications=mergeIntoApplications(payload.data.applications,intakes);
      payload.data.client_intake_projection_contract=CLIENT_INTAKE_STAGE21_CONTRACT;
      return replaceJson(response,payload);
    }
  }

  if(req.method==='GET'&&route==='/v1/admin/bootstrap'&&payload?.data){
    const intakes=await lkIntakes('ADMIN',null,null);
    payload.data.applications=mergeIntoApplications(payload.data.applications,intakes);
    payload.data.client_intake_projection_contract=CLIENT_INTAKE_STAGE21_CONTRACT;
    return replaceJson(response,payload);
  }

  return response;
}

// Outer wrapper is installed first. The pinned production bootstrap installs its own Deno.serve
// wrapper and ultimately registers through this one, so Stage 2.1 decorates the real handlers.
(Deno as any).serve=function stage21Serve(first:any,second?:any){
  const handler=typeof first==='function'?first:second;
  const options=typeof first==='function'?undefined:first;
  if(typeof handler!=='function')return originalServe(first,second);
  const wrapped=(req:Request,info:any)=>Promise.resolve(handler(req,info)).then((r:Response)=>enrich(req,r));
  return options===undefined?originalServe(wrapped):originalServe(options,wrapped);
};

await import("https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/77588541119bb1a96375beed3e853e067ab1422f/supabase/functions/rona-portal-api/bootstrap.ts");
