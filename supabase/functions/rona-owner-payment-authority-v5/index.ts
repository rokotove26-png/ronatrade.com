// @ts-nocheck
import {createClient} from '@supabase/supabase-js';

const SUPA_URL=Deno.env.get('SUPABASE_URL');
if(!SUPA_URL)throw new Error('SUPABASE_URL missing');
function publicKey(){
  const legacy=Deno.env.get('SUPABASE_ANON_KEY');if(legacy)return legacy;
  const raw=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');if(raw){const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}
  throw new Error('publishable key missing');
}
const KEY=publicKey();
const send=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function pathOf(req){const p=new URL(req.url).pathname,m='/rona-owner-payment-authority-v5',i=p.indexOf(m);return i>=0?(p.slice(i+m.length)||'/'):p}
function idem(req,body){return String(req.headers.get('x-idempotency-key')||body?.idempotencyKey||'').trim()}
function userClient(authorization){return createClient(SUPA_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}})}

Deno.serve(async req=>{
  if(req.method!=='POST')return send(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  const authorization=req.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return send(401,{ok:false,code:'PORTAL_ACCESS_DENIED'});
  const client=userClient(authorization),{data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData?.user)return send(401,{ok:false,code:'PORTAL_ACCESS_DENIED'});
  const body=await req.json().catch(()=>null);if(!body||typeof body!=='object')return send(400,{ok:false,code:'INVALID_JSON'});
  const idempotencyKey=idem(req,body);if(!idempotencyKey)return send(400,{ok:false,code:'IDEMPOTENCY_KEY_REQUIRED'});
  const dryRun=body.dryRun!==false;
  try{
    if(pathOf(req)==='/client-allocation'){
      const paymentId=String(body.paymentId||'').trim(),allocations=Array.isArray(body.allocations)?body.allocations:[];
      if(!paymentId||!allocations.length)return send(400,{ok:false,code:'CLIENT_ALLOCATION_INPUT_REQUIRED'});
      const {data,error}=await client.rpc('owner_client_payment_allocate_v5',{
        p_payment_id:paymentId,p_allocations:allocations,p_idempotency_key:idempotencyKey,
        p_supersedes_authorization_id:body.supersedesAuthorizationId||null,p_dry_run:dryRun
      });
      if(error)throw Object.assign(new Error(error.message||'CLIENT_ALLOCATION_RPC_FAILED'),{detail:error});
      return send(200,{ok:true,data});
    }
    if(pathOf(req)==='/outgoing-decision'){
      const paymentId=String(body.paymentId||'').trim(),decisionType=String(body.decisionType||'').trim().toUpperCase(),dealId=body.dealId==null?null:String(body.dealId).trim();
      if(!paymentId||!['DEAL_BINDING','ADVANCE_PAYMENT'].includes(decisionType))return send(400,{ok:false,code:'OUTGOING_DECISION_INPUT_REQUIRED'});
      if(decisionType==='DEAL_BINDING'&&!dealId)return send(400,{ok:false,code:'DEAL_ID_REQUIRED'});
      if(decisionType==='ADVANCE_PAYMENT'&&dealId)return send(400,{ok:false,code:'ADVANCE_STATUS_MUST_NOT_BIND_DEAL'});
      const {data,error}=await client.rpc('owner_outgoing_payment_decide_v5',{
        p_payment_id:paymentId,p_decision_type:decisionType,p_deal_id:dealId,p_idempotency_key:idempotencyKey,
        p_supersedes_id:body.supersedesId||null,p_dry_run:dryRun
      });
      if(error)throw Object.assign(new Error(error.message||'OUTGOING_DECISION_RPC_FAILED'),{detail:error});
      return send(200,{ok:true,data});
    }
    return send(404,{ok:false,code:'ROUTE_NOT_FOUND'});
  }catch(e){
    console.error('rona-owner-payment-authority-v5',e);
    const message=String(e?.message||'OWNER_PAYMENT_AUTHORITY_FAILED');
    const status=/REQUIRED|INVALID|EXCEEDS|NOT_ELIGIBLE|CONFLICT|EXISTS|NOT_ACTIVE|CANNOT/.test(message)?409:/AUTH|ADMIN|FORBIDDEN/.test(message)?403:500;
    return send(status,{ok:false,code:message});
  }
});
