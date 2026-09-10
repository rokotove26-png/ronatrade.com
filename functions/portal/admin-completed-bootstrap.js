import { mergeAdminCompletedApplications } from './main-ui/admin-completed-applications.js';

const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ACCEPTANCE=`${SUPABASE_URL}/functions/v1/rona-owner-acceptance`;
const RPC=`${SUPABASE_URL}/rest/v1/rpc`;
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';

function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function tokenCookies(tokens){const expires=Math.min(Math.max(Number(tokens?.expires_in||3600),60),7200);return[accessCookie(tokens.access_token,expires),refreshCookie(tokens.refresh_token,604800)]}
function responseHeaders(base=new Headers()){const h=new Headers(base);h.set('cache-control','no-store, no-cache, must-revalidate');h.set('pragma','no-cache');h.set('x-content-type-options','nosniff');h.delete('content-length');h.delete('etag');return h}
function json(body,status=200,cookies=[],extra={}){const h=responseHeaders(new Headers({'content-type':'application/json; charset=utf-8'}));for(const [k,v] of Object.entries(extra))h.set(k,String(v));for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});return{ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))}}
async function baseBootstrap(token){return fetch(`${OWNER_ACCEPTANCE}/admin/bootstrap`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}})}
async function workflowBootstrap(token){return fetch(`${RPC}/owner_r1_admin_bootstrap`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:'{}'})}
async function readJson(response){return response.json().catch(()=>null)}
async function readPair(token){let base=await baseBootstrap(token),workflow=await workflowBootstrap(token);return{base,workflow}}

export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401);

  let pair=await readPair(access);
  if((pair.base.status===401||pair.workflow.status===401)&&refresh){
    const next=await authRefresh(refresh);
    if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;setCookies=tokenCookies(next.data);pair=await readPair(access)}
  }
  if(!pair.base.ok){const body=await readJson(pair.base);return json(body&&typeof body==='object'?body:{ok:false,code:`ADMIN_BOOTSTRAP_${pair.base.status}`},pair.base.status,setCookies)}
  if(!pair.workflow.ok){const body=await readJson(pair.workflow);return json({ok:false,code:String(body?.message||body?.code||`WORKFLOW_BOOTSTRAP_${pair.workflow.status}`)},pair.workflow.status,setCookies)}

  const basePayload=await readJson(pair.base),workflowData=await readJson(pair.workflow);
  if(!basePayload||typeof basePayload!=='object'||!basePayload.data||!workflowData||typeof workflowData!=='object')return json({ok:false,code:'ADMIN_COMPLETED_PROJECTION_INVALID'},502,setCookies);
  const before=Array.isArray(basePayload.data.applications)?basePayload.data.applications.length:0;
  const merged=mergeAdminCompletedApplications(basePayload.data,workflowData);
  const after=Array.isArray(merged?.applications)?merged.applications.length:0;
  const completed=Math.max(0,after-before);
  basePayload.data=merged;
  return json(basePayload,200,setCookies,{
    'x-rona-admin-completed-applications':'owner-r1-server-v2',
    'x-rona-admin-completed-restored':completed
  });
}
