const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const SECURITY_HEADERS=Object.freeze({
  'cache-control':'no-store, no-cache, must-revalidate',
  'pragma':'no-cache',
  'referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy':'same-origin',
  'cross-origin-resource-policy':'same-origin'
});
function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearCookies(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function tokenCookies(t){const e=Math.min(Math.max(Number(t?.expires_in||3600),60),7200);return[accessCookie(t.access_token,e),refreshCookie(t.refresh_token,604800)]}
function secureHeaders(base=new Headers()){const h=new Headers(base);for(const[k,v]of Object.entries(SECURITY_HEADERS))h.set(k,v);h.delete('access-control-allow-origin');h.delete('access-control-allow-credentials');h.delete('content-length');h.delete('etag');return h}
function json(body,status=200,cookies=[]){const h=secureHeaders(new Headers({'content-type':'application/json; charset=utf-8','x-rona-analytics-data':'owner-analytics-rpc-v1'}));for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function sameOrigin(request){const u=new URL(request.url),origin=request.headers.get('origin');if(origin)return origin===u.origin;const ref=request.headers.get('referer');if(!ref)return request.method==='GET';try{return new URL(ref).origin===u.origin}catch{return false}}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const data=await r.json().catch(()=>({}));return{ok:r.ok,data}}
async function analyticsRpc(token){return fetch(`${SUPABASE_URL}/rest/v1/rpc/owner_analytics_admin_bootstrap`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,accept:'application/json','content-type':'application/json'},body:'{}'})}
async function loadWithRefresh(access,refresh){let cookies=[];let response=await analyticsRpc(access);if(response.status===401&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;cookies=tokenCookies(next.data);response=await analyticsRpc(access)}}return{response,cookies}}
function canonicalValid(payload){
  if(!payload||payload.version!=='RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1'||!payload.products)return false;
  return ['AI92','AI95','DT','LPG'].every(key=>Array.isArray(payload.products?.[key]?.dates)&&Array.isArray(payload.products?.[key]?.values)&&payload.products[key].dates.length===payload.products[key].values.length&&payload.products[key].dates.length>0);
}
export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403);
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());
  const loaded=await loadWithRefresh(access,refresh);
  if(loaded.cookies.length)setCookies=loaded.cookies;
  const response=loaded.response;
  if(response.status===401)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,setCookies.length?setCookies:clearCookies());
  if(!response.ok){const raw=await response.text().catch(()=>''),denied=response.status===403||response.status===400&&/PORTAL_ACCESS_DENIED|42501/i.test(raw);return json({ok:false,code:denied?'ANALYTICS_ACCESS_DENIED':'ANALYTICS_BOOTSTRAP_FAILED'},denied?403:502,setCookies)}
  const data=await response.json().catch(()=>null);
  const current=data?.currentAnalytics,canonical=data?.canonicalAnalytics;
  if(!data||typeof data!=='object'||!current||current.status!=='PUBLISHED'||current.audience!=='ALL_CLIENTS'||current.authority_state!=='VERIFIED'||!Array.isArray(current.items)||!canonicalValid(canonical))return json({ok:false,code:'ANALYTICS_BOOTSTRAP_INVALID'},502,setCookies);
  return json({ok:true,data},200,setCookies);
}
