const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const EXPECTED_ISS='https://sxawrwzeobaqwwmlkzws.supabase.co/auth/v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sameOrigin(request){
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(origin&&origin!=='null')return origin===url.origin;
  const ref=request.headers.get('referer');
  if(!ref)return false;
  try{return new URL(ref).origin===url.origin}catch{return false}
}
function decodePayload(token){
  try{
    const parts=String(token||'').split('.');
    if(parts.length!==3)return null;
    const raw=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const json=atob(raw+'='.repeat((4-raw.length%4)%4));
    return JSON.parse(json);
  }catch{return null}
}
function response(body,status=200,cookies=[]){
  const headers=new Headers({
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff'
  });
  for(const cookie of cookies)headers.append('set-cookie',cookie);
  return new Response(JSON.stringify(body),{status,headers});
}
function cookies(access,refresh,expiresIn){
  const maxAge=Math.min(Math.max(Number(expiresIn||3600),60),7200);
  return[
    `${ACCESS_COOKIE}=${access}; Max-Age=${maxAge}; Path=/portal; Secure; HttpOnly; SameSite=Lax`,
    `${REFRESH_COOKIE}=${refresh}; Max-Age=604800; Path=/portal; Secure; HttpOnly; SameSite=Lax`
  ];
}

export async function onRequestPost({request}){
  if(!sameOrigin(request))return response({ok:false,code:'ORIGIN_DENIED'},403);
  const body=await request.json().catch(()=>null);
  const access=String(body?.access_token||''),refresh=String(body?.refresh_token||'');
  if(access.length<100||access.length>12000||refresh.length<20||refresh.length>12000)return response({ok:false,code:'HANDOFF_TOKEN_INVALID'},400);
  const claims=decodePayload(access),now=Math.floor(Date.now()/1000);
  const aud=Array.isArray(claims?.aud)?claims.aud.map(String):[String(claims?.aud||'')];
  if(!claims||String(claims.iss||'')!==EXPECTED_ISS||!aud.includes('authenticated')||String(claims.role||'')!=='authenticated'||!UUID.test(String(claims.sub||''))||!UUID.test(String(claims.session_id||''))||Number(claims.exp||0)<=now){
    return response({ok:false,code:'HANDOFF_CLAIMS_INVALID'},400);
  }
  // This endpoint is not an authorization boundary. It only moves a browser-obtained
  // Supabase session into HttpOnly same-origin cookies. Protected portal routes still
  // validate the access token and canonical portal role before serving protected UI.
  return response({ok:true,mode:'BROWSER_AUTH_HTTPONLY_HANDOFF_V1'},200,cookies(access,refresh,body?.expires_in));
}
export function onRequestGet(){return response({ok:false,code:'METHOD_NOT_ALLOWED'},405)}
