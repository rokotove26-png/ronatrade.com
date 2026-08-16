const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ID='c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL='office_kg@ronaoil.com';
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const RESET_COOKIE='rona_pwreset';
const SECURITY_HEADERS=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function sameOrigin(request){
 const u=new URL(request.url);const o=request.headers.get('origin');
 if(o)return o===u.origin;
 const r=request.headers.get('referer');
 if(r){try{return new URL(r).origin===u.origin}catch{return false}}
 return String(request.headers.get('sec-fetch-site')||'').toLowerCase()==='same-origin';
}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token){return `${REFRESH_COOKIE}=${token}; Max-Age=604800; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function resetCookie(){return `${RESET_COOKIE}=1; Max-Age=900; Path=/portal; Secure; HttpOnly; SameSite=Strict`}
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${RESET_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Strict`]}
function redirect(location,cookies=[]){const h=new Headers(SECURITY_HEADERS);h.set('location',location);for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:303,headers:h})}
async function logout(token){if(!token)return;try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`}})}catch(_){}}
function normalizeOtp(value){return String(value||'').replace(/[^0-9]/g,'').slice(0,16)}
export async function onRequestPost({request}){
 if(!sameOrigin(request))return redirect('/portal/recovery?error=origin',clearCookies());
 const ct=String(request.headers.get('content-type')||'').toLowerCase();let raw='';
 try{
  if(ct.includes('application/x-www-form-urlencoded')||ct.includes('multipart/form-data')){const f=await request.formData();raw=String(f.get('otp')||'')}
  else if(ct.includes('application/json')){const b=await request.json().catch(()=>({}));raw=String(b.otp||'')}
  else return redirect('/portal/recovery?error=format',clearCookies());
 }catch{return redirect('/portal/recovery?error=format',clearCookies())}
 const otp=normalizeOtp(raw);
 if(!/^\d{6,10}$/.test(otp))return redirect('/portal/recovery?error=format',clearCookies());
 let r;
 try{r=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({type:'recovery',email:OWNER_EMAIL,token:otp})})}
 catch{return redirect('/portal/recovery?error=service',clearCookies())}
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data?.access_token||!data?.refresh_token||String(data?.user?.id||'')!==OWNER_ID||String(data?.user?.email||'').toLowerCase()!==OWNER_EMAIL){if(data?.access_token)await logout(data.access_token);return redirect('/portal/recovery?error=verify',clearCookies())}
 const expires=Math.min(Math.max(Number(data.expires_in||3600),60),7200);
 return redirect('/portal/password-reset',[accessCookie(data.access_token,expires),refreshCookie(data.refresh_token),resetCookie()]);
}
export function onRequestGet(){return new Response(null,{status:405,headers:SECURITY_HEADERS});}
