const UPSTREAM='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-mcp-oauth-token';
const SEGMENTS=new Set(['operations','finance','legal','market-analyst','rail-logistics','system-admin']);
const ALLOWED_ORIGINS=new Set([
  'https://chatgpt.com','https://chat.openai.com','https://openai.com','https://platform.openai.com',
  'https://ronaoil.com','https://www.ronaoil.com'
]);
const CODE_VERIFIER_RE=/^[A-Za-z0-9\-._~]{43,128}$/;
const TOKEN_FIELDS=new Set(['grant_type','client_id','code','redirect_uri','code_verifier','resource','scope','refresh_token']);
const MAX_TOKEN_BYTES=32768;
const MAX_REVOKE_BYTES=16384;
const TIMEOUT_MS=15000;

function json(body,status=200,request=null){return new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache',
  'referrer-policy':'no-referrer','x-content-type-options':'nosniff',...(request?cors(request):{}),
}});}
function cors(request){const o=request.headers.get('origin');if(!o||!ALLOWED_ORIGINS.has(o))return{};return{
  'access-control-allow-origin':o,'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'content-type, accept, x-request-id, x-correlation-id','access-control-max-age':'600','vary':'Origin',
};}
function isForm(value){return String(value||'').toLowerCase().split(';',1)[0].trim()==='application/x-www-form-urlencoded';}
async function readLimited(request,max){const len=request.headers.get('content-length');if(len&&Number(len)>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});const raw=await request.arrayBuffer();if(raw.byteLength>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});return raw;}
function tokenFormValid(raw){
  const form=new URLSearchParams(new TextDecoder().decode(raw));
  for(const key of form.keys())if(!TOKEN_FIELDS.has(key))return false;
  for(const key of TOKEN_FIELDS)if(form.getAll(key).length>1)return false;
  const grant=form.get('grant_type')||'',client=form.get('client_id')||'';
  if(!client||!['authorization_code','refresh_token'].includes(grant))return false;
  if(grant==='authorization_code'&&(!form.get('code')||!form.get('redirect_uri')||!CODE_VERIFIER_RE.test(form.get('code_verifier')||'')))return false;
  if(grant==='refresh_token'&&!form.get('refresh_token'))return false;
  return true;
}
function safeTokenShape(raw){try{const f=new URLSearchParams(new TextDecoder().decode(raw)),c=String(f.get('client_id')||'');return{
  grant_type:String(f.get('grant_type')||''),client_suffix:c?c.slice(-12):'',resource_present:Boolean(f.get('resource')),
  scope_present:Boolean(f.get('scope')),refresh_token_present:Boolean(f.get('refresh_token')),
};}catch{return{grant_type:'',client_suffix:'',resource_present:false,scope_present:false,refresh_token_present:false};}}
function responseHeaders(upstream,request){const h=new Headers();const ct=upstream.headers.get('content-type');if(ct)h.set('content-type',ct);h.set('cache-control','no-store, no-cache, must-revalidate');h.set('pragma','no-cache');h.set('referrer-policy','no-referrer');h.set('x-content-type-options','nosniff');for(const[k,v]of Object.entries(cors(request)))h.set(k,v);return h;}

export async function proxyOAuthTokenIfApplicable(context,segment){
  if(!SEGMENTS.has(segment))return json({error:'ROLE_ROUTE_NOT_FOUND'},404,context.request);
  const request=context.request,pathname=new URL(request.url).pathname,prefix=`/${segment}`;
  if(!pathname.startsWith(prefix))return null;
  const path=pathname.slice(prefix.length)||'/';
  if(!['/token','/revoke'].includes(path))return null;
  const origin=request.headers.get('origin');
  if(request.method==='OPTIONS'){
    if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:'ORIGIN_DENIED'},403,request);
    return new Response(null,{status:204,headers:{'cache-control':'no-store',...cors(request)}});
  }
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405,request);
  if(origin&&origin!=='null'&&!ALLOWED_ORIGINS.has(origin))return json({error:'ORIGIN_DENIED'},403,request);
  if(path==='/revoke'&&origin==='null')return json({error:'ORIGIN_DENIED'},403,request);
  if(!isForm(request.headers.get('content-type')))return json({error:'INVALID_OAUTH_CONTENT_TYPE'},415,request);
  let raw;try{raw=await readLimited(request,path==='/token'?MAX_TOKEN_BYTES:MAX_REVOKE_BYTES);}catch(e){return json({error:String(e?.message||'REQUEST_TOO_LARGE')},Number(e?.status||413),request);}
  if(path==='/token'&&origin==='null'&&!tokenFormValid(raw))return json({error:'ORIGIN_DENIED'},403,request);
  const shape=path==='/token'?safeTokenShape(raw):null;
  if(path==='/token')console.log(JSON.stringify({event:'RONA_OAUTH_PUBLIC_TOKEN_V2_RECEIVED',segment,opaque_origin:origin==='null',...shape}));
  const headers=new Headers();
  headers.set('content-type','application/x-www-form-urlencoded');
  headers.set('accept','application/json');
  const requestId=request.headers.get('x-request-id');if(requestId)headers.set('x-request-id',requestId);
  const correlation=request.headers.get('x-correlation-id');if(correlation)headers.set('x-correlation-id',correlation);
  if(origin)headers.set('origin',origin==='null'?'https://ronaoil.com':origin);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
  try{
    const upstream=await fetch(`${UPSTREAM}/${segment}${path}`,{method:'POST',headers,body:raw,redirect:'manual',signal:ctrl.signal});
    if(path==='/token')console.log(JSON.stringify({event:'RONA_OAUTH_PUBLIC_TOKEN_V2_RESULT',segment,status:upstream.status,...shape}));
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders(upstream,request)});
  }catch(e){return json({error:e?.name==='AbortError'?'UPSTREAM_TIMEOUT':'UPSTREAM_UNAVAILABLE'},e?.name==='AbortError'?504:502,request);}finally{clearTimeout(timer);}
}
