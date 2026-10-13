import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../../functions/portal/admin.js';

const portal=readFileSync(new URL('../../functions/portal/admin.js',import.meta.url),'utf8');
const controlPlane=readFileSync(new URL('../../supabase/functions/rona-admin-control-plane/index.ts',import.meta.url),'utf8');
const primaryRoute='/functions/v1/rona-portal-api/session/me';
const fallbackRoute='/functions/v1/rona-admin-control-plane/readiness';
const authIdentityRoute='/auth/v1/user';
const JSON_HEADERS={'content-type':'application/json'};

function makeContext(){
  const counts={primary:0,fallback:0,authIdentity:0,assets:0,unrecognized:[]};
  const request=new Request('https://ronaoil.com/portal/admin',{
    method:'GET',headers:{cookie:'rona_portal_at=synthetic-no-real-token'}
  });
  return {counts,context:{
    request,
    env:{ASSETS:{fetch:async()=>{counts.assets++;return new Response('<html>ADMIN_TEST_ASSET</html>',{status:200,headers:{'content-type':'text/html'}});}}},
    next:async()=>{throw new Error('UNEXPECTED_UNGUARDED_ASSET')}
  }};
}
async function withMockFetch(counts,{primaryStatus=503,fallbackStatus=503,ownerIdentityStatus=200},callback){
  const before=globalThis.fetch;
  globalThis.fetch=async(request)=>{
    const url=String(request);
    if(url.includes(primaryRoute)){
      counts.primary++;
      return new Response(JSON.stringify(primaryStatus===200?{ok:true,user:{roles:['ADMIN']}}:{ok:false,code:'PRIMARY_UNAVAILABLE'}),{status:primaryStatus,headers:JSON_HEADERS});
    }
    if(url.includes(fallbackRoute)){
      counts.fallback++;
      return new Response(JSON.stringify(fallbackStatus===200?{ok:true}:{ok:false,code:'FALLBACK_UNAVAILABLE'}),{status:fallbackStatus,headers:JSON_HEADERS});
    }
    if(url.includes(authIdentityRoute)){
      counts.authIdentity++;
      return new Response(JSON.stringify({app_metadata:{portal_identity:'OWNER_ADMIN'}}),{status:ownerIdentityStatus,headers:JSON_HEADERS});
    }
    counts.unrecognized.push(url);
    throw new Error('UNEXPECTED_NETWORK_ROUTE');
  };
  try{return await callback()}
  finally{globalThis.fetch=before}
}

test('only session-authoritative routes may grant Admin shell during failover',()=>{
  assert.match(portal,/async function sessionProbe\(accessToken\)/);
  assert.match(portal,/async function adminFallbackProbe\(accessToken\)/);
  assert.match(portal,/ADMIN_CONTROL_PLANE_FALLBACK/);
  assert.match(portal,/if\(fallback\.state!=='UNAVAILABLE'\)return fallback/);
  assert.match(portal,/return \{state:'UNAVAILABLE',me:null,status:lastStatus\|\|fallback\.status\|\|503\}/);
  assert.doesNotMatch(portal,/authOwnerProbe\s*\(|SUPABASE_AUTH_OWNER_FALLBACK/);
  assert.match(controlPlane,/join auth\.sessions s on s\.id=\$\{sid\}::uuid and s\.user_id=\$\{data\.user\.id\}::uuid/);
  assert.match(controlPlane,/a\.session_allowed and \(s\.not_after is null or s\.not_after>now\(\)\)/);
  assert.match(controlPlane,/includes\("ADMIN"\)/);
  assert.match(controlPlane,/const ctx = await adminContext\(req\)/);
  assert.match(controlPlane,/if \(!ctx\) return send\(403,/);
});

test('primary and database-backed fallback unavailable: deny shell even if GoTrue would affirm Owner',async()=>{
  const {counts,context}=makeContext();
  const response=await withMockFetch(counts,{primaryStatus:503,fallbackStatus:503,ownerIdentityStatus:200},()=>onRequest(context));
  assert.equal(response.status,503,'Admin shell must stay unavailable without current session attestation');
  assert.match(await response.text(),/Восстанавливаю соединение/);
  assert.equal(counts.primary,4);
  assert.equal(counts.fallback,1);
  assert.equal(counts.authIdentity,0,'GoTrue identity-only fallback must not be queried');
  assert.equal(counts.assets,0,'no Admin asset without session attestation');
  assert.deepEqual(counts.unrecognized,[]);
});

test('definitive primary session denial must redirect to login without granting fallback',async()=>{
  const {counts,context}=makeContext();
  const response=await withMockFetch(counts,{primaryStatus:403},()=>onRequest(context));
  assert.equal(response.status,302);
  assert.equal(new URL(response.headers.get('location')).pathname,'/portal/login');
  assert.equal(counts.primary,1);
  assert.equal(counts.fallback,0);
  assert.equal(counts.authIdentity,0);
  assert.equal(counts.assets,0);
  assert.ok((response.headers.get('set-cookie')||'').includes('Max-Age=0'));
});

test('definitive database-backed fallback session denial must redirect, not consult identity-only GoTrue',async()=>{
  const {counts,context}=makeContext();
  const response=await withMockFetch(counts,{primaryStatus:503,fallbackStatus:403},()=>onRequest(context));
  assert.equal(response.status,302);
  assert.equal(counts.primary,4);
  assert.equal(counts.fallback,1);
  assert.equal(counts.authIdentity,0);
  assert.equal(counts.assets,0);
});

test('database-backed fallback success may serve Admin shell when primary temporarily fails',async()=>{
  const {counts,context}=makeContext();
  const response=await withMockFetch(counts,{primaryStatus:503,fallbackStatus:200},()=>onRequest(context));
  assert.equal(response.status,200);
  assert.match(await response.text(),/ADMIN_TEST_ASSET/);
  assert.equal(counts.primary,4);
  assert.equal(counts.fallback,1);
  assert.equal(counts.authIdentity,0);
  assert.equal(counts.assets,1);
  assert.equal(response.headers.get('x-rona-admin-auth'),'server-verified-v1');
});


test('portal catch-all Admin route cannot elevate claim-only Owner gateway or GoTrue identity when DB-backed authorities fail',async()=>{
  const {onRequest: portalRouter}=await import('../../functions/portal/[[path]].js');
  const router=readFileSync(new URL('../../functions/portal/[[path]].js',import.meta.url),'utf8');
  assert.doesNotMatch(router,/authOwnerProbe\s*\(|adminOwnerJwtGatewayProbe\s*\(|SUPABASE_AUTH_OWNER_FALLBACK/);
  assert.match(router,/const fallback=await adminControlPlaneProbe\(accessToken\)/);
  let primary=0,backed=0,claimGateway=0,goTrue=0,assets=0,unexpected=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(url)=>{
    const target=String(url);
    if(target.includes('/functions/v1/rona-portal-api/session/authority')){
      primary++;
      return new Response(JSON.stringify({ok:false,code:'BACKEND_UNAVAILABLE'}),{status:503,headers:JSON_HEADERS});
    }
    if(target.includes(fallbackRoute)){
      backed++;
      return new Response(JSON.stringify({ok:false,code:'BACKEND_UNAVAILABLE'}),{status:503,headers:JSON_HEADERS});
    }
    if(target.includes('/functions/v1/rona-admin-control-plane/owner-auth-fallback')){
      claimGateway++;
      return new Response(JSON.stringify({ok:true,roles:['ADMIN'],authority:'SUPABASE_EDGE_VERIFIED_OWNER'}),{status:200,headers:JSON_HEADERS});
    }
    if(target.includes(authIdentityRoute)){
      goTrue++;
      return new Response(JSON.stringify({app_metadata:{portal_identity:'OWNER_ADMIN'}}),{status:200,headers:JSON_HEADERS});
    }
    unexpected.push(target);
    throw new Error('UNEXPECTED_NETWORK_ROUTE');
  };
  try{
    const request=new Request('https://ronaoil.com/portal/admin',{method:'GET',headers:{cookie:'rona_portal_at=synthetic-owner-claims'}});
    const response=await portalRouter({request,next:async()=>{assets++;return new Response('ILLEGITIMATE_ADMIN_SHELL')}});
    assert.equal(response.status,503);
    assert.match(await response.text(),/Восстанавливаю соединение/);
    assert.equal(primary,2);
    assert.equal(backed,1);
    assert.equal(claimGateway,0);
    assert.equal(goTrue,0);
    assert.equal(assets,0);
    assert.deepEqual(unexpected,[]);
  }finally{
    globalThis.fetch=original;
  }
});
