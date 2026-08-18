import {proxyRoleRequest} from './_mcp_transport.js';
import {prepareConsent,completeConsent} from './_mcp_consent_bridge.js';

const CANONICAL_RONA_ORIGINS=new Set(['https://ronaoil.com','https://www.ronaoil.com']);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_VERIFIER_RE=/^[A-Za-z0-9\-._~]{43,128}$/;
const AUTHORIZE_POST_MAX_BYTES=16384;
const TOKEN_POST_MAX_BYTES=32768;
const AUTHORIZE_FORM_FIELDS=new Set(['request_id','email','password','confirm']);
const TOKEN_FORM_FIELDS=new Set(['grant_type','client_id','code','redirect_uri','code_verifier','resource','scope','refresh_token']);

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
async function readLimitedBody(request,max){
  const len=request.headers.get('content-length');
  if(len&&Number(len)>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  const raw=await request.arrayBuffer();
  if(raw.byteLength>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
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
function validateTokenForm(raw){
  const form=new URLSearchParams(new TextDecoder().decode(raw));
  for(const key of form.keys())if(!TOKEN_FORM_FIELDS.has(key))return false;
  for(const key of TOKEN_FORM_FIELDS)if(form.getAll(key).length>1)return false;
  const grant=form.get('grant_type')||'';
  const clientId=form.get('client_id')||'';
  if(!clientId||!['authorization_code','refresh_token'].includes(grant))return false;
  if(grant==='authorization_code'){
    if(!form.get('code')||!form.get('redirect_uri')||!CODE_VERIFIER_RE.test(form.get('code_verifier')||''))return false;
  }
  if(grant==='refresh_token'&&!form.get('refresh_token'))return false;
  return true;
}
function forwardWithCanonicalOrigin(context,request,segment,raw){
  const headers=new Headers(request.headers);
  headers.set('origin','https://ronaoil.com');
  const forwarded=new Request(request.url,{method:'POST',headers,body:raw});
  return proxyRoleRequest({...context,request:forwarded},segment);
}
function consentScript(segment,nonce){
  const authorize=`https://ronaoil.com/${segment}/authorize`;
  return `<script nonce="${nonce}">(()=>{const form=document.querySelector('form[action="${authorize}"]');if(!form||!globalThis.crypto?.getRandomValues)return;const button=form.querySelector('button[type="submit"]');let busy=false;const encode=b=>{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;if(button)button.disabled=true;const bytes=crypto.getRandomValues(new Uint8Array(32)),continuation=encode(bytes),data=new URLSearchParams(new FormData(form));data.set('continuation_nonce',continuation);try{await fetch('${authorize}/prepare',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:data.toString(),mode:'no-cors',credentials:'omit',cache:'no-store'});}catch(_e){}location.replace('${authorize}/complete?nonce='+encodeURIComponent(continuation));});})();</script>`;
}
async function enhanceConsent(response,segment){
  const type=String(response.headers.get('content-type')||'');
  if(response.status!==200||!type.toLowerCase().includes('text/html'))return response;
  const html=await response.text();
  if(!html.includes('name="request_id"')||!html.includes('type="submit"'))return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  const nonce=crypto.randomUUID(),script=consentScript(segment,nonce),out=html.includes('</body>')?html.replace('</body>',`${script}</body>`):html+script;
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-security-policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src https://ronaoil.com; form-action https://ronaoil.com; base-uri 'none'; frame-ancestors 'none'`);
  headers.set('x-rona-oauth-consent-policy','single-click-continuation-v1');
  return new Response(out,{status:200,statusText:'OK',headers});
}

export async function proxyBoundRoleRequest(context,segment){
  const {request}=context;
  const pathname=new URL(request.url).pathname;
  const authorizePath=`/${segment}/authorize`;
  const preparePath=`${authorizePath}/prepare`;
  const completePath=`${authorizePath}/complete`;
  const tokenPath=`/${segment}/token`;

  if(pathname===preparePath)return prepareConsent(context,segment);
  if(pathname===completePath)return completeConsent(context,segment);

  if(request.method==='POST'&&pathname===authorizePath){
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
    try{raw=await readLimitedBody(request,AUTHORIZE_POST_MAX_BYTES);}catch(e){
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
    return forwardWithCanonicalOrigin(context,request,segment,raw);
  }

  if(request.method==='POST'&&pathname===tokenPath&&request.headers.get('origin')==='null'){
    if(!contentTypeIsForm(request.headers.get('content-type'))){
      logDecision(request,segment,'DENY_TOKEN_CONTENT_TYPE');
      return json({error:'INVALID_TOKEN_CONTENT_TYPE'},415);
    }
    let raw;
    try{raw=await readLimitedBody(request,TOKEN_POST_MAX_BYTES);}catch(e){
      logDecision(request,segment,'DENY_TOKEN_BODY_SIZE');
      return json({error:String(e?.message||'REQUEST_TOO_LARGE')},Number(e?.status||413));
    }
    if(!validateTokenForm(raw)){
      logDecision(request,segment,'DENY_TOKEN_FORM');
      return json({error:'ORIGIN_DENIED'},403);
    }
    logDecision(request,segment,'ALLOW_OPAQUE_TOKEN_ORIGIN');
    return forwardWithCanonicalOrigin(context,request,segment,raw);
  }

  const response=await proxyRoleRequest(context,segment);
  if(request.method==='GET'&&pathname===authorizePath)return enhanceConsent(response,segment);
  return response;
}
