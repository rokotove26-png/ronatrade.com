const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const MAIN_CONTEXT_API=`${SUPABASE_URL}/functions/v1/rona-portal-api/v1/client/context`;
const PR429_PREVIEW_CONTEXT_API=`${SUPABASE_URL}/functions/v1/rona-portal-api-candidate-20260817/v1/client/context`;
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';

function parseCookies(header){
  const out={};
  for(const item of String(header||'').split(';')){
    const i=item.indexOf('=');
    if(i<1)continue;
    const key=item.slice(0,i).trim(),value=item.slice(i+1).trim();
    if(key)out[key]=value;
  }
  return out;
}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearCookies(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function tokenCookies(tokens){const expires=Math.min(Math.max(Number(tokens?.expires_in||3600),60),7200);return[accessCookie(tokens.access_token,expires),refreshCookie(tokens.refresh_token,604800)]}
function secured(response,cookies=[],preview=false){
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('referrer-policy','no-referrer');
  headers.set('x-content-type-options','nosniff');
  headers.set('x-frame-options','DENY');
  headers.delete('content-length');
  headers.delete('etag');
  headers.delete('access-control-allow-origin');
  headers.delete('access-control-allow-credentials');
  headers.set('x-rona-client-context-backend',preview?'PR429_EXISTING_CANDIDATE_SLOT':'PRODUCTION_SHARED');
  for(const cookie of cookies)headers.append('set-cookie',cookie);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
async function authRefresh(refreshToken){
  const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});
  const data=await r.json().catch(()=>({}));
  return{ok:r.ok,status:r.status,data};
}
async function callContext(target,accessToken,request){
  const source=new URL(request.url),url=new URL(target);
  url.search=source.search;
  const headers=new Headers({authorization:`Bearer ${accessToken}`,accept:'application/json'});
  for(const name of ['x-request-id','x-correlation-id']){const value=request.headers.get(name);if(value)headers.set(name,value)}
  return fetch(url,{method:'GET',headers});
}
function isPr429Preview(request){
  const host=new URL(request.url).hostname.toLowerCase();
  return host.endsWith('.rona-trade-public.pages.dev');
}

export async function onRequest(context){
  const {request}=context;
  if(request.method!=='GET')return secured(new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:{'content-type':'application/json; charset=utf-8'}}));
  const preview=isPr429Preview(request),target=preview?PR429_PREVIEW_CONTEXT_API:MAIN_CONTEXT_API;
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){
    const next=await authRefresh(refresh).catch(()=>null);
    if(next?.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}
    else if(next&&next.status!==429&&Number(next.status||0)<500)return secured(new Response(JSON.stringify({ok:false,code:'PORTAL_ACCESS_DENIED'}),{status:401,headers:{'content-type':'application/json; charset=utf-8'}}),clearCookies(),preview);
  }
  if(!access)return secured(new Response(JSON.stringify({ok:false,code:'PORTAL_ACCESS_DENIED'}),{status:401,headers:{'content-type':'application/json; charset=utf-8'}}),[],preview);
  let response=await callContext(target,access,request);
  if(response.status===401&&refresh){
    const next=await authRefresh(refresh).catch(()=>null);
    if(next?.ok&&next.data?.access_token&&next.data?.refresh_token){
      access=next.data.access_token;setCookies=tokenCookies(next.data);response=await callContext(target,access,request);
    }else if(next&&next.status!==429&&Number(next.status||0)<500)setCookies=clearCookies();
  }
  return secured(response,setCookies,preview);
}
