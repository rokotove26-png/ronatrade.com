const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ID='c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL='office_kg@ronaoil.com';
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const RESET_COOKIE='rona_pwreset';
const SECURITY=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function sameOrigin(request){const u=new URL(request.url);const o=request.headers.get('origin');if(o)return o===u.origin;const r=request.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}}
function accessCookie(token,maxAge=900){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=900){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function resetCookie(maxAge=900){return `${RESET_COOKIE}=1; Max-Age=${maxAge}; Path=/portal; Secure; HttpOnly; SameSite=Strict`}
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${RESET_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Strict`]}
function json(body,status=200,cookies=[]){const h=new Headers({...SECURITY,'content-type':'application/json; charset=utf-8'});for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
async function user(access){try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${access}`,accept:'application/json'}});if(!r.ok)return null;return await r.json()}catch{return null}}
async function refresh(rt){try{const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({refresh_token:rt})});return {ok:r.ok,data:await r.json().catch(()=>({}))}}catch{return {ok:false,data:{}}}}
async function logout(access){if(!access)return;try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${access}`}})}catch(_){}}
export async function onRequestPost({request}){
 if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403,clearCookies());
 const ct=request.headers.get('content-type')||'';if(!ct.includes('application/json'))return json({ok:false,code:'JSON_REQUIRED'},400,clearCookies());
 const body=await request.json().catch(()=>({}));let access=String(body.access_token||''),rt=String(body.refresh_token||'');
 if(!access||!rt||access.length>10000||rt.length>10000)return json({ok:false,code:'RECOVERY_TOKENS_REQUIRED'},400,clearCookies());
 let u=await user(access);
 if(!u){const rr=await refresh(rt);if(!rr.ok||!rr.data?.access_token||!rr.data?.refresh_token)return json({ok:false,code:'RECOVERY_SESSION_INVALID'},401,clearCookies());access=String(rr.data.access_token);rt=String(rr.data.refresh_token);u=await user(access)}
 if(!u||String(u.id||'')!==OWNER_ID||String(u.email||'').toLowerCase()!==OWNER_EMAIL){await logout(access);return json({ok:false,code:'OWNER_RECOVERY_MISMATCH'},403,clearCookies())}
 return json({ok:true,redirect:'/portal/password-reset'},200,[accessCookie(access,900),refreshCookie(rt,900),resetCookie(900)]);
}
export function onRequestGet(){return json({ok:false,code:'METHOD_NOT_ALLOWED'},405)}
