import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../../functions/portal/api/v1/client/deal-documents/state.js';

const ENDPOINT='https://rona-trade-public.pages.dev/portal/api/v1/client/deal-documents/state';
function request({method='GET',origin=null,cookie='rona_portal_at=CLIENT_FIXTURE_JWT',client='CLIENT-A',contract='CONTRACT-A'}={}){
  const headers=new Headers();
  if(cookie)headers.set('cookie',cookie);
  if(origin!==null)headers.set('origin',origin);
  return{request:new Request(ENDPOINT+'?clientId='+encodeURIComponent(client)+'&contractId='+encodeURIComponent(contract),{method,headers})};
}
function fixture({canonicalClient='CLIENT-A',canonicalContract='CONTRACT-A',resource='RESOURCE_CONFIRMED',legacyDeal='DEAL-2026-007',canonicalDeal='DEAL-2026-007'}={}){
 return{
 legacy:{ok:true,deals:[{deal_id:legacyDeal,realization_status:{source:'SERVER_AUTHORITATIVE_REALIZATION_V1',stages:[{key:'contract',state:'DONE',detail:'Согласовано'},{key:'resource',state:'CURRENT',detail:'Ожидается'},{key:'payment',state:'PENDING',detail:'Ожидается'}]}}]},
 canonical:{ok:true,data:{contract:{client_id:canonicalClient,contract_id:canonicalContract},deals:[{deal_id:canonicalDeal,resource_status:resource,resource_source:'CANONICAL_RESOURCE_FACT',resource_confirmed_at:'2099-01-01T00:00:00Z'}]}}
 };
}
function withStub({legacy,canonical},calls){
 const prior=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  const u=String(url);
  calls.push({url:u,method:opts?.method,auth:opts?.headers?.authorization,impersonation:opts?.headers?.['x-rona-admin-impersonation-token']});
  if(u.includes('/rona-temp-upload-order-20260816/'))return Response.json(legacy);
  if(u.includes('/rona-portal-api/v1/client/context'))return Response.json(canonical);
  throw Error('OUT_OF_SCOPE_NETWORK_REQUEST');
 };
 return()=>{globalThis.fetch=prior};
}
test('deny mutations and hostile origin before any backend call',async()=>{
 const original=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>{count++;throw Error('NETWORK_FORBIDDEN')};
 try{
  let res=await onRequest(request({method:'POST'}));assert.equal(res.status,405);assert.equal((await res.json()).code,'METHOD_NOT_ALLOWED');
  res=await onRequest(request({origin:'https://hostile.example'}));assert.equal(res.status,403);assert.equal((await res.json()).code,'ORIGIN_DENIED');
  res=await onRequest(request({cookie:''}));assert.equal(res.status,401);assert.equal((await res.json()).code,'PORTAL_ACCESS_DENIED');
  res=await onRequest(request({client:'',contract:'CONTRACT-A'}));assert.equal(res.status,400);
  assert.equal(count,0);
 }finally{globalThis.fetch=original}
});
test('fail closed when authoritative context differs from requested tenant',async()=>{
 const calls=[],reset=withStub(fixture({canonicalClient:'OTHER-TENANT'}),calls);
 try{
  const res=await onRequest(request());
  assert.equal(res.status,409);
  assert.equal((await res.json()).code,'CANONICAL_CONTEXT_SCOPE_MISMATCH');
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.method==='GET'&&x.auth==='Bearer CLIENT_FIXTURE_JWT'));
 }finally{reset()}
});
test('reject legacy document workflow deal that is missing from canonical resource scope',async()=>{
 const calls=[],reset=withStub(fixture({canonicalDeal:'DEAL-2099-001'}),calls);
 try{
  const res=await onRequest(request());
  assert.equal(res.status,502);
  assert.equal((await res.json()).code,'CANONICAL_RESOURCE_FACT_REQUIRED');
  assert.equal(calls.length,2);
 }finally{reset()}
});
test('compose verified realization state from scoped canonical resource, preserving Client-only authorization',async()=>{
 const calls=[],reset=withStub(fixture(),calls);
 try{
  const req=request({cookie:'rona_portal_at=CLIENT_FIXTURE_JWT; rona_admin_imp=UNVERIFIED_ADMIN_SESSION'});
  const res=await onRequest(req);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('x-rona-resource-authority'),'PORTAL_CONTEXT_CANONICAL_RESOURCE_V1');
  assert.equal(res.headers.get('cache-control'),'no-store, no-cache, must-revalidate');
  const body=await res.json();
  assert.equal(body.ok,true);
  assert.equal(body.deals.length,1);
  assert.equal(body.deals[0].deal_id,'DEAL-2026-007');
  assert.equal(body.deals[0].realization_status.source,'SERVER_AUTHORITATIVE_REALIZATION_V1');
  const stages=body.deals[0].realization_status.stages;
  assert.equal(stages.find(s=>s.key==='resource').state,'DONE');
  assert.equal(stages.find(s=>s.key==='payment').state,'CURRENT');
  assert.ok(calls.every(x=>x.auth==='Bearer CLIENT_FIXTURE_JWT'&&!x.impersonation));
 }finally{reset()}
});
