import {applyBrowserImpersonation,browserImpersonationInvalid,readBrowserImpersonation} from '../../_browser-impersonation.js';
const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const EFFECTIVE_CLIENT_FEED_API=`${SUPABASE_URL}/functions/v1/rona-portal-api/v1/client/market-intelligence`;
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
function secureHeaders(){const h=new Headers({'content-type':'application/json; charset=utf-8','x-rona-client-market-intelligence':'safe-feed-v1'});for(const[k,v]of Object.entries(SECURITY_HEADERS))h.set(k,v);return h}
function json(body,status=200,cookies=[]){const h=secureHeaders();for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function sameOrigin(request){const u=new URL(request.url),origin=request.headers.get('origin');if(origin)return origin===u.origin;const ref=request.headers.get('referer');if(!ref)return request.method==='GET';try{return new URL(ref).origin===u.origin}catch{return false}}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const data=await r.json().catch(()=>({}));return{ok:r.ok,data}}
async function effectiveClientFeed(access,request,impersonation){
  const headers=applyBrowserImpersonation(new Headers({authorization:`Bearer ${access}`,accept:'application/json'}),impersonation);
  for(const name of ['x-request-id','x-correlation-id','x-rona-client-source','x-rona-client-refresh-reason']){const value=request.headers.get(name);if(value)headers.set(name,value)}
  return fetch(EFFECTIVE_CLIENT_FEED_API,{method:'GET',headers,cache:'no-store'});
}
function valid(payload){
  if(!payload||payload.version!=='RONA_CLIENT_MARKET_INTELLIGENCE_V1'||!Array.isArray(payload.analytics)||!Array.isArray(payload.news))return false;
  if(String(payload.timezone||'')!=='Europe/Moscow')return false;
  for(const row of payload.analytics){if(!row||!row.publication_id||!row.publication_item_id||!row.product||!row.headline||!row.public_chart||typeof row.public_chart!=='object')return false}
  for(const row of payload.news){if(!row||!row.publication_id||!row.publication_item_id||!row.headline||!row.source_published_at)return false}
  return true;
}
export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403);
  const impersonation=readBrowserImpersonation(request);
  if(browserImpersonationInvalid(impersonation))return json({ok:false,code:'IMPERSONATION_TAB_INVALID',returnTo:'/portal/admin'},409);
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());
  let response=await effectiveClientFeed(access,request,impersonation);
  if(response.status===401&&refresh){
    const next=await authRefresh(refresh);
    if(next.ok&&next.data?.access_token&&next.data?.refresh_token){
      access=next.data.access_token;setCookies=tokenCookies(next.data);
      response=await effectiveClientFeed(access,request,impersonation);
    }
  }
  if(response.status===401){
    if(impersonation.active)return json({ok:false,code:'IMPERSONATION_SESSION_INVALID',returnTo:'/portal/admin'},409,setCookies);
    return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,setCookies.length?setCookies:clearCookies());
  }
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false)return json(payload&&typeof payload==='object'?payload:{ok:false,code:'CLIENT_MARKET_FEED_FAILED'},response.status||502,setCookies);
  if(!valid(payload?.data))return json({ok:false,code:'CLIENT_MARKET_FEED_INVALID'},502,setCookies);
  return json({ok:true,data:payload.data},200,setCookies);
}
