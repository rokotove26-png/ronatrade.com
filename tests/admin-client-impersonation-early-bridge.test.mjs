import assert from 'node:assert/strict';
import { onRequest } from '../functions/portal/[[path]].js';

const sessionId='22222222-2222-4222-8222-222222222222';
const originalFetch=globalThis.fetch;
const originalRewriter=globalThis.HTMLRewriter;
const registrations=[];

class FakeHTMLRewriter {
  on(selector,handler){
    registrations.push({selector,handlerName:handler?.constructor?.name||'',value:String(handler?.value||'')});
    return this;
  }
  transform(response){ return response; }
}

try {
  globalThis.HTMLRewriter=FakeHTMLRewriter;
  globalThis.fetch=async (input,init={})=>{
    const url=String(input);
    const headers=new Headers(init?.headers||{});

    if(url.endsWith('/functions/v1/rona-portal-api/session/me')){
      return new Response(JSON.stringify({ok:true,user:{id:'admin-user',roles:['ADMIN']}}),{
        status:200,headers:{'content-type':'application/json'}
      });
    }

    if(url.endsWith('/functions/v1/rona-admin-control-plane/impersonation/resolve')){
      assert.equal(headers.get('x-rona-admin-impersonation-token'),'opaque-impersonation-token');
      return new Response(JSON.stringify({
        ok:true,
        data:{
          id:sessionId,
          effectiveRole:'CLIENT',
          returnView:'companies',
          targetClientKey:'client-key'
        }
      }),{status:200,headers:{'content-type':'application/json'}});
    }

    if(url.endsWith('/functions/v1/rona-portal-api/v1/client/bootstrap')){
      assert.equal(headers.get('x-rona-admin-impersonation-token'),'opaque-impersonation-token');
      assert.equal(headers.get('x-rona-impersonation-tab'),sessionId,'server-side Client gate must be tab-bound');
      return new Response(JSON.stringify({
        ok:true,
        data:{
          contexts:[{client_id:'RONA-C002',contract_id:'RONA-C002-CTR-2026-001'}],
          selected_context:{client_id:'RONA-C002',contract_id:'RONA-C002-CTR-2026-001'}
        }
      }),{status:200,headers:{'content-type':'application/json'}});
    }

    throw new Error('UNEXPECTED_FETCH '+url);
  };

  const request=new Request('https://ronaoil.com/portal/client?impSession='+sessionId,{
    method:'GET',
    headers:{
      cookie:'rona_portal_at=valid-admin-access; rona_admin_imp=opaque-impersonation-token'
    }
  });
  const response=await onRequest({
    request,
    next:async()=>new Response('<!doctype html><html><head><script>window.__EARLY_CLIENT_BOOT__=true</script></head><body><main>client</main></body></html>',{
      status:200,
      headers:{'content-type':'text/html; charset=utf-8'}
    })
  });

  assert.equal(response.status,200,'impersonated Client shell must be served');
  const head=registrations.find(x=>x.selector==='head');
  assert.ok(head,'impersonation bridge must be installed through the head rewriter');
  assert.equal(head.handlerName,'HeadPrepend','bridge must prepend before canonical Client scripts');
  assert.match(head.value,/rona-admin-impersonation-return/,'early bridge must be the Admin impersonation bridge');
  assert.match(head.value,/x-rona-impersonation-tab/,'early bridge must attach the tab-bound header');
  assert.ok(!registrations.some(x=>x.selector==='body'&&x.value.includes('rona-admin-impersonation-return')),
    'impersonation bridge must not be appended after canonical Client boot');

  console.log('ADMIN_CLIENT_IMPERSONATION_EARLY_BRIDGE=PASS');
} finally {
  globalThis.fetch=originalFetch;
  if(originalRewriter===undefined) delete globalThis.HTMLRewriter;
  else globalThis.HTMLRewriter=originalRewriter;
}
