const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ID = 'c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL = 'office_kg@ronaoil.com';
const ACCESS_COOKIE = 'rona_portal_at';
const REFRESH_COOKIE = 'rona_portal_rt';
const RESET_COOKIE = 'rona_pwreset';
const SECURITY_HEADERS = Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`;}
function refreshCookie(token){return `${REFRESH_COOKIE}=${token}; Max-Age=604800; Path=/portal; Secure; HttpOnly; SameSite=Lax`;}
function resetCookie(){return `${RESET_COOKIE}=1; Max-Age=900; Path=/portal; Secure; HttpOnly; SameSite=Strict`;}
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${RESET_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Strict`];}
function reply(status,location,cookies=[]){const h=new Headers(SECURITY_HEADERS);h.set('location',location);for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status,headers:h});}
async function logout(token){if(!token)return;try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`}})}catch(_){}}
export async function onRequestGet({request}){
  const url=new URL(request.url);const tokenHash=String(url.searchParams.get('token_hash')||'');const type=String(url.searchParams.get('type')||'');
  if(type!=='recovery'||tokenHash.length<20||tokenHash.length>2048)return reply(303,'/portal/login?recovery=invalid',clearCookies());
  const r=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({type:'recovery',token_hash:tokenHash})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data?.access_token||!data?.refresh_token||String(data?.user?.id||'')!==OWNER_ID||String(data?.user?.email||'').toLowerCase()!==OWNER_EMAIL){if(data?.access_token)await logout(data.access_token);return reply(303,'/portal/login?recovery=invalid',clearCookies());}
  const expires=Math.min(Math.max(Number(data.expires_in||3600),60),7200);
  return reply(303,'/portal/password-reset',[accessCookie(data.access_token,expires),refreshCookie(data.refresh_token),resetCookie()]);
}
