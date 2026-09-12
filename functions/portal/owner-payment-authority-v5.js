const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const MUTATION_FUNCTION='rona-owner-payment-authority-v5';
const ACCESS_COOKIE='rona_portal_at',REFRESH_COOKIE='rona_portal_rt';
function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return`${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return`${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
async function refresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});return{ok:r.ok,data:await r.json().catch(()=>({}))}}
function headers(base){const h=new Headers(base||{});h.set('cache-control','no-store');h.set('pragma','no-cache');h.set('x-content-type-options','nosniff');h.set('x-frame-options','DENY');h.delete('content-length');return h}
function suffix(path){const marker='/portal/owner-payment-authority-v5',i=path.indexOf(marker);return i>=0?(path.slice(i+marker.length)||'/'):path}
async function forward(token,request){const path=suffix(new URL(request.url).pathname),h=new Headers({authorization:`Bearer ${token}`,accept:'application/json','content-type':'application/json'}),idem=request.headers.get('x-idempotency-key');if(idem)h.set('x-idempotency-key',idem);return fetch(`${SUPABASE_URL}/functions/v1/${MUTATION_FUNCTION}${path}`,{method:'POST',headers:h,body:await request.clone().text(),cache:'no-store'})}
export async function onRequest(context){
  const request=context.request;if(request.method!=='POST')return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:headers({'content-type':'application/json; charset=utf-8'})});
  const cookies=parseCookies(request.headers.get('cookie'));let access=cookies[ACCESS_COOKIE]||'',refreshToken=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refreshToken){const next=await refresh(refreshToken);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refreshToken=next.data.refresh_token;setCookies=[accessCookie(access,next.data.expires_in),refreshCookie(refreshToken)]}}
  if(!access)return new Response(JSON.stringify({ok:false,code:'PORTAL_ACCESS_DENIED'}),{status:401,headers:headers({'content-type':'application/json; charset=utf-8'})});
  let upstream=await forward(access,request);
  if(upstream.status===401&&refreshToken){const next=await refresh(refreshToken);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refreshToken=next.data.refresh_token;setCookies=[accessCookie(access,next.data.expires_in),refreshCookie(refreshToken)];upstream=await forward(access,request)}}
  const body=await upstream.arrayBuffer(),out=headers(upstream.headers);for(const cookie of setCookies)out.append('set-cookie',cookie);out.set('x-rona-owner-payment-authority','V5_AUTHENTICATED_OWNER_ONLY');return new Response(body,{status:upstream.status,statusText:upstream.statusText,headers:out});
}
