const UPSTREAM='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-mcp-consent-bridge';
const PUBLIC_ORIGIN='https://ronaoil.com';
const SEGMENTS=new Set(['operations','finance','legal','market-analyst','rail-logistics','system-admin']);
const ALLOWED_POST_ORIGINS=new Set(['null','https://ronaoil.com','https://www.ronaoil.com']);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_RE=/^[A-Za-z0-9_-]{43,128}$/;
const FORM_FIELDS=new Set(['request_id','email','password','confirm','continuation_nonce']);
const MAX_BODY=16384;
const TIMEOUT_MS=15000;

function baseHeaders(){return{'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8',...baseHeaders()}});}
function segmentOk(segment){return SEGMENTS.has(segment);}
function contentTypeIsForm(value){return String(value||'').toLowerCase().split(';',1)[0].trim()==='application/x-www-form-urlencoded';}
async function readBody(request){const len=request.headers.get('content-length');if(len&&Number(len)>MAX_BODY)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});const raw=await request.arrayBuffer();if(raw.byteLength>MAX_BODY)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});return raw;}
function safeReferer(request){const raw=request.headers.get('referer');if(!raw)return{host:'',path:''};try{const u=new URL(raw);return{host:u.hostname.slice(0,120),path:u.pathname.slice(0,240)};}catch{return{host:'',path:''};}}
function uaFamily(value){const s=String(value||'');if(/Edg\//i.test(s))return'Edge';if(/Chrome\//i.test(s)&&/wv|WebView/i.test(s))return'Chromium WebView';if(/Chrome\//i.test(s))return'Chrome';if(/Firefox\//i.test(s))return'Firefox';if(/Safari\//i.test(s)&&!/(Chrome|Chromium)\//i.test(s))return'Safari/WebKit';if(/ChatGPT/i.test(s))return'ChatGPT';return s?'Other':'Unknown';}
function traceHeaders(request){const ref=safeReferer(request),h=new Headers();h.set('origin','https://ronaoil.com');h.set('content-type','application/x-www-form-urlencoded');h.set('accept','application/json');h.set('accept-encoding','identity');h.set('x-rona-oauth-original-origin',String(request.headers.get('origin')||'').slice(0,80));h.set('x-rona-oauth-sec-fetch-site',String(request.headers.get('sec-fetch-site')||'').slice(0,40));h.set('x-rona-oauth-sec-fetch-mode',String(request.headers.get('sec-fetch-mode')||'').slice(0,40));h.set('x-rona-oauth-sec-fetch-dest',String(request.headers.get('sec-fetch-dest')||'').slice(0,40));h.set('x-rona-oauth-referer-host',ref.host);h.set('x-rona-oauth-referer-path',ref.path);h.set('x-rona-oauth-user-agent-family',uaFamily(request.headers.get('user-agent')));return h;}
function allowedCallback(value){try{const u=new URL(String(value||''));if(u.protocol!=='https:'||u.username||u.password||u.hash)return false;const h=u.hostname.toLowerCase();return h==='chatgpt.com'||h.endsWith('.chatgpt.com')||h==='openai.com'||h.endsWith('.openai.com');}catch{return false;}}
async function upstreamFetch(url,init){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);try{return await fetch(url,{...init,redirect:'manual',signal:ctrl.signal});}finally{clearTimeout(timer);}}

export async function prepareConsent(context,segment){
  if(!segmentOk(segment))return json({error:'ROLE_ROUTE_NOT_FOUND'},404);
  const {request}=context;if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  const origin=request.headers.get('origin')||'';if(!ALLOWED_POST_ORIGINS.has(origin))return json({error:'ORIGIN_DENIED'},403);
  if(!contentTypeIsForm(request.headers.get('content-type')))return json({error:'INVALID_CONTENT_TYPE'},415);
  let raw;try{raw=await readBody(request);}catch(e){return json({error:String(e?.message||'REQUEST_TOO_LARGE')},Number(e?.status||413));}
  const form=new URLSearchParams(new TextDecoder().decode(raw));for(const key of form.keys())if(!FORM_FIELDS.has(key))return json({error:'INVALID_AUTHORIZE_FORM'},400);for(const key of FORM_FIELDS)if(form.getAll(key).length>1)return json({error:'INVALID_AUTHORIZE_FORM'},400);
  if(!UUID_RE.test(form.get('request_id')||'')||!form.get('email')||!form.get('password')||form.get('confirm')!=='yes'||!NONCE_RE.test(form.get('continuation_nonce')||''))return json({error:'INVALID_AUTHORIZE_FORM'},400);
  try{const upstream=await upstreamFetch(`${UPSTREAM}/${segment}/prepare`,{method:'POST',headers:traceHeaders(request),body:raw});if(upstream.status===204)return new Response(null,{status:204,headers:baseHeaders()});const text=await upstream.text();return new Response(text,{status:upstream.status,headers:{'content-type':upstream.headers.get('content-type')||'application/json; charset=utf-8',...baseHeaders()}});}catch(e){if(e?.name==='AbortError')return json({error:'UPSTREAM_TIMEOUT'},504);return json({error:'UPSTREAM_UNAVAILABLE'},502);}
}

export async function completeConsent(context,segment){
  if(!segmentOk(segment))return json({error:'ROLE_ROUTE_NOT_FOUND'},404);
  const {request}=context;if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
  const u=new URL(request.url),nonce=u.searchParams.get('nonce')||'';if(!NONCE_RE.test(nonce))return json({error:'invalid_request'},400);
  const h=traceHeaders(request);h.delete('content-type');h.set('accept','text/html,application/xhtml+xml,application/json');
  try{const upstream=await upstreamFetch(`${UPSTREAM}/${segment}/complete?nonce=${encodeURIComponent(nonce)}`,{method:'GET',headers:h});if(upstream.status>=300&&upstream.status<400){const location=upstream.headers.get('location')||'';if(!allowedCallback(location))return json({error:'CALLBACK_LOCATION_DENIED'},502);return new Response(null,{status:303,statusText:'See Other',headers:{location,...baseHeaders()}});}const text=await upstream.text();return new Response(text,{status:upstream.status,headers:{'content-type':upstream.headers.get('content-type')||'application/json; charset=utf-8',...baseHeaders()}});}catch(e){if(e?.name==='AbortError')return json({error:'UPSTREAM_TIMEOUT'},504);return json({error:'UPSTREAM_UNAVAILABLE'},502);}
}
