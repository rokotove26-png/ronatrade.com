const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const UPSTREAM=`${SUPABASE_URL}/functions/v1/rona-owner-acceptance`;
const AI_SYNC_UPSTREAM=`${SUPABASE_URL}/functions/v1/rona-owner-ai-sync`;
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const SECURITY_HEADERS=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearCookies(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function tokenCookies(t){const e=Math.min(Math.max(Number(t?.expires_in||3600),60),7200);return[accessCookie(t.access_token,e),refreshCookie(t.refresh_token,604800)]}
function headers(base=new Headers()){const h=new Headers(base);for(const[k,v]of Object.entries(SECURITY_HEADERS))h.set(k,v);h.delete('access-control-allow-origin');h.delete('access-control-allow-credentials');h.delete('content-length');h.delete('etag');return h}
function json(body,status=200,cookies=[]){const h=headers(new Headers({'content-type':'application/json; charset=utf-8'}));for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function sameOriginPost(request){const url=new URL(request.url),origin=request.headers.get('origin');if(origin)return origin===url.origin;const ref=request.headers.get('referer');if(!ref)return false;try{return new URL(ref).origin===url.origin}catch{return false}}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const data=await r.json().catch(()=>({}));return{ok:r.ok,data}}
function allowedPath(path){return /^\/(admin|client|agent)\//.test(path)||['/admin/bootstrap','/client/bootstrap','/agent/bootstrap','/agent/price-list.pdf','/admin/ai-sync','/agent/ai-sync'].includes(path)}
function upstreamFor(path){if(path==='/admin/ai-sync')return`${AI_SYNC_UPSTREAM}/admin/sync`;if(path==='/agent/ai-sync')return`${AI_SYNC_UPSTREAM}/agent/sync`;return`${UPSTREAM}${path}`}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function failClosedClientMarket(path,response){
  if(path!=='/client/bootstrap'||!response.ok)return response;
  const ct=String(response.headers.get('content-type')||'');
  if(!ct.includes('application/json'))return response;
  const payload=await response.json().catch(()=>null);
  if(!payload||typeof payload!=='object')return new Response(JSON.stringify({ok:false,code:'CLIENT_BOOTSTRAP_INVALID'}),{status:502,headers:{'content-type':'application/json; charset=utf-8'}});
  if(payload.data&&typeof payload.data==='object'){
    payload.data.analytics=[];
    payload.data.news=[];
    payload.data.marketPublicationGate={status:'FAIL_CLOSED',reason:'ONLY_PUBLISHED_DISTRIBUTION_ALLOWED'};
  }
  const h=new Headers(response.headers);h.set('content-type','application/json; charset=utf-8');
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers:h});
}
export async function onRequest(context){
  const request=context.request;
  if(!['GET','POST'].includes(request.method))return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(request.method==='POST'&&!sameOriginPost(request))return json({ok:false,code:'ORIGIN_DENIED'},403);
  const url=new URL(request.url),path=String(url.searchParams.get('path')||'');
  if(!path.startsWith('/')||path.includes('..')||!allowedPath(path))return json({ok:false,code:'ROUTE_NOT_ALLOWED'},404);
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());
  const body=request.method==='POST'?await request.clone().arrayBuffer():null;
  const forward=async token=>{const h=new Headers({authorization:`Bearer ${token}`,accept:request.headers.get('accept')||'application/json'});for(const name of['content-type','x-request-id','x-correlation-id']){const v=request.headers.get(name);if(v)h.set(name,v)}const init={method:request.method,headers:h};if(body!==null)init.body=body;return fetch(upstreamFor(path),init)};
  const forwardReadResilient=async token=>{let r;for(let i=0;i<3;i++){r=await forward(token);if(request.method!=='GET'||r.status<500||r.status>=600)return r;if(i<2){await r.arrayBuffer().catch(()=>{});await sleep(250*(i+1))}}return r};
  let response=await forwardReadResilient(access);
  if(response.status===401&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;setCookies=tokenCookies(next.data);response=await forwardReadResilient(access)}}
  response=await failClosedClientMarket(path,response);
  const outHeaders=headers(response.headers);for(const c of setCookies)outHeaders.append('set-cookie',c);if(response.status===401&&!setCookies.length){for(const c of clearCookies())outHeaders.append('set-cookie',c)}
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:outHeaders});
}
