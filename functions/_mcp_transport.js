const PUBLIC_ORIGIN='https://ronaoil.com';
const UPSTREAM_ORIGIN='https://sxawrwzeobaqwwmlkzws.supabase.co';
const UPSTREAM_BASE=`${UPSTREAM_ORIGIN}/functions/v1/rona-mcp-gateway`;
const SEGMENTS=new Set(['operations','finance','legal','market-analyst','rail-logistics','system-admin']);
const ALLOWED_ORIGINS=new Set([
  'https://chatgpt.com','https://chat.openai.com','https://openai.com','https://platform.openai.com',
  'https://ronaoil.com','https://www.ronaoil.com'
]);
const MAX_REQUEST_BYTES=131072;
const UPSTREAM_TIMEOUT_MS=15000;

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff',
    ...headers,
  }});
}
function externalBase(segment){return `${PUBLIC_ORIGIN}/${segment}`;}
function externalResource(segment){return `${externalBase(segment)}/mcp`;}
function internalResource(segment){return `${UPSTREAM_BASE}/${segment}/mcp`;}
function protectedMetadataUrl(segment){return `${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/${segment}/mcp`;}
function authMetadataUrl(segment){return `${PUBLIC_ORIGIN}/.well-known/oauth-authorization-server/${segment}`;}
function isAllowedOrigin(origin){return !origin||ALLOWED_ORIGINS.has(origin);}
function corsFor(request){
  const origin=request.headers.get('origin');
  if(!origin||!ALLOWED_ORIGINS.has(origin))return {};
  return {
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-allow-headers':'authorization, content-type, accept, mcp-protocol-version, x-request-id, x-correlation-id',
    'access-control-max-age':'600',
    'vary':'Origin',
  };
}
function preflight(request){
  const origin=request.headers.get('origin');
  if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:'ORIGIN_DENIED'},403);
  return new Response(null,{status:204,headers:{'cache-control':'no-store',...corsFor(request)}});
}
async function readBodyLimited(request){
  const len=request.headers.get('content-length');
  if(len&&Number(len)>MAX_REQUEST_BYTES)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  const body=await request.arrayBuffer();
  if(body.byteLength>MAX_REQUEST_BYTES)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  return body;
}
function safeForwardHeaders(request){
  const out=new Headers();
  for(const name of ['authorization','accept','content-type','origin','mcp-protocol-version','x-request-id','x-correlation-id']){
    const value=request.headers.get(name);if(value)out.set(name,value);
  }
  out.set('accept-encoding','identity');
  return out;
}
function normalizeSegment(segment){
  if(!SEGMENTS.has(segment))throw Object.assign(new Error('ROLE_ROUTE_NOT_FOUND'),{status:404});
  return segment;
}
function allowedRolePath(path){return ['/mcp','/authorize','/token','/register','/revoke'].includes(path);}
function rewriteAuthorizeUrl(requestUrl,segment){
  const incoming=new URL(requestUrl);
  const upstream=new URL(`${UPSTREAM_BASE}/${segment}/authorize`);
  for(const [k,v] of incoming.searchParams.entries())upstream.searchParams.append(k,v);
  if(upstream.searchParams.get('resource')===externalResource(segment))upstream.searchParams.set('resource',internalResource(segment));
  return upstream;
}
function upstreamUrl(segment,path,requestUrl){
  if(path==='/authorize'&&new URL(requestUrl).search)return rewriteAuthorizeUrl(requestUrl,segment);
  return new URL(`${UPSTREAM_BASE}/${segment}${path}`);
}
async function rewriteFormBody(buffer,contentType,segment,path){
  if(path!=='/token')return buffer;
  if(!String(contentType||'').toLowerCase().includes('application/x-www-form-urlencoded'))return buffer;
  const text=new TextDecoder().decode(buffer);
  const form=new URLSearchParams(text);
  if(form.get('resource')===externalResource(segment))form.set('resource',internalResource(segment));
  return new TextEncoder().encode(form.toString()).buffer;
}
function responseHeaders(upstream,request,segment,path){
  const headers=new Headers();
  for(const name of ['content-type','location','content-security-policy','x-frame-options']){
    const value=upstream.headers.get(name);if(value)headers.set(name,value);
  }
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('referrer-policy','no-referrer');
  headers.set('x-content-type-options','nosniff');
  for(const [k,v] of Object.entries(corsFor(request)))headers.set(k,v);
  if(path==='/mcp'&&upstream.status===401){
    headers.set('www-authenticate',`Bearer resource_metadata="${protectedMetadataUrl(segment)}", scope="mcp:read"`);
  }else{
    const www=upstream.headers.get('www-authenticate');if(www)headers.set('www-authenticate',www);
  }
  return headers;
}
export function protectedResourceMetadata(segment){
  segment=normalizeSegment(segment);
  return {
    resource:externalResource(segment),
    authorization_servers:[externalBase(segment)],
    scopes_supported:['mcp:read','offline_access'],
    bearer_methods_supported:['header'],
    resource_documentation:'https://ronaoil.com',
  };
}
export function authorizationServerMetadata(segment){
  segment=normalizeSegment(segment);
  const issuer=externalBase(segment);
  return {
    issuer,
    authorization_endpoint:`${issuer}/authorize`,
    token_endpoint:`${issuer}/token`,
    registration_endpoint:`${issuer}/register`,
    revocation_endpoint:`${issuer}/revoke`,
    response_types_supported:['code'],
    grant_types_supported:['authorization_code','refresh_token'],
    token_endpoint_auth_methods_supported:['none'],
    code_challenge_methods_supported:['S256'],
    scopes_supported:['mcp:read','offline_access'],
    service_documentation:'https://ronaoil.com',
  };
}
export async function handleWellKnown(context){
  const {request}=context;
  if(request.method==='OPTIONS')return preflight(request);
  if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'GET, OPTIONS',...corsFor(request)});
  const p=new URL(request.url).pathname;
  let m=p.match(/^\/\.well-known\/oauth-protected-resource\/(operations|finance|legal|market-analyst|rail-logistics|system-admin)\/mcp\/?$/);
  if(m)return json(protectedResourceMetadata(m[1]),200,corsFor(request));
  m=p.match(/^\/\.well-known\/oauth-authorization-server\/(operations|finance|legal|market-analyst|rail-logistics|system-admin)\/?$/);
  if(m)return json(authorizationServerMetadata(m[1]),200,corsFor(request));
  return json({error:'NOT_FOUND'},404,corsFor(request));
}
export async function proxyRoleRequest(context,segment){
  segment=normalizeSegment(segment);
  const {request}=context;
  const origin=request.headers.get('origin');
  if(!isAllowedOrigin(origin))return json({error:'ORIGIN_DENIED'},403);
  if(request.method==='OPTIONS')return preflight(request);
  const pathname=new URL(request.url).pathname;
  const prefix=`/${segment}`;
  if(!pathname.startsWith(prefix))return json({error:'ROLE_ROUTE_NOT_FOUND'},404,corsFor(request));
  const path=pathname.slice(prefix.length)||'/';
  if(!allowedRolePath(path))return json({error:'NOT_FOUND'},404,corsFor(request));
  if(path==='/mcp'&&request.method!=='POST'){
    if(request.method==='GET')return json({error:'SSE_NOT_SUPPORTED'},405,{allow:'POST, OPTIONS',...corsFor(request)});
    return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'POST, OPTIONS',...corsFor(request)});
  }
  if(['/token','/register','/revoke'].includes(path)&&request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'POST, OPTIONS',...corsFor(request)});
  if(path==='/authorize'&&!['GET','POST'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'GET, POST, OPTIONS',...corsFor(request)});
  let body;
  try{
    if(!['GET','HEAD'].includes(request.method)){
      const raw=await readBodyLimited(request);
      body=await rewriteFormBody(raw,request.headers.get('content-type'),segment,path);
    }
  }catch(e){return json({error:String(e?.message||'REQUEST_TOO_LARGE')},Number(e?.status||413),corsFor(request));}
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),UPSTREAM_TIMEOUT_MS);
  try{
    const upstream=await fetch(upstreamUrl(segment,path,request.url),{
      method:request.method,
      headers:safeForwardHeaders(request),
      body,
      redirect:'manual',
      signal:ctrl.signal,
    });
    const headers=responseHeaders(upstream,request,segment,path);
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
  }catch(e){
    if(e?.name==='AbortError')return json({error:'UPSTREAM_TIMEOUT'},504,corsFor(request));
    return json({error:'UPSTREAM_UNAVAILABLE'},502,corsFor(request));
  }finally{clearTimeout(timer);}
}
