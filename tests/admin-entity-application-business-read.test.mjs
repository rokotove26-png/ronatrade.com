import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplicationBusinessHandler} from '../supabase/functions/_shared/client-application-business-v2/handler.mjs';

const KPI={source:'RONA_APPLICATION_BUSINESS_V2',total:0,active:0,new:0,in_work:0,decision:0,completed:0,deal_registered:0,tonnage:0,amounts:null};
const projection={contract:'RONA_APPLICATION_BUSINESS_V2',applications:[],application_kpi:KPI};

function makeSql({scope=true,portalUserScope=true}={}){
  const calls=[];
  const sql=async(strings,...values)=>{
    const text=String.raw({raw:strings},...values.map(()=>'?'));
    calls.push({text,values});
    if(text.includes('from portal_private.client_user_bindings b'))return portalUserScope?[{contract_key:'97dc00d5-6fae-5eab-a987-7a6ea0cec6fa'}]:[];
    if(text.includes('from portal_private.clients cl'))return scope?[{ok:1}]:[];
    if(text.includes("application_business_projection_v2('CLIENT'"))return [{projection}];
    if(text.includes('application_business_authorized_v2'))return [{projection}];
    throw new Error('unexpected SQL: '+text);
  };
  sql.calls=calls;
  return sql;
}
function base(clientId='RONA-C001',contractId='RONA-C001-CTR-2026-001'){
  return new Response(JSON.stringify({ok:true,data:{contract:{client_id:clientId,contract_id:contractId},applications:[]}}),{status:200,headers:{'content-type':'application/json'}});
}
function req(clientId='RONA-C001',contractId='RONA-C001-CTR-2026-001'){
  return new Request(`https://ronaoil.com/functions/v1/rona-portal-api/v1/client/context?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`,{method:'GET'});
}
const apiRoute=url=>{const marker='/rona-portal-api';const at=url.pathname.indexOf(marker);return at>=0?(url.pathname.slice(at+marker.length)||'/'):url.pathname;};

test('Admin entity Client read uses target-bound projection instead of real Client role RPC',async()=>{
  const sql=makeSql();
  const authenticate=async()=>({
    auth:'11111111-1111-4111-8111-111111111111',
    sid:'22222222-2222-4222-8222-222222222222',
    user:'33333333-3333-4333-8333-333333333333',
    roles:['CLIENT'],
    impersonation:{
      id:'44444444-4444-4444-8444-444444444444',
      effectiveRole:'CLIENT',
      subjectMode:'ADMIN_ENTITY',
      readOnly:true,
      targetClientKey:'9e0c2198-440b-5a57-8cc6-79c667ce8380'
    }
  });
  const handler=createApplicationBusinessHandler(async()=>base(),{sql,authenticate,apiRoute});
  const response=await handler(req(),{});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.data.application_business_contract,'RONA_APPLICATION_BUSINESS_V2');
  assert.ok(sql.calls.some(c=>c.text.includes('from portal_private.clients cl')&&c.values.includes('9e0c2198-440b-5a57-8cc6-79c667ce8380')));
  assert.ok(sql.calls.some(c=>c.text.includes("application_business_projection_v2('CLIENT'")));
  assert.equal(sql.calls.some(c=>c.text.includes('application_business_authorized_v2')),false);
});

test('Admin entity Client read fails closed when requested contract is outside impersonation target',async()=>{
  const sql=makeSql({scope:false});
  const authenticate=async()=>({
    auth:'11111111-1111-4111-8111-111111111111',
    sid:'22222222-2222-4222-8222-222222222222',
    user:'33333333-3333-4333-8333-333333333333',
    roles:['CLIENT'],
    impersonation:{
      id:'44444444-4444-4444-8444-444444444444',
      effectiveRole:'CLIENT',
      subjectMode:'ADMIN_ENTITY',
      readOnly:true,
      targetClientKey:'9e0c2198-440b-5a57-8cc6-79c667ce8380'
    }
  });
  const handler=createApplicationBusinessHandler(async()=>base(),{sql,authenticate,apiRoute});
  const response=await handler(req(),{});
  assert.equal(response.status,403);
  assert.equal((await response.json()).code,'APPLICATION_SCOPE_DENIED');
  assert.equal(sql.calls.some(c=>c.text.includes("application_business_projection_v2('CLIENT'")),false);
});

test('Portal-user Client impersonation reads through the target user binding, not the actor Admin session',async()=>{
  const sql=makeSql();
  const authenticate=async()=>({
    auth:'11111111-1111-4111-8111-111111111111',
    sid:'22222222-2222-4222-8222-222222222222',
    user:'65d78d10-3722-4dba-9d77-8252e7c62527',
    roles:['CLIENT'],
    impersonation:{
      id:'55555555-5555-4555-8555-555555555555',
      effectiveRole:'CLIENT',
      subjectMode:'PORTAL_USER',
      readOnly:false,
      effectiveUserId:'65d78d10-3722-4dba-9d77-8252e7c62527',
      targetClientKey:'f4029d84-325d-5fb0-8347-a77ffd6a4824'
    }
  });
  const handler=createApplicationBusinessHandler(
    async()=>base('RONA-C002','RONA-C002-CTR-2026-001'),
    {sql,authenticate,apiRoute}
  );
  const response=await handler(req('RONA-C002','RONA-C002-CTR-2026-001'),{});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.data.application_business_contract,'RONA_APPLICATION_BUSINESS_V2');
  assert.ok(sql.calls.some(c=>
    c.text.includes('from portal_private.client_user_bindings b')&&
    c.values.includes('65d78d10-3722-4dba-9d77-8252e7c62527')&&
    c.values.includes('f4029d84-325d-5fb0-8347-a77ffd6a4824')
  ));
  assert.ok(sql.calls.some(c=>
    c.text.includes("application_business_projection_v2('CLIENT'")&&
    c.text.includes('client_user_has_deal_access')
  ));
  assert.equal(sql.calls.some(c=>c.text.includes('application_business_authorized_v2')),false);
});

test('Portal-user Client impersonation fails closed outside the target user binding',async()=>{
  const sql=makeSql({portalUserScope:false});
  const authenticate=async()=>({
    auth:'11111111-1111-4111-8111-111111111111',
    sid:'22222222-2222-4222-8222-222222222222',
    user:'65d78d10-3722-4dba-9d77-8252e7c62527',
    roles:['CLIENT'],
    impersonation:{
      id:'55555555-5555-4555-8555-555555555555',
      effectiveRole:'CLIENT',
      subjectMode:'PORTAL_USER',
      readOnly:false,
      effectiveUserId:'65d78d10-3722-4dba-9d77-8252e7c62527',
      targetClientKey:'f4029d84-325d-5fb0-8347-a77ffd6a4824'
    }
  });
  const handler=createApplicationBusinessHandler(
    async()=>base('RONA-C002','RONA-C002-CTR-2026-001'),
    {sql,authenticate,apiRoute}
  );
  const response=await handler(req('RONA-C002','RONA-C002-CTR-2026-001'),{});
  assert.equal(response.status,403);
  assert.equal((await response.json()).code,'APPLICATION_SCOPE_DENIED');
  assert.equal(sql.calls.some(c=>c.text.includes("application_business_projection_v2('CLIENT'")),false);
  assert.equal(sql.calls.some(c=>c.text.includes('application_business_authorized_v2')),false);
});

test('Normal Client read keeps existing session-authorized projection path',async()=>{
  const sql=makeSql();
  const authenticate=async()=>({
    auth:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    user:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    roles:['CLIENT']
  });
  const handler=createApplicationBusinessHandler(async()=>base(),{sql,authenticate,apiRoute});
  const response=await handler(req(),{});
  assert.equal(response.status,200);
  assert.ok(sql.calls.some(c=>c.text.includes('application_business_authorized_v2')));
  assert.equal(sql.calls.some(c=>c.text.includes("application_business_projection_v2('CLIENT'")),false);
});
