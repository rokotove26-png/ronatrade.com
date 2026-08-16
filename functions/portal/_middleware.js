const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const CONTROL=`${SUPABASE_URL}/functions/v1/rona-owner-bootstrap-control-20260816`;
const ACCESS_COOKIE='rona_portal_at';
const OPEN_PATHS=new Set(['/portal/auth/login','/portal/auth/logout','/portal/auth/password-reset','/portal/password-reset','/portal/auth/recovery','/portal/auth/recovery-otp','/portal/recovery']);
const SECURITY={'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY'};
function parseCookies(header){const out={};for(const part of String(header||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}return out;}
function redirect(location){return new Response(null,{status:303,headers:{...SECURITY,location}})}
function blocked(path){if(path.startsWith('/portal/api/'))return new Response(JSON.stringify({ok:false,code:'PASSWORD_CHANGE_REQUIRED'}),{status:403,headers:{...SECURITY,'content-type':'application/json; charset=utf-8'}});return redirect('/portal/password-reset');}
function unavailable(path){if(path.startsWith('/portal/api/'))return new Response(JSON.stringify({ok:false,code:'PASSWORD_GATE_UNAVAILABLE'}),{status:503,headers:{...SECURITY,'content-type':'application/json; charset=utf-8'}});return new Response('<!doctype html><meta charset="utf-8"><title>RONA Trade</title><h1>Сервис входа временно недоступен</h1><p>Повторите попытку позже.</p>',{status:503,headers:{...SECURITY,'content-type':'text/html; charset=utf-8'}});}
async function state(token){try{const r=await fetch(CONTROL,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});if(r.status===401||r.status===403)return {auth:false};if(!r.ok)return null;const j=await r.json().catch(()=>null);return j?.ok?{auth:true,must:Boolean(j.must_change_password)}:null}catch{return null}}
export async function onRequest(context){
  const {request}=context;const path=new URL(request.url).pathname;if(!path.startsWith('/portal'))return context.next();
  if(OPEN_PATHS.has(path))return context.next();
  const token=parseCookies(request.headers.get('cookie'))[ACCESS_COOKIE]||'';if(!token)return context.next();
  const s=await state(token);if(!s)return unavailable(path);if(!s.auth)return context.next();if(s.must)return blocked(path);return context.next();
}
