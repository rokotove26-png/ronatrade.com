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

    if(url.endsWith('/functions/v1/rona-portal-api/session/authority')){
      return new Response(JSON.stringify({ok:true,authority:'PORTAL_SESSION_AUTHORITY_V1',user:{id:'admin-user',roles:['ADMIN']}}),{
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
      assert.equal(headers.get('x-rona-impersonation-tab'),sessionId,'server-side Client gate must remain tab-bound');
      return new Response(JSON.stringify({
        ok:true,
        data:{
          contexts:[{client_id:'RONA-QA-CLIENT',contract_id:'RONA-QA-CTR'}],
          selected_context:{client_id:'RONA-QA-CLIENT',contract_id:'RONA-QA-CTR'}
        }
      }),{status:200,headers:{'content-type':'application/json'}});
    }

    throw new Error('UNEXPECTED_FETCH '+url);
  };

  const source='<!doctype html><html><head><script>window.__CANONICAL_CLIENT_BOOT__=true</script></head><body><main>canonical-client-shell</main></body></html>';
  const request=new Request('https://ronaoil.com/portal/client?impSession='+sessionId,{
    method:'GET',
    headers:{cookie:'rona_portal_at=valid-admin-access; rona_admin_imp=opaque-impersonation-token'}
  });
  const response=await onRequest({
    request,
    next:async()=>new Response(source,{
      status:200,
      headers:{'content-type':'text/html; charset=utf-8'}
    })
  });

  assert.equal(response.status,200,'impersonated Client shell must be served');
  assert.equal(response.headers.get('x-rona-client-impersonation-shell'),'static-plus-radio-runtime-and-header-bridge-v2');
  const selectors=new Set(registrations.map(x=>x.selector));
  assert.ok(selectors.has('head'),'impersonated Client shell must prepend the bounded Admin return bridge');
  assert.ok(selectors.has('body'),'impersonated Client shell must append the bounded Radio/claims-retire runtime');
  for(const selector of ['[data-page="claims"]','#page-claims','[data-section="claims"]','script[src*="claims"]','script[id*="claims"]','link[href*="claims"]']){
    assert.ok(selectors.has(selector),'retired Claims surface must be removed from impersonated Client shell: '+selector);
  }
  const body=await response.text();
  assert.equal(body,source,'fake HTMLRewriter transport must preserve fixture bytes while proving the registered transformation contract');
  assert.match(response.headers.get('content-security-policy')||'',/script-src 'self' 'unsafe-inline'/);

  console.log('ADMIN_CLIENT_IMPERSONATION_STATIC_SHELL=PASS radio_runtime=bounded header_bridge=v2 claims=retired native_tab_binding=preserved');
} finally {
  globalThis.fetch=originalFetch;
  if(originalRewriter===undefined) delete globalThis.HTMLRewriter;
  else globalThis.HTMLRewriter=originalRewriter;
}
