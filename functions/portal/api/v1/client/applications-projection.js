const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const SECURITY_HEADERS=Object.freeze({'cache-control':'no-store, no-cache, must-revalidate, max-age=0','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'});
function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();if(k)out[k]=v}return out}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearCookies(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function tokenCookies(t){const e=Math.min(Math.max(Number(t?.expires_in||3600),60),7200);return[accessCookie(t.access_token,e),refreshCookie(t.refresh_token,604800)]}
function secureHeaders(base=new Headers()){const h=new Headers(base);for(const[k,v]of Object.entries(SECURITY_HEADERS))h.set(k,v);h.delete('access-control-allow-origin');h.delete('access-control-allow-credentials');h.delete('content-length');h.delete('etag');return h}
function json(body,status=200,cookies=[]){const h=secureHeaders(new Headers({'content-type':'application/json; charset=utf-8'}));for(const c of cookies)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function sameOrigin(request){const u=new URL(request.url),origin=request.headers.get('origin');if(origin)return origin===u.origin;const ref=request.headers.get('referer');if(!ref)return request.method==='GET';try{return new URL(ref).origin===u.origin}catch{return false}}
async function authRefresh(refreshToken){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const data=await r.json().catch(()=>({}));return{ok:r.ok,data}}
function safeApplication(a){return{application_id:a?.application_id??null,product:a?.product??null,quantity_tonnes:a?.quantity_tonnes??null,delivery_period_from:a?.delivery_period_from??null,delivery_period_to:a?.delivery_period_to??null,delivery_basis:a?.delivery_basis??null,destination:a?.destination??null,payment_terms:a?.payment_terms??null,application_price:a?.application_price??null,application_currency:a?.application_currency??null,status:a?.status??null,resource_status:a?.resource_status??'RESOURCE_NOT_CONFIRMED',resource_label:a?.resource_label??null,resource_source:a?.resource_source??null,deal_id:a?.deal_id??null,submitted_at:a?.submitted_at??null,updated_at:a?.updated_at??null}}
export async function onRequestGet(context){
  const request=context.request;
  if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403);
  const url=new URL(request.url),clientId=String(url.searchParams.get('clientId')||'').trim(),contractId=String(url.searchParams.get('contractId')||'').trim();
  if(!clientId||!contractId)return json({ok:false,code:'CLIENT_CONTRACT_CONTEXT_REQUIRED'},400);
  const cookies=parseCookies(request.headers.get('cookie'));
  let access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'',setCookies=[];
  if(!access&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data)}}
  if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());
  const call=token=>fetch(`${SUPABASE_URL}/rest/v1/rpc/rona_client_application_projection`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({p_client_id:clientId,p_contract_id:contractId})});
  let response=await call(access);
  if(response.status===401&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;setCookies=tokenCookies(next.data);response=await call(access)}}
  if(!response.ok){const code=response.status===401?'PORTAL_ACCESS_DENIED':'APPLICATION_PROJECTION_UNAVAILABLE';return json({ok:false,code},response.status===401?401:502,response.status===401?clearCookies():setCookies)}
  const rows=await response.json().catch(()=>null);
  if(!Array.isArray(rows))return json({ok:false,code:'APPLICATION_PROJECTION_INVALID'},502,setCookies);
  return json({ok:true,projection_contract:'CLIENT_APPLICATIONS_AUTHORITATIVE_V1',applications:rows.map(safeApplication)},200,setCookies);
}
