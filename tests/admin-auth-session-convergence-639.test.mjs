import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as ownerApi } from '../functions/portal/owner-api.js';
import { onRequest as cashR2Ui } from '../functions/portal/cash-r2-ui.js';
import { onRequest as portalRouter } from '../functions/portal/[[path]].js';
import { onRequestPost as portalLogin } from '../functions/portal/auth/login.js';
import { onRequestPost as portalHandoff } from '../functions/portal/auth/handoff.js';

const realFetch=globalThis.fetch;
const cash=await (await cashR2Ui()).text();

function cashRequest(cookie='rona_portal_at=access-old; rona_portal_rt=refresh-old'){
  return new Request('https://ronaoil.com/portal/owner-api?path=/admin/cash-source',{
    method:'POST',
    headers:{
      origin:'https://ronaoil.com',
      referer:'https://ronaoil.com/portal/admin',
      'content-type':'application/json',
      accept:'application/json',
      cookie
    },
    body:JSON.stringify({from:'2026-08-01',to:'2026-09-17'})
  });
}

function jsonResponse(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8'}
  });
}

test.afterEach(()=>{globalThis.fetch=realFetch});

test('Issue 639 refreshes and retries Cash RPC when authenticated RPC returns PORTAL_ACCESS_DENIED',async()=>{
  let rpcCalls=0,refreshCalls=0;
  globalThis.fetch=async(url)=>{
    const u=String(url);
    if(u.includes('/rest/v1/rpc/rona_admin_cash_source_projection_v1')){
      rpcCalls++;
      if(rpcCalls===1)return jsonResponse({code:'42501',message:'PORTAL_ACCESS_DENIED'},403);
      return jsonResponse({modelVersion:'FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE'},200);
    }
    if(u.includes('/auth/v1/token?grant_type=refresh_token')){
      refreshCalls++;
      return jsonResponse({access_token:'access-new',refresh_token:'refresh-new',expires_in:3600},200);
    }
    throw new Error('UNEXPECTED_FETCH '+u);
  };

  const response=await ownerApi({request:cashRequest()});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(rpcCalls,2);
  assert.equal(refreshCalls,1);
  const setCookie=response.headers.get('set-cookie')||'';
  assert.match(setCookie,/rona_portal_at=access-new/);
  assert.match(setCookie,/rona_portal_rt=refresh-new/);
  assert.doesNotMatch(setCookie,/Max-Age=0/);
});

test('Issue 639 treats concurrent refresh-token loss as retryable stale session without destructive cookie clearing',async()=>{
  let rpcCalls=0;
  globalThis.fetch=async(url)=>{
    const u=String(url);
    if(u.includes('/rest/v1/rpc/rona_admin_cash_source_projection_v1')){
      rpcCalls++;
      return jsonResponse({code:'42501',message:'PORTAL_ACCESS_DENIED'},403);
    }
    if(u.includes('/auth/v1/token?grant_type=refresh_token')){
      return jsonResponse({error_code:'refresh_token_already_used',message:'Refresh Token Already Used'},400);
    }
    throw new Error('UNEXPECTED_FETCH '+u);
  };

  const response=await ownerApi({request:cashRequest()});
  assert.equal(response.status,409);
  const payload=await response.json();
  assert.deepEqual(payload,{ok:false,code:'PORTAL_SESSION_STALE',retryable:true});
  assert.equal(rpcCalls,1);
  const setCookie=response.headers.get('set-cookie')||'';
  assert.equal(setCookie,'');
  assert.doesNotMatch(setCookie,/Max-Age=0/);
});

test('Issue 639 subordinate owner API no longer clears portal cookies when no usable token is present',async()=>{
  globalThis.fetch=async(url)=>{throw new Error('UNEXPECTED_FETCH '+String(url))};
  const response=await ownerApi({request:cashRequest('')});
  assert.equal(response.status,401);
  const payload=await response.json();
  assert.equal(payload.code,'PORTAL_ACCESS_DENIED');
  assert.equal(response.headers.get('set-cookie'),null);
});

test('Issue 639 Cash UI retries stale-session races through existing bounded transient recovery',()=>{
  assert.ok(cash.includes("window.__RONA_CASH_AUTH_CONVERGENCE__='issue639-v1'"));
  assert.ok(cash.includes('status===409'));
  assert.ok(cash.includes('portal_session_stale'));
  assert.ok(cash.includes('INITIAL_RETRY_DELAYS=[1000,2000,4000,8000]'));
  assert.ok(cash.includes('CHECK_MS=60000'));
});


test('Issue 663 top-level Admin shell preserves cookies during concurrent refresh-token rotation',async()=>{
  globalThis.fetch=async(url)=>{
    const u=String(url);
    if(u.includes('/functions/v1/rona-portal-api/session/me')){
      return jsonResponse({ok:false,code:'PORTAL_ACCESS_DENIED'},401);
    }
    if(u.includes('/auth/v1/token?grant_type=refresh_token')){
      return jsonResponse({error_code:'refresh_token_already_used',message:'Refresh Token Already Used'},400);
    }
    throw new Error('UNEXPECTED_FETCH '+u);
  };

  const request=new Request('https://ronaoil.com/portal/admin',{
    method:'GET',
    headers:{cookie:'rona_portal_at=access-old; rona_portal_rt=refresh-old'}
  });
  const response=await portalRouter({
    request,
    next:async()=>new Response('SHOULD_NOT_BE_REACHED',{status:200,headers:{'content-type':'text/html'}})
  });
  assert.equal(response.status,503);
  const body=await response.text();
  assert.match(body,/Восстанавливаю соединение/);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.doesNotMatch(body,/Доступ запрещён/);
});

test('Issue 663 exact login session probe uses publishable key and returns Admin redirect',async()=>{
  let sawApiKey=false;
  globalThis.fetch=async(url,init={})=>{
    const u=String(url);
    if(u.includes('/auth/v1/token?grant_type=password')){
      return jsonResponse({access_token:'access-new',refresh_token:'refresh-new',expires_in:3600},200);
    }
    if(u.includes('/functions/v1/rona-portal-api/session/me')){
      const h=new Headers(init.headers||{});
      sawApiKey=Boolean(h.get('apikey'));
      return jsonResponse({ok:true,user:{roles:['ADMIN']}},200);
    }
    throw new Error('UNEXPECTED_FETCH '+u);
  };

  const request=new Request('https://ronaoil.com/portal/auth/login',{
    method:'POST',
    headers:{origin:'https://ronaoil.com','content-type':'application/json',accept:'text/html'},
    body:JSON.stringify({email:'qa-owner@example.invalid',password:'fixture-only',next:'/portal/admin'})
  });
  const response=await portalLogin({request});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/portal/admin');
  assert.equal(sawApiKey,true);
  const setCookie=response.headers.get('set-cookie')||'';
  assert.match(setCookie,/rona_portal_at=access-new/);
  assert.match(setCookie,/rona_portal_rt=refresh-new/);
});


test('Issue 663 protected portal falls back to PostgREST current-session authority when portal edge probe is unavailable',async()=>{
  let edgeCalls=0,rpcCalls=0;
  globalThis.fetch=async(url)=>{
    const u=String(url);
    if(u.includes('/functions/v1/rona-portal-api/session/me')){
      edgeCalls++;
      return jsonResponse({ok:false,code:'UPSTREAM_UNAVAILABLE'},503);
    }
    if(u.includes('/rest/v1/rpc/rona_portal_session_me_fallback_v1')){
      rpcCalls++;
      return jsonResponse([{portal_user_id:'1eb4902b-3dea-4a04-ad30-2ba47d76cda8',display_name:'RONA Trade Owner Administrator',roles:['ADMIN','RONA_OPERATOR'],session_allowed:true}],200);
    }
    throw new Error('UNEXPECTED_FETCH '+u);
  };
  const request=new Request('https://ronaoil.com/portal/',{headers:{cookie:'rona_portal_at=access-current; rona_portal_rt=refresh-current'}});
  const response=await portalRouter({request,next:async()=>new Response('unused')});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/portal/select');
  assert.equal(edgeCalls,1);
  assert.equal(rpcCalls,1);
  assert.doesNotMatch(response.headers.get('set-cookie')||'',/Max-Age=0/);
});

test('Issue 663 browser-auth handoff only stores structurally current Supabase session tokens; protected route remains authority boundary',async()=>{
  const payload={
    iss:'https://sxawrwzeobaqwwmlkzws.supabase.co/auth/v1',
    aud:'authenticated',
    role:'authenticated',
    sub:'c4a167ae-cd4f-4296-8f13-ef09ced41968',
    session_id:'26b88620-e01e-4298-9a8c-e898fdfb70ef',
    exp:Math.floor(Date.now()/1000)+1800
  };
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const access=b64({alg:'ES256',typ:'JWT'})+'.'+b64(payload)+'.'+'signature-placeholder-for-handoff-only';
  const refresh='refresh-token-fixture-1234567890';
  const request=new Request('https://ronaoil.com/portal/auth/handoff',{
    method:'POST',
    headers:{origin:'https://ronaoil.com','content-type':'application/json'},
    body:JSON.stringify({access_token:access,refresh_token:refresh,expires_in:1800})
  });
  const response=await portalHandoff({request});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.mode,'BROWSER_AUTH_HTTPONLY_HANDOFF_V1');
  const setCookie=response.headers.get('set-cookie')||'';
  assert.match(setCookie,/rona_portal_at=/);
  assert.match(setCookie,/rona_portal_rt=/);
  assert.match(setCookie,/HttpOnly/);
  assert.match(setCookie,/SameSite=Lax/);
});
