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
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function response(body,status=200,cookies=[]){const h=new Headers({'content-type':'application/json; charset=utf-8'});for(const [k,v] of Object.entries(SECURITY_HEADERS))h.set(k,v);h.set('x-rona-market-news-feed','all-lk-v1');for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
async function refreshSession(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const j=await r.json().catch(()=>({}));return {ok:r.ok,status:r.status,data:j}}
async function callFeed(accessToken){return fetch(`${SUPABASE_URL}/rest/v1/rpc/rona_lk_market_news_feed_v1`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`,'content-type':'application/json',accept:'application/json'},body:'{}'})}
async function load(access,refresh){let r=access?await callFeed(access):null,cookies=[];if(!r||r.status===401){if(!refresh)return {response:response({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies())};let next;try{next=await refreshSession(refresh)}catch(_){return {response:response({ok:false,code:'PORTAL_AUTH_BACKEND_UNAVAILABLE',retryable:true},503)}}if(!next.ok||!next.data?.access_token||!next.data?.refresh_token){if(next.status===429||Number(next.status||0)>=500)return {response:response({ok:false,code:'PORTAL_AUTH_BACKEND_UNAVAILABLE',retryable:true},503)};return {response:response({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies())}}access=next.data.access_token;cookies=[accessCookie(access,Math.min(Math.max(Number(next.data.expires_in||3600),60),7200)),refreshCookie(next.data.refresh_token)];r=await callFeed(access)}return {r,cookies}}
export async function onRequest(context){const {request}=context;if(request.method!=='GET'&&request.method!=='HEAD')return response({ok:false,code:'METHOD_NOT_ALLOWED'},405);const cookies=parseCookies(request.headers.get('cookie')),loaded=await load(cookies[ACCESS_COOKIE]||'',cookies[REFRESH_COOKIE]||'');if(loaded.response)return loaded.response;const {r,cookies:setCookies}=loaded;const body=await r.json().catch(()=>null);if(!r.ok){if(r.status===401)return response({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());if(r.status===403)return response({ok:false,code:'ROLE_MISMATCH'},403,setCookies);return response({ok:false,code:'NEWS_FEED_UNAVAILABLE',retryable:r.status>=500},r.status>=500?503:r.status,setCookies)}const rows=Array.isArray(body)?body:[];return response({ok:true,schema:'RONA_LK_MARKET_NEWS_FEED/1.0',generated_at:new Date().toISOString(),automatic_all_lk:true,news:rows},200,setCookies)}
