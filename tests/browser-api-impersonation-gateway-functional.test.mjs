import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/portal/api/[[path]].js';

const TAB='44444444-4444-4444-8444-444444444444';

function req(path,{cookie='',tab=''}={}){
  const headers=new Headers();
  if(cookie)headers.set('cookie',cookie);
  if(tab)headers.set('x-rona-impersonation-tab',tab);
  return new Request('https://ronaoil.com'+path,{method:'GET',headers});
}

test('browser Client API forwards opaque impersonation and tab to upstream',async()=>{
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init={})=>{
    calls.push({url:String(input),headers:new Headers(init.headers||{})});
    return new Response(JSON.stringify({ok:true,data:{contexts:[],price_authority:[]}}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const response=await onRequest({request:req('/portal/api/v1/client/bootstrap',{cookie:'rona_portal_at=ACCESS; rona_admin_imp=OPAQUE',tab:TAB})});
    assert.equal(response.status,200);
    assert.equal(calls.length,1);
    assert.equal(calls[0].headers.get('authorization'),'Bearer ACCESS');
    assert.equal(calls[0].headers.get('x-rona-admin-impersonation-token'),'OPAQUE');
    assert.equal(calls[0].headers.get('x-rona-impersonation-tab'),TAB);
    assert.ok(calls[0].headers.get('x-request-id'));
    assert.ok(calls[0].headers.get('x-correlation-id'));
  } finally { globalThis.fetch=original; }
});

test('impersonation cookie without valid tab fails closed before upstream',async()=>{
  let calls=0;
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;return new Response('{}',{status:200});};
  try{
    const response=await onRequest({request:req('/portal/api/v1/client/bootstrap',{cookie:'rona_portal_at=ACCESS; rona_admin_imp=OPAQUE'})});
    assert.equal(response.status,409);
    assert.equal(calls,0);
    assert.equal((await response.json()).code,'IMPERSONATION_TAB_INVALID');
  } finally { globalThis.fetch=original; }
});

test('Admin API never receives Client impersonation credential',async()=>{
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init={})=>{
    calls.push({url:String(input),headers:new Headers(init.headers||{})});
    return new Response(JSON.stringify({ok:true,data:{}}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const response=await onRequest({request:req('/portal/api/v1/admin/bootstrap',{cookie:'rona_portal_at=ACCESS; rona_admin_imp=OPAQUE',tab:TAB})});
    assert.equal(response.status,200);
    assert.equal(calls.length,1);
    assert.equal(calls[0].headers.get('x-rona-admin-impersonation-token'),null);
    assert.equal(calls[0].headers.get('x-rona-impersonation-tab'),null);
  } finally { globalThis.fetch=original; }
});
