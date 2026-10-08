import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

function gitBlobSha(text){
  const body=Buffer.from(text,'utf8');
  return createHash('sha1').update(Buffer.from(`blob ${body.length}\0`)).update(body).digest('hex');
}

test('admin Analytics accepts partial canonical live series without visual fallback failure',async()=>{
  const module=await import('../functions/portal/api/v1/admin/analytics.js?qa='+Date.now());
  const originalFetch=globalThis.fetch;
  const current={
    publication_id:'QA-ANALYTICS',
    status:'PUBLISHED',
    audience:'ALL_CLIENTS',
    authority_state:'VERIFIED',
    items:[{product:'АИ-92'}]
  };
  const canonical={
    version:'RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',
    cutoff:'06.10.2026',
    latestTradeDate:'06.10.2026',
    products:{
      AI92:{dates:['06.10'],values:[1232.25]},
      AI95:{dates:['06.10'],values:[1272.25]},
      DT:{dates:null,values:null},
      LPG:{dates:null,values:null}
    }
  };
  globalThis.fetch=async()=>new Response(JSON.stringify({currentAnalytics:current,canonicalAnalytics:canonical}),{
    status:200,
    headers:{'content-type':'application/json'}
  });
  try{
    const response=await module.onRequest({request:new Request('https://rona.test/portal/api/v1/admin/analytics',{
      method:'GET',
      headers:{cookie:'rona_portal_at=qa-access'}
    })});
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.ok,true);
    assert.deepEqual(body.data.canonicalAnalytics.products.DT.dates,[]);
    assert.deepEqual(body.data.canonicalAnalytics.products.LPG.values,[]);
    assert.deepEqual(body.data.canonicalAvailability.availableProducts,['AI92','AI95']);
    assert.deepEqual(body.data.canonicalAvailability.unavailableProducts,['DT','LPG']);
    assert.equal(body.data.canonicalAvailability.mode,'PARTIAL_SOURCE_SAFE');
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('admin live hydration accepts sourced forecast-only data but never treats empty series as a physical chart',async()=>{
  const source=await readFile('functions/portal/analytics-canonical-live-hydration.js','utf8');
  for(const token of [
    'function availablePayload(payload)',
    'dates.length!==values.length',
    'function hasSeries(',
    'const series=hasSeries(product),forecast=backedForecast(product,payload,key)',
    'if(!series&&!forecast)continue;',
    'const livePayload=availablePayload(payload)',
    'availableProducts:Object.keys(livePayload.products)'
  ])assert.ok(source.includes(token),`missing hydration guard: ${token}`);
});

test('Analytics visual freeze remains intact in both portal owners',async()=>{
  const adminVisual=await readFile('functions/portal/analytics-v2-approved-base.js','utf8');
  assert.equal(gitBlobSha(adminVisual),'64903cd0f64acd1250c103456ea12104e81445e0');

  const manifest=JSON.parse(await readFile('portal-src/current/client/manifest.json','utf8'));
  assert.equal(manifest.state,'CURRENT_ONLY');
  assert.equal(manifest.visual_transform,'NONE');
  assert.equal(manifest.sha256,'d07d7cbee5fd3466c8729861a6e6a6acb4ba463ad6d89dd7f748209cacab6183');
  assert.equal(manifest.decoded_bytes,484970);
});

test('client Analytics stays on safe published feed contract',async()=>{
  const runtime=await readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
  const pagesEndpoint=await readFile('functions/portal/api/v1/client/market-intelligence.js','utf8');
  const edgeIndex=await readFile('supabase/functions/rona-portal-api/index.ts','utf8');
  const edgeFeed=await readFile('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
  for(const token of ['/v1/client/market-intelligence','RONA_CLIENT_MARKET_INTELLIGENCE_V1','public_chart'])assert.ok(runtime.includes(token));
  assert.ok(pagesEndpoint.includes('EFFECTIVE_CLIENT_FEED_API'));
  assert.ok(edgeIndex.includes('clientMarketIntelligenceForEffectiveClient'));
  assert.ok(edgeIndex.includes('route==="/v1/client/market-intelligence"'));
  for(const token of [
    "p.status::text='PUBLISHED'",
    'pi.distribution_allowed=true',
    "coalesce(pi.metadata->>'publication_layer','')='DERIVED_ANALYTICS'",
    "lower(coalesce(pi.metadata->>'public_chart_ready','false'))='true'"
  ])assert.ok(edgeFeed.includes(token),`missing client safe-feed gate: ${token}`);
});
