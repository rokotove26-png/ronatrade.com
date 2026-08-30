const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const SECURITY_HEADERS=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearCookies(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function tokenCookies(t){const e=Math.min(Math.max(Number(t?.expires_in||3600),60),7200);return[accessCookie(t.access_token,e),refreshCookie(t.refresh_token,604800)]}
function secureHeaders(){const h=new Headers({'content-type':'application/json; charset=utf-8'});for(const[k,v]of Object.entries(SECURITY_HEADERS))h.set(k,v);return h}
function json(body,status=200,cookies=[]){const h=secureHeaders();for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function sameOrigin(request){const u=new URL(request.url),origin=request.headers.get('origin');if(origin)return origin===u.origin;const ref=request.headers.get('referer');if(!ref)return request.method==='GET';try{return new URL(ref).origin===u.origin}catch{return false}}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const data=await r.json().catch(()=>({}));return{ok:r.ok,status:r.status,data}}
async function rpc(access,eventId){return fetch(`${SUPABASE_URL}/rest/v1/rpc/portal_client_event_status_v2`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${access}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({p_event_id:eventId})})}
export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403);
  const url=new URL(request.url),prefix='/portal/api/v1/events/';
  if(!url.pathname.startsWith(prefix)||!url.pathname.endsWith('/status'))return json({ok:false,code:'ROUTE_NOT_ALLOWED'},404);
  let eventId='';try{eventId=decodeURIComponent(url.pathname.slice(prefix.length,-'/status'.length))}catch{return json({ok:false,code:'EVENT_NOT_FOUND'},404)}
  if(!/^PORTAL-EVT-[A-Za-z0-9-]{12,160}$/.test(eventId))return json({ok:false,code:'EVENT_NOT_FOUND'},404);
  const cookies=parseCookies(request.headers.get('cookie'));let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());
  let r=await rpc(access,eventId);
  if(r.status===401&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;setCookies=tokenCookies(next.data);r=await rpc(access,eventId)}}
  if(r.status===401)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());
  const body=await r.json().catch(()=>null);
  if(!r.ok||!body||typeof body!=='object')return json({ok:false,code:'EVENT_STATUS_BACKEND_ERROR'},r.status>=500?503:502,setCookies);
  if(body.found!==true)return json({ok:false,code:String(body.code||'EVENT_NOT_FOUND')},body.code==='EVENT_NOT_FOUND'?404:403,setCookies);
  return json({ok:true,event:body.event},200,setCookies);
}
