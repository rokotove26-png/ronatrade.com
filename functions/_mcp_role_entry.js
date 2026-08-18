import {proxyRoleRequest} from './_mcp_transport.js';

const CANONICAL_RONA_ORIGINS=new Set(['https://ronaoil.com','https://www.ronaoil.com']);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTHORIZE_POST_MAX_BYTES=16384;
const AUTHORIZE_FORM_FIELDS=new Set(['request_id','email','password','confirm']);

function json(body,status){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff',
  }});
}
function contentTypeIsForm(value){
  return String(value||'').toLowerCase().split(';',1)[0].trim()==='application/x-www-form-urlencoded';
}
function logDecision(request,segment,decision){
  console.log(JSON.stringify({
    event:'RONA_OAUTH_BROWSER_ORIGIN_POLICY',
    segment,
    path:new URL(request.url).pathname,
    method:request.method,
    origin:request.headers.get('origin'),
    sec_fetch_site:request.headers.get('sec-fetch-site'),
    content_type:request.headers.get('content-type')||'',
    decision,
  }));
}
async function readAuthorizeBody(request){
  const len=request.headers.get('content-length');
  if(len&&Number(len)>AUTHORIZE_POST_MAX_BYTES)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  const raw=await request.arrayBuffer();
  if(raw.byteLength>AUTHORIZE_POST_MAX_BYTES)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  return raw;
}
function validateAuthorizeForm(raw){
  const form=new URLSearchParams(new TextDecoder().decode(raw));
  for(const key of form.keys())if(!AUTHORIZE_FORM_FIELDS.has(key))return false;
  if(form.getAll('request_id').length!==1||!UUID_RE.test(form.get('request_id')||''))return false;
  if(form.getAll('email').length!==1||!form.get('email'))return false;
  if(form.getAll('password').length!==1||!form.get('password'))return false;
  if(form.getAll('confirm').length!==1||form.get('confirm')!=='yes')return false;
  return true;
}

export async function proxyBoundRoleRequest(context,segment){
  const {request}=context;
  const expectedPath=`/${segment}/authorize`;
  const pathname=new URL(request.url).pathname;
  if(request.method!=='POST'||pathname!==expectedPath)return proxyRoleRequest(context,segment);

  const origin=request.headers.get('origin');
  const canonical=CANONICAL_RONA_ORIGINS.has(origin);
  const opaque=origin==='null';
  if(!canonical&&!opaque){
    logDecision(request,segment,'DENY_ORIGIN');
    return json({error:'ORIGIN_DENIED'},403);
  }
  if(!contentTypeIsForm(request.headers.get('content-type'))){
    logDecision(request,segment,'DENY_CONTENT_TYPE');
    return json({error:'INVALID_AUTHORIZE_CONTENT_TYPE'},415);
  }

  let raw;
  try{raw=await readAuthorizeBody(request);}catch(e){
    logDecision(request,segment,'DENY_BODY_SIZE');
    return json({error:String(e?.message||'REQUEST_TOO_LARGE')},Number(e?.status||413));
  }
  if(!validateAuthorizeForm(raw)){
    logDecision(request,segment,'DENY_FORM_AUTHORITY_FIELDS');
    return json({error:'INVALID_AUTHORIZE_FORM'},400);
  }

  logDecision(request,segment,opaque?'ALLOW_OPAQUE_ORIGIN':'ALLOW_CANONICAL_ORIGIN');
  if(!opaque){
    const forwarded=new Request(request.url,{method:'POST',headers:new Headers(request.headers),body:raw});
    return proxyRoleRequest({...context,request:forwarded},segment);
  }

  const headers=new Headers(request.headers);
  headers.set('origin','https://ronaoil.com');
  const forwarded=new Request(request.url,{method:'POST',headers,body:raw});
  return proxyRoleRequest({...context,request:forwarded},segment);
}
