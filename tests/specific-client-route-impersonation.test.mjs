import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as bootstrapRoute } from '../functions/portal/api/v1/client/bootstrap.js';
import { onRequest as contextRoute } from '../functions/portal/api/v1/client/context.js';
import { onRequest as marketRoute } from '../functions/portal/api/v1/client/market-intelligence.js';

const TAB='55555555-5555-4555-8555-555555555555';
const COOKIE='rona_portal_at=ACCESS; rona_admin_imp=OPAQUE';

function request(path,{tab=TAB,cookie=COOKIE}={}){
  const headers=new Headers();
  if(cookie)headers.set('cookie',cookie);
  if(tab)headers.set('x-rona-impersonation-tab',tab);
  return new Request('https://ronaoil.com'+path,{method:'GET',headers});
}

test('specific Client bootstrap route forwards impersonation to canonical Edge bootstrap',async()=>{
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init={})=>{
    const url=String(input);
    const headers=new Headers(init.headers||{});
    calls.push({url,headers});
    if(url.includes('/functions/v1/rona-portal-api/v1/client/bootstrap')){
      return new Response(JSON.stringify({ok:true,data:{contexts:[],price_authority:[],company_directory:[],company_directory_source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'}}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.includes('/rest/v1/rpc/portal_client_recent_event_results_v1')){
      return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
    }
    throw new Error('unexpected fetch '+url);
  };
  try{
    const response=await bootstrapRoute({request:request('/portal/api/v1/client/bootstrap')});
    assert.equal(response.status,200);
    const upstream=calls.find(x=>x.url.includes('/functions/v1/rona-portal-api/v1/client/bootstrap'));
    assert.ok(upstream);
    assert.equal(upstream.headers.get('authorization'),'Bearer ACCESS');
    assert.equal(upstream.headers.get('x-rona-admin-impersonation-token'),'OPAQUE');
    assert.equal(upstream.headers.get('x-rona-impersonation-tab'),TAB);
    assert.ok(upstream.headers.get('x-request-id'));
    assert.ok(upstream.headers.get('x-correlation-id'));
  } finally { globalThis.fetch=original; }
});

test('specific Client context route forwards impersonation to canonical Edge context',async()=>{
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init={})=>{
    const url=String(input);
    const headers=new Headers(init.headers||{});
    calls.push({url,headers});
    if(url.includes('/functions/v1/rona-portal-api/v1/client/context')){
      return new Response(JSON.stringify({ok:true,data:{contract:{client_id:'RONA-C001',contract_id:'RONA-C001-CTR-2026-001'},applications:[]}}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.includes('/functions/v1/rona-owner-acceptance/client/bootstrap')){
      return new Response(JSON.stringify({ok:false,code:'OPTIONAL_SOURCE_UNAVAILABLE'}),{status:403,headers:{'content-type':'application/json'}});
    }
    throw new Error('unexpected fetch '+url);
  };
  try{
    const response=await contextRoute({request:request('/portal/api/v1/client/context?clientId=RONA-C001&contractId=RONA-C001-CTR-2026-001')});
    assert.equal(response.status,200);
    const upstream=calls.find(x=>x.url.includes('/functions/v1/rona-portal-api/v1/client/context'));
    assert.ok(upstream);
    assert.equal(upstream.headers.get('authorization'),'Bearer ACCESS');
    assert.equal(upstream.headers.get('x-rona-admin-impersonation-token'),'OPAQUE');
    assert.equal(upstream.headers.get('x-rona-impersonation-tab'),TAB);
  } finally { globalThis.fetch=original; }
});


test('specific Client market-intelligence route uses effective Client impersonation authority',async()=>{
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init={})=>{
    const url=String(input);
    const headers=new Headers(init.headers||{});
    calls.push({url,headers});
    if(url.includes('/functions/v1/rona-portal-api/v1/client/market-intelligence')){
      return new Response(JSON.stringify({ok:true,data:{version:'RONA_CLIENT_MARKET_INTELLIGENCE_V1',generated_at:'2026-09-21T09:00:00Z',server_date:'2026-09-21',timezone:'Europe/Moscow',analytics:[],news:[]}}),{status:200,headers:{'content-type':'application/json'}});
    }
    throw new Error('unexpected fetch '+url);
  };
  try{
    const response=await marketRoute({request:request('/portal/api/v1/client/market-intelligence')});
    assert.equal(response.status,200);
    const upstream=calls.find(x=>x.url.includes('/functions/v1/rona-portal-api/v1/client/market-intelligence'));
    assert.ok(upstream);
    assert.equal(upstream.headers.get('authorization'),'Bearer ACCESS');
    assert.equal(upstream.headers.get('x-rona-admin-impersonation-token'),'OPAQUE');
    assert.equal(upstream.headers.get('x-rona-impersonation-tab'),TAB);
    assert.ok(upstream.headers.get('x-request-id'));
    assert.ok(upstream.headers.get('x-correlation-id'));
    assert.equal(calls.some(x=>x.url.includes('/rest/v1/rpc/owner_client_market_intelligence_feed_v1')),false);
  } finally { globalThis.fetch=original; }
});

test('specific Client routes fail closed when impersonation cookie lacks valid tab binding',async()=>{
  let calls=0;
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;return new Response('{}',{status:200});};
  try{
    const b=await bootstrapRoute({request:request('/portal/api/v1/client/bootstrap',{tab:''})});
    const c=await contextRoute({request:request('/portal/api/v1/client/context?clientId=RONA-C001&contractId=RONA-C001-CTR-2026-001',{tab:''})});
    const m=await marketRoute({request:request('/portal/api/v1/client/market-intelligence',{tab:''})});
    assert.equal(b.status,409);
    assert.equal(c.status,409);
    assert.equal(m.status,409);
    assert.equal((await b.json()).code,'IMPERSONATION_TAB_INVALID');
    assert.equal((await c.json()).code,'IMPERSONATION_TAB_INVALID');
    assert.equal((await m.json()).code,'IMPERSONATION_TAB_INVALID');
    assert.equal(calls,0);
  } finally { globalThis.fetch=original; }
});
