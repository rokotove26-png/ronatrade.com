import postgres from "postgres";
import { normalizeClientIntakeBusinessRows } from "../_shared/client-intake-v1/business-lifecycle-v1.mjs";

export const CLIENT_INTAKE_STAGE24_CONTRACT="RONA_CLIENT_INTAKE_BUSINESS_LIFECYCLE_V1";

const DB=Deno.env.get("SUPABASE_DB_URL");
const sql=DB?postgres(DB,{prepare:false,max:1,idle_timeout:1,connect_timeout:3,max_lifetime:15}):null;
const nativeServe:any=Deno.serve.bind(Deno);

function routeOf(req:Request){
  const url=new URL(req.url),marker='/rona-portal-api',at=url.pathname.indexOf(marker);
  return at>=0?(url.pathname.slice(at+marker.length)||'/'):url.pathname;
}
function replaceJson(response:Response,payload:any){
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('x-rona-client-intake-stage24',CLIENT_INTAKE_STAGE24_CONTRACT);
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
function fail(response:Response,code:string){
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-client-intake-stage24',CLIENT_INTAKE_STAGE24_CONTRACT);
  return new Response(JSON.stringify({ok:false,code,client_intake_contract:CLIENT_INTAKE_STAGE24_CONTRACT}),{status:503,headers});
}
async function jsonPayload(response:Response){
  if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return null;
  try{return await response.clone().json()}catch{return null}
}
async function authoritativeStates(rows:any[]){
  if(!sql)throw new Error('CLIENT_INTAKE_BUSINESS_DB_UNAVAILABLE');
  const applicationIds=[...new Set(rows.flatMap((row:any)=>{
    const payload=row?.effective_payload&&typeof row.effective_payload==='object'?row.effective_payload:{};
    const ids=[];
    if(String(row?.record_kind||'').toUpperCase()==='CLIENT_APPLICATION'&&row?.application_id)ids.push(String(row.application_id));
    if(payload?.application_id)ids.push(String(payload.application_id));
    if(row?.linked_application_id)ids.push(String(row.linked_application_id));
    return ids;
  }).filter(Boolean))];
  const intakeIds=[...new Set(rows.map((row:any)=>String(row?.intake_id||'').trim()).filter(Boolean))];

  const applicationStates=applicationIds.length?await sql`
    select a.application_id,
           a.status::text as status,
           a.lifecycle_state::text as lifecycle_state,
           d.deal_id,
           w.business_status
      from portal_private.client_applications a
      left join portal_private.deals d on d.id=a.linked_deal_key
      left join portal_private.owner_application_workflow w on w.application_key=a.id
     where a.application_id = any(${applicationIds}::text[])
  `:[];

  const taskStates=intakeIds.length?await sql`
    select i.intake_id::text as intake_id,
           t.task_status,
           t.task_decision,
           t.task_decision_at
      from portal_private.client_intake_v1 i
      left join lateral (
        select st.status::text as task_status,
               st.decision as task_decision,
               st.decision_at as task_decision_at
          from portal_private.client_intake_task_links_v1 l
          join portal_private.staff_tasks st on st.id=l.staff_task_id
         where l.intake_id=i.intake_id
         order by l.linked_at desc
         limit 1
      ) t on true
     where i.intake_id::text = any(${intakeIds}::text[])
  `:[];
  return {applicationStates,taskStates};
}
async function normalize(req:Request,response:Response){
  const route=routeOf(req);
  const critical=req.method==='GET'&&(route==='/v1/admin/bootstrap'||route==='/v1/client/context');
  if(!critical||!response.ok)return response;
  if(!sql)return fail(response,'CLIENT_INTAKE_BUSINESS_STATE_UNAVAILABLE');
  const payload:any=await jsonPayload(response);
  if(!payload?.data||!Array.isArray(payload.data.applications))return response;
  try{
    const states=await authoritativeStates(payload.data.applications);
    payload.data.applications=normalizeClientIntakeBusinessRows(payload.data.applications,states.applicationStates,states.taskStates);
    payload.data.client_intake_business_lifecycle_contract=CLIENT_INTAKE_STAGE24_CONTRACT;
    return replaceJson(response,payload);
  }catch(error){
    console.error('CLIENT_INTAKE_STAGE24_FAIL',error);
    return fail(response,'CLIENT_INTAKE_BUSINESS_STATE_UNAVAILABLE');
  }
}

(Deno as any).serve=function stage24Serve(first:any,second?:any){
  const handler=typeof first==='function'?first:second,options=typeof first==='function'?undefined:first;
  if(typeof handler!=='function')return nativeServe(first,second);
  const wrapped=(req:Request,info:any)=>Promise.resolve(handler(req,info)).then((response:Response)=>normalize(req,response));
  return options===undefined?nativeServe(wrapped):nativeServe(options,wrapped);
};

await import("./stage23-bootstrap.ts");
