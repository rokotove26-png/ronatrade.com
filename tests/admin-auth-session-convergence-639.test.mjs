import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as ownerApi } from '../functions/portal/owner-api.js';
import { onRequest as cashR2Ui } from '../functions/portal/cash-r2-ui.js';

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
  assert.ok(cash.includes('INITIAL_RETRY_DELAYS=[2000,5000,15000,30000]'));
  assert.ok(cash.includes('CHECK_MS=60000'));
});
