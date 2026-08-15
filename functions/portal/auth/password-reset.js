const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ID='c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL='office_kg@ronaoil.com';
const ACCESS_COOKIE='rona_portal_at',REFRESH_COOKIE='rona_portal_rt',RESET_COOKIE='rona_pwreset';
const SECURITY=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function parseCookies(header){const out={};for(const part of String(header||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}return out;}
function sameOrigin(request){const u=new URL(request.url);const o=request.headers.get('origin');if(o)return o===u.origin;const r=request.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}}
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${RESET_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Strict`];}
function redirect(location,cookies=[]){const h=new Headers(SECURITY);h.set('location',location);for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:303,headers:h});}
function denied(code,status=400){const h=new Headers(SECURITY);h.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify({ok:false,code}),{status,headers:h});}
async function currentUser(token){if(!token)return null;try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,accept:'application/json'}});if(!r.ok)return null;return await r.json()}catch{return null}}
async function logout(token){if(!token)return;try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`}})}catch(_){}}
function strong(p){return p.length>=14&&p.length<=72&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p)}
export async function onRequestPost({request}){
  if(!sameOrigin(request))return denied('ORIGIN_DENIED',403);
  const c=parseCookies(request.headers.get('cookie'));
  if(c[RESET_COOKIE]!=='1'||!c[ACCESS_COOKIE])return denied('RECOVERY_SESSION_REQUIRED',403);
  const user=await currentUser(c[ACCESS_COOKIE]);
  if(!user||String(user.id||'')!==OWNER_ID||String(user.email||'').toLowerCase()!==OWNER_EMAIL)return denied('OWNER_RECOVERY_MISMATCH',403);
  const form=await request.formData().catch(()=>null);if(!form)return denied('FORM_REQUIRED');
  const p=String(form.get('password')||''),q=String(form.get('confirm')||'');
  if(p!==q||!strong(p))return denied('PASSWORD_POLICY_FAILED');
  const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{method:'PUT',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${c[ACCESS_COOKIE]}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({password:p})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||String(data?.id||'')!==OWNER_ID||String(data?.email||'').toLowerCase()!==OWNER_EMAIL)return denied('PASSWORD_UPDATE_FAILED',500);
  await logout(c[ACCESS_COOKIE]);
  return redirect('/portal/login?passwordReset=1',clearCookies());
}
