import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { resolveAdminImpersonation, impersonationMetadata, type AdminImpersonation } from "../_shared/admin-impersonation-authority-v1.ts";
export const DB=Deno.env.get("SUPABASE_DB_URL");export const SUPA_URL=Deno.env.get("SUPABASE_URL");if(!DB||!SUPA_URL)throw new Error("runtime vars missing");export const sql=postgres(DB,{prepare:false,max:1,idle_timeout:1,connect_timeout:3,max_lifetime:15});export const origins=new Set(["https://ronaoil.com","https://www.ronaoil.com"]);export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;export type Ctx={auth:string;user:string;name:string;roles:string[];sid:string;exp:string|null;actorAuth:string;actorUser:string;actorName:string;actorRoles:string[];impersonation:AdminImpersonation|null};
export function isAdminEntityClient(c:Ctx){return c.impersonation?.effectiveRole==="CLIENT"&&c.impersonation.subjectMode==="ADMIN_ENTITY"&&Boolean(c.impersonation.targetClientKey)}
export function runtimeKey(kind:"pub"|"secret"){const legacy=kind==="pub"?Deno.env.get("SUPABASE_ANON_KEY"):Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;const raw=Deno.env.get(kind==="pub"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS");if(raw){const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}throw new Error("key missing")}
export function headers(origin:string|null){const out:Record<string,string>={"content-type":"application/json; charset=utf-8","cache-control":"no-store","vary":"Origin","access-control-allow-headers":"authorization, content-type, x-request-id, x-correlation-id, x-idempotency-key","access-control-allow-methods":"GET, POST, OPTIONS"};if(origin&&origins.has(origin))out["access-control-allow-origin"]=origin;return out}export function send(origin:string|null,status:number,body:unknown){return new Response(JSON.stringify(body,(_k,value)=>typeof value==="bigint"?value.toString():value),{status,headers:headers(origin)})}export function apiRoute(url:URL){const marker="/rona-portal-api",i=url.pathname.indexOf(marker);return i>=0?(url.pathname.slice(i+marker.length)||"/"):url.pathname}function claims(token:string){try{const p=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(p+"=".repeat((4-p.length%4)%4)))}catch{return{}}}
export async function authenticate(req:Request):Promise<Ctx|null>{
  const authorization=req.headers.get("authorization");
  if(!authorization?.startsWith("Bearer "))return null;
  const token=authorization.slice(7);
  const client=createClient(SUPA_URL!,runtimeKey("pub"),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const{data,error}=await client.auth.getUser(token);
  if(error||!data.user)return null;
  const sid=claims(token).session_id;
  if(typeof sid!=="string"||!uuid.test(sid))return null;
  const rows=await sql`select a.portal_user_id,a.display_name,a.roles,s.not_after from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid where a.session_allowed and (s.not_after is null or s.not_after>now())`;
  if(rows.length!==1)return null;
  const actorRoles=(rows[0].roles||[]).map(String);
  const actorUser=String(rows[0].portal_user_id),actorName=String(rows[0].display_name||"");
  const base:Ctx={auth:data.user.id,user:actorUser,name:actorName,roles:actorRoles,sid,exp:rows[0].not_after?new Date(rows[0].not_after).toISOString():null,actorAuth:data.user.id,actorUser,actorName,actorRoles,impersonation:null};
  const impToken=String(req.headers.get("x-rona-admin-impersonation-token")||"").trim();
  if(!impToken)return base;
  if(!actorRoles.includes("ADMIN"))return null;
  const impersonation=await resolveAdminImpersonation(sql,{authUserId:data.user.id,portalUserId:actorUser,sessionId:sid,displayName:actorName,roles:actorRoles},impToken);
  if(!impersonation)return null;
  const tabId=String(req.headers.get("x-rona-impersonation-tab")||"").trim();
  if(tabId!==impersonation.id)return null;
  const effective=impersonation.subjectMode==="ADMIN_ENTITY"&&impersonation.targetClientKey
    ?await sql`select legal_name as display_name from portal_private.clients where id=${impersonation.targetClientKey}::uuid limit 1`
    :await sql`select display_name from portal_private.portal_users where id=${impersonation.effectiveUserId}::uuid limit 1`;
  return{...base,user:impersonation.effectiveUserId,name:String(effective[0]?.display_name||""),roles:[impersonation.effectiveRole],impersonation};
}
export async function sessionScope(c:Ctx){
  const clients=new Set<string>(),contracts=new Set<string>(),deals=new Set<string>(),persons=new Set<string>(),legalEntities=new Set<string>();
  if(c.roles.includes("ADMIN")||c.roles.includes("RONA_OPERATOR")){
    for(const r of await sql`select cl.client_id,ct.contract_id,d.deal_id from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id left join portal_private.deals d on d.client_key=cl.id and d.contract_key=ct.id`){clients.add(String(r.client_id));contracts.add(String(r.contract_id));if(r.deal_id)deals.add(String(r.deal_id))}
  }
  if(c.roles.includes("CLIENT")){
    const bound=c.impersonation?.effectiveRole==="CLIENT"?c.impersonation.targetClientKey:null;
    if(isAdminEntityClient(c)){
      for(const r of await sql`select distinct cl.client_id,ct.contract_id,d.deal_id from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id left join portal_private.deals d on d.client_key=cl.id and d.contract_key=ct.id and d.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum where cl.id=${bound}::uuid and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and ct.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum) and ct.authority_state<>'REJECTED'::portal_private.authority_state_enum`){clients.add(String(r.client_id));contracts.add(String(r.contract_id));if(r.deal_id)deals.add(String(r.deal_id))}
    }else{
      for(const r of await sql`select distinct cl.client_id,ct.contract_id,d.deal_id from portal_private.client_user_bindings b join portal_private.clients cl on cl.id=b.client_key join portal_private.contracts ct on ct.id=b.contract_key left join portal_private.deals d on d.client_key=b.client_key and d.contract_key=b.contract_key and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now()) where b.user_id=${c.user}::uuid and (${bound}::uuid is null or b.client_key=${bound}::uuid) and portal_private.client_user_has_contract_access(${c.user}::uuid,b.contract_key,now())`){clients.add(String(r.client_id));contracts.add(String(r.contract_id));if(r.deal_id)deals.add(String(r.deal_id))}
    }
  }
  if(c.roles.includes("AGENT")){
    const bound=c.impersonation?.effectiveRole==="AGENT"?c.impersonation.targetAgentPersonKey:null;
    for(const r of await sql`select distinct ap.agent_person_id,ale.agent_legal_entity_id,cl.client_id,ct.contract_id,d.deal_id from portal_private.agent_user_bindings ub join portal_private.agent_persons ap on ap.id=ub.agent_person_key left join portal_private.agent_legal_entities ale on ale.id=ub.agent_legal_entity_key join portal_private.agent_client_assignments a on a.agent_person_key=ub.agent_person_key and (ub.agent_legal_entity_key is null or a.agent_legal_entity_key is not distinct from ub.agent_legal_entity_key) join portal_private.agent_deal_terms t on t.assignment_id=a.id join portal_private.deals d on d.id=t.deal_key join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key where ub.user_id=${c.user}::uuid and (${bound}::uuid is null or ap.id=${bound}::uuid) and portal_private.agent_user_has_deal_view_access(${c.user}::uuid,d.id,now())`){persons.add(String(r.agent_person_id));if(r.agent_legal_entity_id)legalEntities.add(String(r.agent_legal_entity_id));clients.add(String(r.client_id));contracts.add(String(r.contract_id));deals.add(String(r.deal_id))}
  }
  return{client_ids:[...clients],contract_ids:[...contracts],deal_ids:[...deals],agent_person_ids:[...persons],agent_legal_entity_ids:[...legalEntities]};
}
export async function recordApiEvent(req:Request,route:string,result:string,status:number,c?:Ctx|null,metadata:Record<string,unknown>={}){
  const requestHeader=req.headers.get("x-request-id"),correlationHeader=req.headers.get("x-correlation-id");
  const requestId=requestHeader&&uuid.test(requestHeader)?requestHeader:crypto.randomUUID();
  const correlationId=correlationHeader&&uuid.test(correlationHeader)?correlationHeader:(c?.impersonation?.correlationId||null);
  const auditMetadata=c?.impersonation?{...metadata,...impersonationMetadata({authUserId:c.actorAuth,portalUserId:c.actorUser,sessionId:c.sid,displayName:c.actorName,roles:c.actorRoles},c.impersonation)}:metadata;
  try{await sql`insert into portal_private.portal_api_request_events(request_id,auth_user_id,portal_user_id,method,route,result,http_status,correlation_id,user_agent,metadata) values(${requestId}::uuid,${c?.actorAuth??c?.auth??null}::uuid,${c?.actorUser??c?.user??null}::uuid,${req.method},${route},${result},${status},${correlationId}::uuid,${req.headers.get("user-agent")},${sql.json(auditMetadata)})`}catch(error){console.error("portal api audit write failed",error)}
  return requestId;
}

