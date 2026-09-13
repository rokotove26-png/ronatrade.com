import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as uiRequest } from '../functions/portal/prices-current-ui.js';
import { onRequest as apiRequest } from '../functions/portal/price-updates-api.js';

test('Prices UI is single-owner, server-authoritative and race-free', async () => {
  const response=await uiRequest({});
  assert.equal(response.status,200);
  const source=await response.text();
  for(const marker of [
    '__RONA_PRICES_RECOVERY_V2__',
    "api('workspace')",
    "api('bootstrap')",
    'Promise.allSettled',
    'full-functional-recovery-v2',
    'Текущий прайс-лист',
    'Публикация прайса',
    'Предложения по изменению цен',
    "api('apply'",
    "api('reject'",
    "api('audience'"
  ]) assert.ok(source.includes(marker),'missing marker: '+marker);
  assert.equal(source.includes('MutationObserver'),false,'Prices must not rebind via MutationObserver');
  assert.equal(source.includes("owner('/admin/bootstrap')"),false,'Prices must not depend on the generic Admin bootstrap');
  assert.equal(/RONA-PRICE-LIST-2026-[0-9]/.test(source),false,'current publication id must never be hardcoded into UI');
  assert.equal(/(?:purchase_price|sale_price|rona_margin)\s*[:=]\s*[0-9]{3,}/.test(source),false,'current commercial values must never be hardcoded into UI');
});

test('Prices UI degrades independent data planes instead of failing all-or-nothing', async () => {
  const source=await (await uiRequest({})).text();
  assert.ok(source.includes("results[0].status==='fulfilled'"));
  assert.ok(source.includes("results[1].status==='fulfilled'"));
  assert.ok(source.includes('workspaceError'));
  assert.ok(source.includes('updatesError'));
});

test('dedicated Prices API exposes read-only workspace through the sealed server RPC', async () => {
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,init={})=>{
    calls.push({url:String(url),init});
    if(String(url).endsWith('/rest/v1/rpc/owner_prices_admin_workspace')){
      return new Response(JSON.stringify({generatedAt:'2026-09-14T00:00:00Z',priceLists:[],items:[]}),{status:200,headers:{'content-type':'application/json'}});
    }
    throw new Error('unexpected fetch '+url);
  };
  try{
    const request=new Request('https://ronaoil.com/portal/price-updates-api?op=workspace',{headers:{cookie:'rona_portal_at=test-token'}});
    const response=await apiRequest({request});
    assert.equal(response.status,200);
    const payload=await response.json();
    assert.equal(payload.ok,true);
    assert.deepEqual(payload.data.priceLists,[]);
    assert.equal(calls.length,1);
    assert.match(calls[0].url,/owner_prices_admin_workspace$/);
    assert.equal(calls[0].init.method,'POST');
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test('dedicated Prices API preserves mutation guardrails', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async ()=>{throw new Error('network must not be reached')};
  try{
    const badApply=new Request('https://ronaoil.com/portal/price-updates-api?op=apply&id=not-a-uuid',{method:'POST',headers:{origin:'https://ronaoil.com','content-type':'application/json'},body:'{}'});
    const response=await apiRequest({request:badApply});
    assert.equal(response.status,400);
    assert.equal((await response.json()).code,'INVALID_PROPOSAL_ID');

    const crossOrigin=new Request('https://ronaoil.com/portal/price-updates-api?op=audience',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify({client:true,agent:true})});
    const blocked=await apiRequest({request:crossOrigin});
    assert.equal(blocked.status,403);
    assert.equal((await blocked.json()).code,'ORIGIN_DENIED');
  } finally {
    globalThis.fetch=originalFetch;
  }
});
