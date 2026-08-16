const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API=`${SUPABASE_URL}/functions/v1/rona-portal-api`;
const CONTROL=`${SUPABASE_URL}/functions/v1/rona-owner-bootstrap-control-20260816`;
const OWNER_ID='c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL='office_kg@ronaoil.com';
const ACCESS_COOKIE='rona_portal_at',REFRESH_COOKIE='rona_portal_rt',RESET_COOKIE='rona_pwreset';
const SECURITY=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function parseCookies(header){const out={};for(const part of String(header||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}return out;}
function sameOrigin(request){const u=new URL(request.url);const o=request.headers.get('origin');if(o)return o===u.origin;const r=request.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token){return `${REFRESH_COOKIE}=${token}; Max-Age=604800; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearReset(){return `${RESET_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Strict`}
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,clearReset()]}
function tokenCookies(tokens){const expires=Math.min(Math.max(Number(tokens?.expires_in||3600),60),7200);return [accessCookie(tokens.access_token,expires),refreshCookie(tokens.refresh_token),clearReset()]}
function redirect(location,cookies=[]){const h=new Headers(SECURITY);h.set('location',location);for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:303,headers:h})}
function denied(code,status=400){const h=new Headers(SECURITY);h.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify({ok:false,code}),{status,headers:h})}
function strong(p){return p.length>=14&&p.length<=72&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p)}
async function currentUser(token){if(!token)return null;try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,accept:'application/json'}});if(!r.ok)return null;return await r.json()}catch{return null}}
async function changePassword(token,password){try{const r=await fetch(CONTROL,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({action:'recovery_change_password',password})});const j=await r.json().catch(()=>({}));return{ok:r.ok,data:j}}catch{return{ok:false,data:{code:'PASSWORD_GATE_UNAVAILABLE'}}}}
async function logout(token){if(!token)return;try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`}})}catch(_){}}
async function authPassword(password){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({email:OWNER_EMAIL,password})});return{ok:r.ok,data:await r.json().catch(()=>({}))}}
async function sessionMe(token){try{const r=await fetch(`${PORTAL_API}/session/me`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});if(!r.ok)return null;const j=await r.json();return j?.ok&&j?.user?j:null}catch{return null}}
function target(roles){const r=Array.isArray(roles)?roles.map(String):[];const out=[];if(r.includes('ADMIN'))out.push('/portal/admin');if(r.includes('RONA_OPERATOR'))out.push('/portal/staff');if(r.includes('AGENT'))out.push('/portal/agent');if(r.includes('CLIENT'))out.push('/portal/client');return out.length>1?'/portal/select':out[0]||null}
export async function onRequestPost({request}){
 if(!sameOrigin(request))return denied('ORIGIN_DENIED',403);
 const c=parseCookies(request.headers.get('cookie'));
 if(c[RESET_COOKIE]!=='1'||!c[ACCESS_COOKIE])return denied('PASSWORD_CHANGE_SESSION_REQUIRED',403);
 const user=await currentUser(c[ACCESS_COOKIE]);
 if(!user||String(user.id||'')!==OWNER_ID||String(user.email||'').toLowerCase()!==OWNER_EMAIL)return denied('OWNER_PASSWORD_CHANGE_MISMATCH',403);
 const form=await request.formData().catch(()=>null);if(!form)return denied('FORM_REQUIRED');
 const p=String(form.get('password')||''),q=String(form.get('confirm')||'');
 if(p!==q||!strong(p))return denied('PASSWORD_POLICY_FAILED');
 const changed=await changePassword(c[ACCESS_COOKIE],p);
 if(!changed.ok)return denied(String(changed.data?.code||'PASSWORD_UPDATE_FAILED'),changed.data?.code==='PASSWORD_POLICY_FAILED'?400:500);
 await logout(c[ACCESS_COOKIE]);
 const login=await authPassword(p);
 if(!login.ok||!login.data?.access_token||!login.data?.refresh_token)return redirect('/portal/login?passwordChanged=1',clearCookies());
 const me=await sessionMe(login.data.access_token);
 if(!me){await logout(login.data.access_token);return redirect('/portal/login?passwordChanged=1',clearCookies());}
 const next=target(me.user.roles);
 if(!next){await logout(login.data.access_token);return redirect('/portal/login?passwordChanged=1',clearCookies());}
 return redirect(next,tokenCookies(login.data));
}
