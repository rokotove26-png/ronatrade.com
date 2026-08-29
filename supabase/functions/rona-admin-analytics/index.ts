import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB=Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL=Deno.env.get("SUPABASE_URL");
if(!DB||!SUPA_URL)throw new Error("runtime vars missing");
const sql=postgres(DB,{prepare:false,max:1});
const origins=new Set(["https://ronaoil.com","https://www.ronaoil.com"]);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function runtimePublicKey(){
  const legacy=Deno.env.get("SUPABASE_ANON_KEY");
  if(legacy)return legacy;
  const raw=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if(raw){const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}
  throw new Error("publishable key missing");
}
function claims(token:string){
  try{const p=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(p+"=".repeat((4-p.length%4)%4)))}catch{return{}}
}
function response(origin:string|null,status:number,body:unknown){
  const h:Record<string,string>={"content-type":"application/json; charset=utf-8","cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache","vary":"Origin","x-rona-admin-analytics":"authoritative-latest-v1"};
  if(origin&&origins.has(origin))h["access-control-allow-origin"]=origin;
  return new Response(JSON.stringify(body,(_k,v)=>typeof v==="bigint"?v.toString():v),{status,headers:h});
}
async function authorize(req:Request){
  const authorization=req.headers.get("authorization");
  if(!authorization?.startsWith("Bearer "))return null;
  const token=authorization.slice(7);
  const client=createClient(SUPA_URL!,runtimePublicKey(),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const {data,error}=await client.auth.getUser(token);
  if(error||!data.user)return null;
  const sid=claims(token).session_id;
  if(typeof sid!=="string"||!UUID_RE.test(sid))return null;
  const rows=await sql`select a.roles,s.not_after from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid where a.session_allowed and (s.not_after is null or s.not_after>now())`;
  if(rows.length!==1)return null;
  const roles=(rows[0].roles||[]).map(String);
  return roles.includes("ADMIN")?{roles}:null;
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin");
  if(origin&&!origins.has(origin))return response(null,403,{ok:false,code:"ORIGIN_DENIED"});
  if(req.method==="OPTIONS")return response(origin,204,{ok:true});
  if(req.method!=="GET")return response(origin,405,{ok:false,code:"METHOD_NOT_ALLOWED"});
  if(!await authorize(req))return response(origin,403,{ok:false,code:"ADMIN_ACCESS_DENIED"});
  try{
    const publications=await sql`
      select p.id,p.publication_id,p.publication_type::text,p.title,p.status::text,p.audience,
             p.prepared_at,p.approved_at,p.published_at,p.authority_state::text,p.lifecycle_state::text,
             p.updated_at,p.source_system,p.source_version,p.source_timestamp
        from portal_private.publications p
       where p.publication_type='ANALYTICS'::portal_private.publication_type_enum
         and p.status='PUBLISHED'::portal_private.publication_status_enum
         and p.published_at is not null
         and p.audience='ALL_CLIENTS'
         and p.authority_state='VERIFIED'::portal_private.authority_state_enum
         and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       order by p.published_at desc,p.updated_at desc,p.created_at desc
       limit 1`;
    if(publications.length!==1)return response(origin,503,{ok:false,code:"CURRENT_ANALYTICS_PUBLICATION_MISSING"});
    const p=publications[0];
    const items=await sql`
      select pi.id::text as publication_item_id,pi.item_order,pi.item_type::text,pi.product,pi.basis,
             pi.currency,pi.price,pi.headline,pi.content_text,pi.analytics_as_of,pi.analytics_period_from,
             pi.analytics_period_to,pi.forecast_scenario,pi.actual_value,pi.forecast_value,pi.analytics_unit,
             pi.metadata->'public_chart' as public_chart,pi.metadata,pi.source_system,pi.source_version,
             pi.source_timestamp,pi.authority_state::text,pi.lifecycle_state::text,pi.updated_at
        from portal_private.publication_items pi
       where pi.publication_key=${p.id}::uuid
         and pi.item_type='ANALYTICS'::portal_private.publication_item_type_enum
         and pi.distribution_allowed=true
         and pi.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
         and pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
         and coalesce(pi.metadata->>'publication_layer','')='DERIVED_ANALYTICS'
         and lower(coalesce(pi.metadata->>'public_chart_ready','false'))='true'
         and pi.metadata->'public_chart' is not null
       order by pi.item_order,pi.created_at`;
    if(!items.length)return response(origin,503,{ok:false,code:"LATEST_ANALYTICS_NOT_PUBLIC_READY",publication_id:String(p.publication_id)});
    const currentAnalytics={
      publication_id:String(p.publication_id),publication_type:String(p.publication_type),title:String(p.title||""),
      status:String(p.status),audience:String(p.audience),prepared_at:p.prepared_at,approved_at:p.approved_at,
      published_at:p.published_at,authority_state:String(p.authority_state),lifecycle_state:String(p.lifecycle_state),
      updated_at:p.updated_at,source_system:p.source_system?String(p.source_system):null,source_version:p.source_version?String(p.source_version):null,
      source_timestamp:p.source_timestamp,items
    };
    return response(origin,200,{ok:true,data:{generated_at:new Date().toISOString(),currentAnalytics}});
  }catch(error){console.error("admin analytics endpoint failed",error);return response(origin,500,{ok:false,code:"ADMIN_ANALYTICS_SERVER_ERROR"})}
});
