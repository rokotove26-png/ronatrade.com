import { mergeAdminCompletedApplications } from './main-ui/admin-completed-applications.js';
import { mergeAdminDurableIntakeApplications } from './main-ui/admin-durable-intake-applications.js';

const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ACCEPTANCE=`${SUPABASE_URL}/functions/v1/rona-owner-acceptance`;
const PORTAL_API=`${SUPABASE_URL}/functions/v1/rona-portal-api`;
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
async function intakeBootstrap(token){return fetch(`${PORTAL_API}/v1/admin/bootstrap`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}})}
async function workflowBootstrap(token){return fetch(`${RPC}/owner_r1_admin_bootstrap`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:'{}'})}
async function readJson(response){return response.json().catch(()=>null)}
async function readSet(token){const [base,intake,workflow]=await Promise.all([baseBootstrap(token),intakeBootstrap(token),workflowBootstrap(token)]);return{base,intake,workflow}}

export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401);

  let set=await readSet(access);
  if((set.base.status===401||set.intake.status===401||set.workflow.status===401)&&refresh){
    const next=await authRefresh(refresh);
    if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;setCookies=tokenCookies(next.data);set=await readSet(access)}
  }
  if(!set.base.ok){const body=await readJson(set.base);return json(body&&typeof body==='object'?body:{ok:false,code:`ADMIN_BOOTSTRAP_${set.base.status}`},set.base.status,setCookies)}
  if(!set.intake.ok){const body=await readJson(set.intake);return json({ok:false,code:String(body?.code||body?.message||`ADMIN_INTAKE_BOOTSTRAP_${set.intake.status}`)},set.intake.status,setCookies)}
  if(!set.workflow.ok){const body=await readJson(set.workflow);return json({ok:false,code:String(body?.message||body?.code||`WORKFLOW_BOOTSTRAP_${set.workflow.status}`)},set.workflow.status,setCookies)}

  const basePayload=await readJson(set.base),intakePayload=await readJson(set.intake),workflowData=await readJson(set.workflow);
  if(!basePayload||typeof basePayload!=='object'||!basePayload.data||!intakePayload||typeof intakePayload!=='object'||!intakePayload.data||!workflowData||typeof workflowData!=='object')return json({ok:false,code:'ADMIN_COMPLETED_PROJECTION_INVALID'},502,setCookies);

  const intakeMerge=mergeAdminDurableIntakeApplications(basePayload.data,intakePayload.data);
  const before=Array.isArray(intakeMerge.data.applications)?intakeMerge.data.applications.length:0;
  const merged=mergeAdminCompletedApplications(intakeMerge.data,workflowData);
  const after=Array.isArray(merged?.applications)?merged.applications.length:0;
  const completed=Math.max(0,after-before);
  basePayload.data=merged;
  return json(basePayload,200,setCookies,{
    'x-rona-admin-durable-intake':'client-intake-v1',
    'x-rona-admin-intake-restored':intakeMerge.restored,
    'x-rona-admin-intake-updated':intakeMerge.updated,
    'x-rona-admin-completed-applications':'owner-r1-server-v2',
    'x-rona-admin-completed-restored':completed
  });
}
