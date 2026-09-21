import { applyCanonicalApplications, projectionFromData, APPLICATION_BUSINESS_CONTRACT } from './application-business-contract-v2.js';

const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ACCEPTANCE=`${SUPABASE_URL}/functions/v1/rona-owner-acceptance`;
const PORTAL_API=`${SUPABASE_URL}/functions/v1/rona-portal-api`;
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';

function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function tokenCookies(tokens){const expires=Math.min(Math.max(Number(tokens?.expires_in||3600),60),7200);return[accessCookie(tokens.access_token,expires),refreshCookie(tokens.refresh_token,604800)]}
function responseHeaders(base=new Headers()){const h=new Headers(base);h.set('cache-control','no-store, no-cache, must-revalidate');h.set('pragma','no-cache');h.set('x-content-type-options','nosniff');h.delete('content-length');h.delete('etag');return h}
function json(body,status=200,cookies=[],extra={}){const h=responseHeaders(new Headers({'content-type':'application/json; charset=utf-8'}));for(const [k,v] of Object.entries(extra))h.set(k,String(v));for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});return{ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))}}
async function baseBootstrap(token,source,reason){return fetch(`${OWNER_ACCEPTANCE}/admin/bootstrap`,{headers:{authorization:`Bearer ${token}`,accept:'application/json','x-rona-client-source':source,'x-rona-client-refresh-reason':reason}})}
async function intakeBootstrap(token,source,reason){return fetch(`${PORTAL_API}/v1/admin/bootstrap`,{headers:{authorization:`Bearer ${token}`,accept:'application/json','x-rona-client-source':source,'x-rona-client-refresh-reason':reason}})}
async function readJson(response){return response.json().catch(()=>null)}
async function readSet(token,source,reason){const [base,intake]=await Promise.all([baseBootstrap(token,source,reason),intakeBootstrap(token,source,reason)]);return{base,intake}}

export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  const source=String(request.headers.get('x-rona-client-source')||'ADMIN_MAIN_COMPLETED_BOOTSTRAP').trim()||'ADMIN_MAIN_COMPLETED_BOOTSTRAP';
  const reason=String(request.headers.get('x-rona-client-refresh-reason')||'ADMIN_MAIN_INITIAL_OR_REFRESH').trim()||'ADMIN_MAIN_INITIAL_OR_REFRESH';
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401);

  let set=await readSet(access,source,reason);
  if((set.base.status===401||set.intake.status===401)&&refresh){
    const next=await authRefresh(refresh);
    if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;setCookies=tokenCookies(next.data);set=await readSet(access,source,reason)}
  }
  if(!set.base.ok){const body=await readJson(set.base);return json(body&&typeof body==='object'?body:{ok:false,code:`ADMIN_BOOTSTRAP_${set.base.status}`},set.base.status,setCookies)}
  if(!set.intake.ok){const body=await readJson(set.intake);return json({ok:false,code:String(body?.code||body?.message||`ADMIN_INTAKE_BOOTSTRAP_${set.intake.status}`)},set.intake.status,setCookies)}

  const basePayload=await readJson(set.base),intakePayload=await readJson(set.intake);
  if(!basePayload?.data||!intakePayload?.data)return json({ok:false,code:'ADMIN_CANONICAL_PROJECTION_INVALID'},502,setCookies);
  try{
    // Preserve every non-application field from the existing authenticated bootstrap.
    // Never reconstruct Applications from Deals, events or historical workflow rows.
    basePayload.data=applyCanonicalApplications(basePayload.data,projectionFromData(intakePayload.data));
    return json(basePayload,200,setCookies,{'x-rona-application-business':APPLICATION_BUSINESS_CONTRACT});
  }catch{
    return json({ok:false,code:'ADMIN_CANONICAL_APPLICATIONS_UNAVAILABLE'},503,setCookies);
  }
}
