import { validateApplicationProjection } from '../../../application-business-contract-v2.js';
import {applyBrowserImpersonation,browserImpersonationInvalid,readBrowserImpersonation} from '../../_browser-impersonation.js';

const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const EFFECTIVE_APPLICATIONS_API=`${SUPABASE_URL}/functions/v1/rona-portal-api/v1/client/applications-projection`;
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const SECURITY_HEADERS=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate, max-age=0','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});

function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearCookies(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function tokenCookies(t){const e=Math.min(Math.max(Number(t?.expires_in||3600),60),7200);return[accessCookie(t.access_token,e),refreshCookie(t.refresh_token,604800)]}
function secureHeaders(base=new Headers()){const h=new Headers(base);for(const[k,v]of Object.entries(SECURITY_HEADERS))h.set(k,v);h.delete('access-control-allow-origin');h.delete('access-control-allow-credentials');h.delete('content-length');h.delete('etag');return h}
function json(body,status=200,cookies=[]){const h=secureHeaders(new Headers({'content-type':'application/json; charset=utf-8','x-rona-client-applications-projection':'effective-client-v1'}));for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function sameOrigin(request){const u=new URL(request.url),origin=request.headers.get('origin');if(origin)return origin===u.origin;const ref=request.headers.get('referer');if(!ref)return request.method==='GET';try{return new URL(ref).origin===u.origin}catch{return false}}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const data=await r.json().catch(()=>({}));return{ok:r.ok,data}}
async function effectiveProjection(access,request,impersonation,clientId,contractId){
  const headers=applyBrowserImpersonation(new Headers({authorization:`Bearer ${access}`,accept:'application/json'}),impersonation);
  for(const name of ['x-request-id','x-correlation-id','x-rona-client-source','x-rona-client-refresh-reason']){const value=request.headers.get(name);if(value)headers.set(name,value)}
  const url=new URL(EFFECTIVE_APPLICATIONS_API);
  url.searchParams.set('clientId',clientId);
  url.searchParams.set('contractId',contractId);
  return fetch(url,{method:'GET',headers,cache:'no-store'});
}

export async function onRequestGet(context){
  const request=context.request;
  if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403);
  const url=new URL(request.url),clientId=String(url.searchParams.get('clientId')||'').trim(),contractId=String(url.searchParams.get('contractId')||'').trim();
  if(!clientId||!contractId)return json({ok:false,code:'CLIENT_CONTRACT_CONTEXT_REQUIRED'},400);

  const impersonation=readBrowserImpersonation(request);
  if(browserImpersonationInvalid(impersonation))return json({ok:false,code:'IMPERSONATION_TAB_INVALID',returnTo:'/portal/admin'},409);

  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());

  let response=await effectiveProjection(access,request,impersonation,clientId,contractId);
  if(response.status===401&&refresh){
    const next=await authRefresh(refresh);
    if(next.ok&&next.data?.access_token&&next.data?.refresh_token){
      access=next.data.access_token;
      setCookies=tokenCookies(next.data);
      response=await effectiveProjection(access,request,impersonation,clientId,contractId);
    }
  }

  if(response.status===401){
    if(impersonation.active)return json({ok:false,code:'IMPERSONATION_SESSION_INVALID',returnTo:'/portal/admin'},409,setCookies);
    return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,setCookies.length?setCookies:clearCookies());
  }

  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false){
    const code=String(payload?.code||'APPLICATION_PROJECTION_UNAVAILABLE');
    return json({ok:false,code},response.status||502,setCookies);
  }

  const projection=payload?.data;
  try{validateApplicationProjection(projection,{clientId,contractId})}catch{return json({ok:false,code:'APPLICATION_CANONICAL_PROJECTION_REQUIRED'},503,setCookies)}
  return json({ok:true,projection_contract:'CLIENT_APPLICATIONS_AUTHORITATIVE_V1',...projection,application_business_contract:projection.contract},200,setCookies);
}
