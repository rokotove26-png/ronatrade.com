// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { createClaimsRuntime } from "./claims.ts";

const DB=Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL=Deno.env.get("SUPABASE_URL");
if(!DB||!SUPA_URL)throw new Error("runtime vars missing");
const sql=postgres(DB,{prepare:false,max:1});
const BUCKET="rona-portal-private";
const MAX_PDF=50*1024*1024;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function runtimeKey(kind){const legacy=kind==='pub'?Deno.env.get('SUPABASE_ANON_KEY'):Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(legacy)return legacy;const raw=Deno.env.get(kind==='pub'?'SUPABASE_PUBLISHABLE_KEYS':'SUPABASE_SECRET_KEYS');if(raw){const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}throw new Error('key missing')}
const service=createClient(SUPA_URL,runtimeKey('secret'),{auth:{persistSession:false,autoRefreshToken:false}});
function send(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function pathOf(req){const p=new URL(req.url).pathname,marker='/rona-admin-claims',i=p.indexOf(marker);return i>=0?(p.slice(i+marker.length)||'/'):p}
function jwtClaims(token){try{const p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(p+'='.repeat((4-p.length%4)%4)))}catch{return{}}}
async function authContext(req){const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return null;const token=authorization.slice(7),client=createClient(SUPA_URL,runtimeKey('pub'),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});const {data,error}=await client.auth.getUser(token);if(error||!data.user)return null;const sid=jwtClaims(token).session_id;if(typeof sid!=='string'||!UUID_RE.test(sid))return null;const rows=await sql`select a.portal_user_id,a.display_name,a.roles,s.not_after from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid where a.session_allowed and (s.not_after is null or s.not_after>now())`;if(rows.length!==1)return null;return{authUserId:String(data.user.id),userId:String(rows[0].portal_user_id),displayName:String(rows[0].display_name||''),roles:(rows[0].roles||[]).map(String),sessionId:sid}}
function reqIds(req){const r=req.headers.get('x-request-id'),c=req.headers.get('x-correlation-id');return{requestId:r&&UUID_RE.test(r)?r:crypto.randomUUID(),correlationId:c&&UUID_RE.test(c)?c:null}}
async function audit(tx,ctx,action,entityType,entityId,req,metadata={}){const {requestId,correlationId}=reqIds(req);await tx`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata) values(${ctx.userId}::uuid,'ADMIN',${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,${sql.json(metadata)})`}
const claimsRuntime=createClaimsRuntime({sql,service,BUCKET,MAX_PDF,audit,reqIds});
Deno.serve(async req=>{const ctx=await authContext(req);if(!ctx)return send(401,{ok:false,code:'PORTAL_ACCESS_DENIED'});if(!ctx.roles.includes('ADMIN'))return send(403,{ok:false,code:'ROLE_MISMATCH'});const path=pathOf(req),method=req.method;try{if(path==='/admin/claims'||path.startsWith('/admin/claims/')){const r=await claimsRuntime.handle(ctx,req,path,method);if(r)return send(r.status,r.body)}return send(404,{ok:false,code:'ROUTE_NOT_FOUND'})}catch(e){console.error('rona-admin-claims error',e);const status=Number(e?.status||500);return send(status>=400&&status<600?status:500,{ok:false,code:String(e?.message||'SERVER_ERROR')})}});
