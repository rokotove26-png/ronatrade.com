const PUBLIC_ORIGIN='https://ronaoil.com';
const UPSTREAM_ORIGIN='https://sxawrwzeobaqwwmlkzws.supabase.co';
const UPSTREAM_BASE=`${UPSTREAM_ORIGIN}/functions/v1/rona-mcp-gateway`;
const SEGMENTS=new Set(['operations','operations-pilot','finance','finance-pilot','legal','legal-pilot','market-analyst','market-analyst-pilot','rail-logistics','rail-logistics-pilot','system-admin']);
const COORDINATE_SEGMENTS=new Set(['operations-pilot','finance-pilot','legal-pilot','market-analyst-pilot','rail-logistics-pilot']);
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
function scopesFor(segment){return COORDINATE_SEGMENTS.has(segment)?['mcp:read','mcp:coordinate','offline_access']:['mcp:read','offline_access'];}
function challengeScope(segment){return COORDINATE_SEGMENTS.has(segment)?'mcp:read mcp:coordinate':'mcp:read';}
function protectedMetadataUrl(segment){return `${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/${segment}/mcp`;}
function isAllowedOrigin(origin){return !origin||ALLOWED_ORIGINS.has(origin);}
function isAllowedCallbackLocation(value){
  try{
    const u=new URL(String(value||''));
    if(u.protocol!=='https:'||u.username||u.password||u.hash)return false;
    const h=u.hostname.toLowerCase();
    return h==='chatgpt.com'||h.endsWith('.chatgpt.com')||h==='openai.com'||h.endsWith('.openai.com');
  }catch{return false;}
}
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
  return upstream;
}
function upstreamUrl(segment,path,requestUrl){
  if(path==='/authorize'&&new URL(requestUrl).search)return rewriteAuthorizeUrl(requestUrl,segment);
  return new URL(`${UPSTREAM_BASE}/${segment}${path}`);
}
async function rewriteFormBody(buffer,_contentType,_segment,_path){
  return buffer;
}
function rewriteConsentHtml(html,segment){
  const canonicalAction=`${externalBase(segment)}/authorize`;
  let out=String(html||'');
  const before=out;
  out=out.replace(/<form\s+method=["']post["']\s+action=["']authorize["']>/i,
    `<form method="POST" action="${canonicalAction}" enctype="application/x-www-form-urlencoded" accept-charset="UTF-8">`);
  out=out.replace(/<button\s+type=["']submit["']([^>]*)>Разрешить<\/button>/i,'<button type="submit"$1>Разрешить</button>');
  if(out===before||!out.includes(`action="${canonicalAction}"`)||!out.includes('name="request_id"')||!out.includes('name="email"')||!out.includes('name="password"')||!out.includes('name="confirm"')||!out.includes('value="yes"')||!out.includes('type="submit"')){
    throw Object.assign(new Error('CONSENT_FORM_REWRITE_FAILED'),{status:502});
  }
  return out;
}
function responseHeaders(upstream,request,segment,path){
  const headers=new Headers();
  for(const name of ['content-type','location','content-security-policy','x-frame-options']){
    const value=upstream.headers.get(name);if(value)headers.set(name,value);
  }
  if(path==='/authorize'&&upstream.status===200){
    headers.set('content-type','text/html; charset=utf-8');
    headers.set('content-security-policy',"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    headers.set('x-rona-oauth-consent-policy','same-origin-form-v1');
  }
  if(path==='/authorize'&&upstream.status>=300&&upstream.status<400){
    headers.delete('content-security-policy');
    headers.delete('x-frame-options');
  }
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('referrer-policy','no-referrer');
  headers.set('x-content-type-options','nosniff');
  for(const [k,v] of Object.entries(corsFor(request)))headers.set(k,v);
  if(path==='/mcp'&&upstream.status===401){
    headers.set('www-authenticate',`Bearer resource_metadata="${protectedMetadataUrl(segment)}", scope="${challengeScope(segment)}"`);
  }else{
    const www=upstream.headers.get('www-authenticate');if(www)headers.set('www-authenticate',www);
  }
  return headers;
}
function safeTokenShape(buffer,contentType){
  if(!String(contentType||'').toLowerCase().includes('application/x-www-form-urlencoded'))return null;
  try{
    const form=new URLSearchParams(new TextDecoder().decode(buffer));
    const client=String(form.get('client_id')||'');
    return {
      grant_type:String(form.get('grant_type')||''),
      client_suffix:client?client.slice(-12):'',
      resource_present:Boolean(form.get('resource')),
      redirect_uri_present:Boolean(form.get('redirect_uri')),
      code_verifier_present:Boolean(form.get('code_verifier')),
    };
  }catch{return null;}
}
export function protectedResourceMetadata(segment){
  segment=normalizeSegment(segment);
  return {
    resource:externalResource(segment),
    authorization_servers:[externalBase(segment)],
    scopes_supported:scopesFor(segment),
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
    scopes_supported:scopesFor(segment),
    service_documentation:'https://ronaoil.com',
  };
}
export async function handleWellKnown(context){
  const {request}=context;
  if(request.method==='OPTIONS')return preflight(request);
  if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'GET, OPTIONS',...corsFor(request)});
  const p=new URL(request.url).pathname;
  let m=p.match(/^\/\.well-known\/oauth-protected-resource\/(operations-pilot|operations|finance-pilot|finance|legal-pilot|legal|market-analyst-pilot|market-analyst|rail-logistics-pilot|rail-logistics|system-admin)\/mcp\/?$/);
  if(m)return json(protectedResourceMetadata(m[1]),200,corsFor(request));
  m=p.match(/^\/\.well-known\/oauth-authorization-server\/(operations-pilot|operations|finance-pilot|finance|legal-pilot|legal|market-analyst-pilot|market-analyst|rail-logistics-pilot|rail-logistics|system-admin)\/?$/);
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
  if(path==='/authorize'&&request.method==='POST'){
    console.log(JSON.stringify({event:'RONA_OAUTH_PUBLIC_AUTHORIZE_POST_RECEIVED',segment,content_type:request.headers.get('content-type')||''}));
  }
  let body,tokenShape=null;
  try{
    if(!['GET','HEAD'].includes(request.method)){
      const raw=await readBodyLimited(request);
      tokenShape=path==='/token'?safeTokenShape(raw,request.headers.get('content-type')):null;
      body=await rewriteFormBody(raw,request.headers.get('content-type'),segment,path);
    }
  }catch(e){return json({error:String(e?.message||'REQUEST_TOO_LARGE')},Number(e?.status||413),corsFor(request));}
  if(path==='/token'&&request.method==='POST'){
    console.log(JSON.stringify({event:'RONA_OAUTH_PUBLIC_TOKEN_POST_RECEIVED',segment,...(tokenShape||{grant_type:'',client_suffix:'',resource_present:false,redirect_uri_present:false,code_verifier_present:false})}));
  }
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
    if(path==='/authorize'&&request.method==='POST'){
      console.log(JSON.stringify({event:'RONA_OAUTH_PUBLIC_AUTHORIZE_POST_UPSTREAM_RESULT',segment,status:upstream.status,has_location:Boolean(upstream.headers.get('location'))}));
    }
    if(path==='/token'&&request.method==='POST'){
      console.log(JSON.stringify({event:'RONA_OAUTH_PUBLIC_TOKEN_POST_UPSTREAM_RESULT',segment,status:upstream.status,...(tokenShape||{})}));
    }
    const headers=responseHeaders(upstream,request,segment,path);
    if(path==='/authorize'&&request.method==='GET'&&upstream.status===200){
      const html=await upstream.text();
      let rewritten;
      try{rewritten=rewriteConsentHtml(html,segment);}catch(e){return json({error:String(e?.message||'CONSENT_FORM_REWRITE_FAILED')},Number(e?.status||502),corsFor(request));}
      return new Response(rewritten,{status:200,statusText:'OK',headers});
    }
    if(path==='/authorize'&&request.method==='POST'&&upstream.status>=300&&upstream.status<400){
      const location=upstream.headers.get('location')||'';
      if(!isAllowedCallbackLocation(location))return json({error:'CALLBACK_LOCATION_DENIED'},502,corsFor(request));
      const callback=new URL(location);
      console.log(JSON.stringify({event:'RONA_OAUTH_PUBLIC_CALLBACK_303',segment,status:303,callback_host:callback.hostname,callback_path:callback.pathname,has_code:callback.searchParams.has('code'),has_state:callback.searchParams.has('state'),has_fragment:Boolean(callback.hash),internal_location:callback.hostname==='sxawrwzeobaqwwmlkzws.supabase.co'}));
      headers.set('location',location);
      return new Response(null,{status:303,statusText:'See Other',headers});
    }
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
  }catch(e){
    if(e?.name==='AbortError')return json({error:'UPSTREAM_TIMEOUT'},504,corsFor(request));
    return json({error:'UPSTREAM_UNAVAILABLE'},502,corsFor(request));
  }finally{clearTimeout(timer);}
}