const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PREVIEW_FUNCTION='rona-admin-exact-module-candidate-20260817';
const ACCESS_COOKIE='rona_portal_at',REFRESH_COOKIE='rona_portal_rt';
function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return`${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return`${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
async function refresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});return{ok:r.ok,data:await r.json().catch(()=>({}))}}
function responseHeaders(base){const h=new Headers(base||{});h.set('cache-control','no-store, no-cache, must-revalidate');h.set('pragma','no-cache');h.set('x-content-type-options','nosniff');h.set('x-frame-options','DENY');h.set('x-rona-owner-payments-v3-source','ISOLATED_PREVIEW');h.delete('content-length');return h}
async function callPreview(token,request){const h=new Headers({authorization:`Bearer ${token}`,accept:'application/json'});const requestId=request.headers.get('x-request-id');if(requestId)h.set('x-request-id',requestId);return fetch(`${SUPABASE_URL}/functions/v1/${PREVIEW_FUNCTION}/admin/sync`,{method:'GET',headers:h,cache:'no-store'})}
export async function onRequest(context){
  const request=context.request,url=new URL(request.url);
  if(!url.hostname.endsWith('.rona-trade-public.pages.dev'))return new Response(JSON.stringify({ok:false,code:'PREVIEW_ONLY'}),{status:404,headers:responseHeaders({'content-type':'application/json; charset=utf-8'})});
  if(request.method!=='GET')return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:responseHeaders({'content-type':'application/json; charset=utf-8'})});
  const cookies=parseCookies(request.headers.get('cookie'));let access=cookies[ACCESS_COOKIE]||'',refreshToken=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refreshToken){const next=await refresh(refreshToken);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refreshToken=next.data.refresh_token;setCookies=[accessCookie(access,next.data.expires_in),refreshCookie(refreshToken)]}}
  if(!access)return new Response(JSON.stringify({ok:false,code:'PORTAL_ACCESS_DENIED'}),{status:401,headers:responseHeaders({'content-type':'application/json; charset=utf-8'})});
  let upstream=await callPreview(access,request);
  if(upstream.status===401&&refreshToken){const next=await refresh(refreshToken);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refreshToken=next.data.refresh_token;setCookies=[accessCookie(access,next.data.expires_in),refreshCookie(refreshToken)];upstream=await callPreview(access,request)}}
  const body=await upstream.arrayBuffer(),headers=responseHeaders(upstream.headers);for(const cookie of setCookies)headers.append('set-cookie',cookie);headers.set('x-rona-owner-payments-v3-backend',PREVIEW_FUNCTION);return new Response(body,{status:upstream.status,statusText:upstream.statusText,headers});
}
