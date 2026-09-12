// @ts-nocheck
import {createClient} from '@supabase/supabase-js';
import postgres from 'postgres';

const SUPA_URL=Deno.env.get('SUPABASE_URL'),DB=Deno.env.get('SUPABASE_DB_URL');
if(!SUPA_URL||!DB)throw new Error('runtime vars missing');
const sql=postgres(DB,{prepare:false,max:1,idle_timeout:1,max_lifetime:30,connect_timeout:5});
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function runtimeKey(kind){const legacy=kind==='pub'?Deno.env.get('SUPABASE_ANON_KEY'):Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(legacy)return legacy;const raw=Deno.env.get(kind==='pub'?'SUPABASE_PUBLISHABLE_KEYS':'SUPABASE_SECRET_KEYS');if(raw){const p=JSON.parse(raw);if(p.default)return p.default}throw new Error('key missing')}
const service=createClient(SUPA_URL,runtimeKey('secret'),{auth:{persistSession:false,autoRefreshToken:false}});
const publicClient=createClient(SUPA_URL,runtimeKey('pub'),{auth:{persistSession:false,autoRefreshToken:false}});
const send=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function claims(token){try{const p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(p+'='.repeat((4-p.length%4)%4)))}catch{return{}}}
async function authContext(req){
  const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return null;
  const token=authorization.slice(7),{data,error}=await publicClient.auth.getUser(token);if(error||!data.user)return null;
  const sid=claims(token).session_id;if(typeof sid!=='string'||!UUID_RE.test(sid))return null;
  const rows=await sql`select a.portal_user_id,a.roles,s.not_after from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid where a.session_allowed and (s.not_after is null or s.not_after>now())`;
  if(rows.length!==1)return null;return{portalUserId:String(rows[0].portal_user_id),roles:(rows[0].roles||[]).map(String)};
}
function route(req){const p=new URL(req.url).pathname,m='/rona-owner-payment-authority-v4',i=p.indexOf(m);return i>=0?(p.slice(i+m.length)||'/'):p}
function idem(req,body){return String(req.headers.get('x-idempotency-key')||body?.idempotencyKey||'').trim()}

Deno.serve(async req=>{
  if(req.method!=='POST')return send(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  const ctx=await authContext(req);if(!ctx)return send(401,{ok:false,code:'PORTAL_ACCESS_DENIED'});
  if(!ctx.roles.includes('ADMIN'))return send(403,{ok:false,code:'ROLE_MISMATCH'});
  const body=await req.json().catch(()=>null);if(!body||typeof body!=='object')return send(400,{ok:false,code:'INVALID_JSON'});
  const idempotencyKey=idem(req,body);if(!idempotencyKey)return send(400,{ok:false,code:'IDEMPOTENCY_KEY_REQUIRED'});
  const dryRun=body.dryRun!==false;
  try{
    if(route(req)==='/client-allocation'){
      const paymentId=String(body.paymentId||'').trim(),allocations=Array.isArray(body.allocations)?body.allocations:[];
      if(!paymentId||!allocations.length)return send(400,{ok:false,code:'CLIENT_ALLOCATION_INPUT_REQUIRED'});
      const {data,error}=await service.rpc('owner_client_payment_allocate_v4',{
        p_payment_id:paymentId,p_allocations:allocations,p_actor_user_id:ctx.portalUserId,p_idempotency_key:idempotencyKey,
        p_supersedes_authorization_id:body.supersedesAuthorizationId||null,p_dry_run:dryRun});
      if(error)throw Object.assign(new Error(error.message||'CLIENT_ALLOCATION_RPC_FAILED'),{detail:error});
      return send(200,{ok:true,data});
    }
    if(route(req)==='/deal-spend'){
      const paymentId=String(body.paymentId||'').trim(),dealId=String(body.dealId||'').trim(),amount=Number(body.amount);
      if(!paymentId||!dealId||!Number.isFinite(amount)||amount<=0)return send(400,{ok:false,code:'DEAL_SPEND_INPUT_REQUIRED'});
      const {data,error}=await service.rpc('owner_deal_spend_allocate_v4',{
        p_payment_id:paymentId,p_deal_id:dealId,p_amount:amount,p_actor_user_id:ctx.portalUserId,p_idempotency_key:idempotencyKey,
        p_supersedes_id:body.supersedesId||null,p_dry_run:dryRun});
      if(error)throw Object.assign(new Error(error.message||'DEAL_SPEND_RPC_FAILED'),{detail:error});
      return send(200,{ok:true,data});
    }
    return send(404,{ok:false,code:'ROUTE_NOT_FOUND'});
  }catch(e){console.error('rona-owner-payment-authority-v4',e);return send(409,{ok:false,code:String(e?.message||'OWNER_PAYMENT_AUTHORITY_FAILED')})}
});
