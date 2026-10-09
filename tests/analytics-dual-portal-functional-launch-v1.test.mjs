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
    'const series=hasSeries(product,key),forecast=backedForecast(product,payload,key)',
    'const term=null; // Maturity months cannot be charted as daily observations.',
    'if(!series&&!forecast&&!term)continue;',
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

test('Client Analytics v14 consumes identical approved Admin canonical data with NO section-specific Client restrictions',async()=>{
  const client=await readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
  const edge=await readFile('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
  const admin=await readFile('functions/portal/analytics-v2-ui.js','utf8');
  const endpoint=await readFile('functions/portal/analytics-client-approved-runtime-v14.js','utf8');
  const shared=await readFile('functions/portal/analytics-canonical-presenter-v14.js','utf8');
  const migration=await readFile('supabase/migrations/20261009233000_client_analytics_exact_admin_shared_v14.sql','utf8');
  const approval=JSON.parse(await readFile('governance/client-analytics-admin-shared-v14-owner-approval-20261009.json','utf8'));
  assert.equal(approval.approval,'OWNER_IN_CHAT');
  assert.equal(approval.scope,'CLIENT_ANALYTICS_ADMIN_CANONICAL_SHARED_V14');
  assert.equal(approval.requirements.no_client_specific_product_forecast_pricing_or_presentation_filters,true);
  assert.equal(approval.requirements.client_section_data_not_filtered_by_tenant_contract_publication,true);
  assert.equal(approval.requirements.authentication_of_client_cabinet_still_mandatory,true);
  for(const [path,entry] of Object.entries(approval.exact_post_blobs))
    assert.equal(entry.authorized_post_blob_sha,gitBlobSha(await readFile(path,'utf8')),path+' exact approved blob');
  for(const text of ["portal_private.market_intelligence_admin_client_shared_payload_v14","market_intelligence_admin_canonical_payload_v1","market_intelligence_daily_monitor_v1","market_intelligence_admin_forward_term_structure_v1","market_intelligence_forecast_snapshots"])
    assert.ok(migration.includes(text),'Admin forecast/daily SQL proof missing '+text);
  assert.ok(migration.includes("v:=jsonb_build_object('canonicalAnalytics',portal_private.market_intelligence_admin_canonical_payload_v1());"));
  assert.ok(migration.includes("RETURN v->'canonicalAnalytics';"));
  for(const marker of [
    'market_intelligence_admin_client_shared_payload_v14()',
    'payload.clientCanonicalAnalytics = canonical;',
    "payload.analyticsCanonicalParity = 'ADMIN_APPROVED_SHARED_V14'",
    "c.roles.includes(\"CLIENT\")","c.impersonation?.effectiveRole"
  ])assert.ok(edge.includes(marker),'full Admin client feed proof missing '+marker);
  for(const no of ["permissionToForecast","forecastPermissions","publicNames.has","clientCanonicalAnalytics = null; // all products filtered"])
    assert.equal(edge.includes(no),false,'Client Analytics cannot filter Admin '+no);
  for(const token of [
    "const MARK='20261009-admin-canonical-shared-presenter-v14'",
    "const CLIENT_CANONICAL_PARITY='ADMIN_APPROVED_SHARED_V14'",
    "const ADMIN_SHARED_PRESENTER_SRC='/portal/analytics-client-approved-runtime-v14'",
    "data.analyticsCanonicalParity===CLIENT_CANONICAL_PARITY",
    'return approved;',
    "shared.apply(owner,payload,{mode:'client'})",
    'view.setPayload(payload)'
  ])assert.ok(client.includes(token),'exact Admin Client view proof missing '+token);
  assert.equal(client.includes('paintAuthorizedPrices(owner,chosen)'),false,'no Client-specific contract price overrides');
  assert.equal(client.includes("fetch('/portal/api/v1/admin/analytics'"),false,'client cannot open Admin endpoint');
  assert.ok(admin.includes('SHARED_ANALYTICS_PRESENTER_V14'));
  assert.ok(endpoint.includes('CANONICAL_PRICING_BRIDGE_RUNTIME+'));
  assert.ok(endpoint.includes('SHARED_ANALYTICS_PRESENTER_V14+LPG_GAP_RUNTIME'));
  assert.ok(shared.includes('ADMIN_APPROVED_SHARED_V14'));
  assert.ok(edge.includes('pi.distribution_allowed=true'),'other publication/news gates remain unchanged');
});

test('Admin and Client share the identical observed-day chart contract, never a delivery maturity line',async()=>{
  const db=await readFile('supabase/migrations/20261009221000_lpg_verified_observation_segments_v13.sql','utf8');
  const shared=await readFile('functions/portal/analytics-canonical-presenter-v14.js','utf8');
  const graph=await readFile('functions/portal/lpg-observation-gap-runtime-v13.js','utf8');
  const adminHydration=await readFile('functions/portal/analytics-canonical-live-hydration.js','utf8');
  const admin=await readFile('functions/portal/analytics-v2-ui.js','utf8');
  const client=await readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
  for(const item of ['historyIncludesAllGapSegments','segmentIds','gapBeforeDays','segmentCount','WHERE true'])
    assert.ok(db.includes(item),'audited raw LPG source segment rule missing '+item);
  for(const marker of ['sourceFamily','observedDates','noInterpolation','dates','values','ADMIN_APPROVED_SHARED_V14'])
    assert.ok(shared.includes(marker),'common daily history presenter missing '+marker);
  for(const marker of ['new Set(ids.map(Number))','path.rmc-area','ids[i-1]','Date.parse','rmc-point'])
    assert.ok(graph.includes(marker),'unobserved dates must not become fake lines '+marker);
  assert.ok(adminHydration.includes('const term=null; // Maturity months cannot be charted as daily observations.'));
  assert.ok(admin.includes('SHARED_ANALYTICS_PRESENTER_V14'));
  assert.ok(client.includes('ADMIN_SHARED_PRESENTER_SRC'));
  assert.equal(client.includes('paintAuthorizedPrices(owner,chosen)'),false);
});
