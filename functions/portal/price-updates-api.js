const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const RPC=`${SUPABASE_URL}/rest/v1/rpc`;
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const SEC={'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'};
function cookies(v){const o={};for(const x of String(v||'').split(';')){const i=x.indexOf('=');if(i>0)o[x.slice(0,i).trim()]=x.slice(i+1).trim()}return o}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clear(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function out(body,status=200,set=[]){const h=new Headers({'content-type':'application/json; charset=utf-8',...SEC});for(const c of set)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function sameOrigin(req){const u=new URL(req.url),o=req.headers.get('origin');if(o)return o===u.origin;const r=req.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}}
async function renew(token){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:token})});return{ok:r.ok,data:await r.json().catch(()=>({}))}}
async function rpc(token,name,args={}){return fetch(`${RPC}/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args)})}
async function invoke(req,name,args){const c=cookies(req.headers.get('cookie'));let access=c[ACCESS_COOKIE]||'',refresh=c[REFRESH_COOKIE]||'',set=[];if(!access&&refresh){const n=await renew(refresh);if(n.ok&&n.data?.access_token){access=n.data.access_token;set=[accessCookie(access,n.data.expires_in),refreshCookie(n.data.refresh_token)]}}
if(!access)return out({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clear());let r=await rpc(access,name,args);if(r.status===401&&refresh){const n=await renew(refresh);if(n.ok&&n.data?.access_token){access=n.data.access_token;set=[accessCookie(access,n.data.expires_in),refreshCookie(n.data.refresh_token)];r=await rpc(access,name,args)}}const data=await r.json().catch(()=>null);if(!r.ok){const code=String(data?.message||data?.code||`HTTP_${r.status}`);return out({ok:false,code},r.status===400?409:r.status,set)}return out({ok:true,data},200,set)}
async function body(req){try{return await req.json()}catch{return{}}}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
export async function onRequest({request}){
  if(!['GET','POST'].includes(request.method))return out({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(request.method==='POST'&&!sameOrigin(request))return out({ok:false,code:'ORIGIN_DENIED'},403);
  const u=new URL(request.url),op=String(u.searchParams.get('op')||'');
  if(op==='bootstrap'&&request.method==='GET')return invoke(request,'owner_price_updates_bootstrap',{});
  if(op==='cp-bootstrap'&&request.method==='GET')return invoke(request,'owner_agent_cp_owner_gate_bootstrap',{});
  if(op==='apply'&&request.method==='POST'){
    const id=String(u.searchParams.get('id')||'');if(!uuid(id))return out({ok:false,code:'INVALID_PROPOSAL_ID'},400);
    return invoke(request,'owner_apply_price_change_proposal',{p_proposal_id:id});
  }
  if(op==='reject'&&request.method==='POST'){
    const id=String(u.searchParams.get('id')||'');if(!uuid(id))return out({ok:false,code:'INVALID_PROPOSAL_ID'},400);
    const b=await body(request);return invoke(request,'owner_reject_price_change_proposal',{p_proposal_id:id,p_reason:String(b?.reason||'').trim()||null});
  }
  if(op==='audience'&&request.method==='POST'){
    const b=await body(request);if(typeof b?.client!=='boolean'||typeof b?.agent!=='boolean')return out({ok:false,code:'INVALID_AUDIENCE_STATE'},400);
    return invoke(request,'owner_set_price_publication_audience',{p_client:b.client,p_agent:b.agent});
  }
  return out({ok:false,code:'ROUTE_NOT_ALLOWED'},404);
}
