import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/portal/admin-authority/[[path]].js';

const ui = readFileSync('functions/portal/clients-agents-current-ui.js','utf8');
assert.ok(ui.includes("await auth('/impersonation/start'"), 'UI must use canonical JSON impersonation start');
assert.ok(ui.includes("'x-rona-admin-handoff':'clients-agents-v8'"), 'UI must bind the handoff to an explicit non-form browser intent');
assert.ok(ui.includes("window.location.assign(targetPath+'?impSession='"), 'UI must navigate only after server handoff succeeds');
assert.ok(!ui.includes("form.action=AUTH+'/impersonation/enter'"), 'legacy browser form POST handoff must stay retired');

const sessionId='11111111-1111-4111-8111-111111111111';
const originalFetch=globalThis.fetch;
const calls=[];

try {
  globalThis.fetch=async (input,init={})=>{
    const url=String(input);
    const bodyText=init?.body instanceof ArrayBuffer
      ? new TextDecoder().decode(new Uint8Array(init.body))
      : ArrayBuffer.isView(init?.body)
        ? new TextDecoder().decode(init.body)
        : init?.body ? String(init.body) : '';
    calls.push({url,method:String(init?.method||'GET'),body:bodyText});
    if(url.endsWith('/functions/v1/rona-portal-api/session/me')){
      return new Response(JSON.stringify({ok:true,user:{id:'admin-user',roles:['ADMIN']}}),{
        status:200,headers:{'content-type':'application/json'}
      });
    }
    if(url.endsWith('/functions/v1/rona-admin-control-plane/impersonation/start')){
      const requestBody=JSON.parse(bodyText||'{}');
      assert.deepEqual(requestBody,{kind:'COMPANY',entityId:'RONA-C001',targetPortalUserId:null});
      return new Response(JSON.stringify({
        ok:true,
        data:{
          impersonationToken:'opaque-server-only-secret',
          impersonation:{id:sessionId,expiresAt:new Date(Date.now()+600000).toISOString()},
          targetPath:'/portal/client'
        }
      }),{status:200,headers:{'content-type':'application/json'}});
    }
    throw new Error('UNEXPECTED_FETCH '+url);
  };

  const request=new Request('https://ronaoil.com/portal/admin-authority/impersonation/start',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-rona-admin-handoff':'clients-agents-v8',
      accept:'application/json',
      cookie:'rona_portal_at=valid-admin-access'
    },
    body:JSON.stringify({kind:'COMPANY',entityId:'RONA-C001',targetPortalUserId:null})
  });
  const response=await onRequest({request});
  assert.equal(response.status,200,'canonical JSON handoff must succeed');
  const body=await response.json();
  assert.equal(body?.ok,true);
  assert.equal(body?.data?.targetPath,'/portal/client');
  assert.equal(body?.data?.impersonation?.id,sessionId);
  assert.equal(body?.data?.impersonationToken,undefined,'opaque token must never reach browser JSON');
  const setCookie=response.headers.get('set-cookie')||'';
  assert.match(setCookie,/rona_admin_imp=opaque-server-only-secret/,'server must persist opaque impersonation token');
  assert.match(setCookie,/HttpOnly/,'impersonation cookie must be HttpOnly');
  assert.match(setCookie,/SameSite=Strict/,'impersonation cookie must be SameSite=Strict');
  assert.equal(calls.filter(x=>x.url.includes('/impersonation/start')).length,1,'control-plane start must run exactly once');

  globalThis.fetch=async()=>{throw new Error('foreign-origin request reached upstream')};
  const foreign=new Request('https://ronaoil.com/portal/admin-authority/impersonation/start',{
    method:'POST',
    headers:{
      origin:'https://evil.example',
      'sec-fetch-site':'cross-site',
      'content-type':'application/json',
      'x-rona-admin-handoff':'clients-agents-v8',
      cookie:'rona_portal_at=valid-admin-access'
    },
    body:'{}'
  });
  const denied=await onRequest({request:foreign});
  assert.equal(denied.status,403,'foreign origin must remain blocked');
  assert.equal((await denied.json()).code,'ORIGIN_DENIED');
} finally {
  globalThis.fetch=originalFetch;
}

console.log('ADMIN_IMPERSONATION_JSON_HANDOFF=PASS');
