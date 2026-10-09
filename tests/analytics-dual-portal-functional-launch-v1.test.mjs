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

test('client canonical Admin daily observation parity v12 uses the SAME source model with strict published client gates',async()=>{
  const runtime=await readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
  const edge=await readFile('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
  const render=await readFile('scripts/attach-client-market-intelligence-v1.mjs','utf8');
  const approval=JSON.parse(await readFile('governance/lpg-daily-history-v13-owner-approval-20261009.json','utf8'));
  assert.equal(approval.approval,'OWNER_IN_CHAT');
  assert.equal(approval.scope,'ANALYTICS_LPG_GAP_HISTORY_V13');
  assert.equal(approval.requirements.wildcard_exception,false);
  assert.equal(approval.requirements.client_native_an2_graph_preserved,true);
  assert.equal(approval.requirements.context_switch_fail_closed,true);
  assert.equal(approval.requirements.no_admin_internal_margin_or_price_bridge_in_client,true);
  assert.deepEqual(approval.approved_protected_files,[
    'assets/portal-runtime/client-market-intelligence-v1.js',
    'scripts/attach-client-market-intelligence-v1.mjs'
  ]);
  for(const [path,entry] of Object.entries(approval.exact_post_blobs))
    assert.equal(entry.authorized_post_blob_sha,gitBlobSha(await readFile(path,'utf8')),path+' exact blob');
  for(const token of [
    'market_intelligence_daily_monitor_v1',
    'RONA_MARKET_OBSERVED_DAILY_V1',
    'dailyApproved',
    'daily?.granularity === "OBSERVATION_DATE"',
    'daily?.noInterpolation === true',
    'observedDates.length === dailyDates.length',
    'CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14',
    'forecastGrantRows',
    'forecastPermissions',
    'spotFreshness',
    'sd.processing_state=\'INGESTED\'',
    "sd.data_status='CONFIRMED'",
    'permissionToForecast("DT")',
    'permissionToForecast("LPG")',
    'forecastSourceCurrent',
    'term.asOfDate === lastSourceDate.slice(8,10)',
    'authorizedClientKeys(c)',"pi.distribution_allowed=true",
    "p.status::text='PUBLISHED'",")='CURRENT'",
    'market_intelligence_admin_canonical_payload_v1()',
    'model_version',"'RONA_FULL_PLATTS_CURVE_V1'",
    'CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14',
    'targetIsFuture',
    'Math.abs(Number(term.values[1])-Number(output.forecast.base))<0.001'
  ])assert.ok(edge.includes(token),'source-locked client canonical gate missing: '+token);
  for(const token of [
    "const MARK='20261010-client-approved-admin-single-engine-v14'",
    "const CLIENT_CANONICAL_PARITY='CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14'",
    'function canonicalPayload(data)',
    'data?.clientCanonicalAnalytics',
    'view.setPayload(payload)',
    'publishedPriceContext()',
    'paintAuthorizedPrices(owner,chosen)'
  ])assert.ok(runtime.includes(token),'frozen client runtime missing: '+token);
  assert.ok(render.includes('client-market-intelligence-v1.js?v=20261010-client-approved-admin-single-engine-v14'));
  assert.equal(runtime.includes("fetch('/portal/api/v1/admin/analytics'"),false,'client must not fetch Admin API');
  assert.equal(edge.includes('payload.clientCanonicalAnalytics = canonical'),false,'never expose unsanitized admin canonical payload');
  assert.equal(edge.includes('output.rona ='),false,'never expose internal RONA price bridge');
  assert.equal(edge.includes("update portal_private."),false,'client projection must be read only');
});


test('Admin and Client daily observation graph contract rejects monthly-maturity interpolation',async()=>{
  const migration=await readFile(
    'supabase/migrations/20261009180500_analytics_daily_observed_dt_lpg_v12.sql','utf8');
  const admin=await readFile('functions/portal/analytics-canonical-live-hydration.js','utf8');
  const client=await readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
  for(const token of [
    'CREATE OR REPLACE FUNCTION portal_private.market_intelligence_daily_monitor_v1',
    "s.source_family='PLATTS'",
    "s.processing_state='INGESTED'",
    "s.data_status='CONFIRMED'",
    "f.basis='Cargoes CIF NWE/Basis ARA'",
    "f.basis='CIF NWE Large Cargo Financial'",
    "f.delivery_month=date_trunc('month',p_reference_date)::date",
    "WHEN prev_date IS NOT NULL AND as_of_date-prev_date>10",
    "'granularity','OBSERVATION_DATE'",
    "'noInterpolation',true",
    "'notMonthlyMaturityCurve',true",
    "REVOKE ALL ON FUNCTION portal_private.market_intelligence_daily_monitor_v1",
    "v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'dailyMonitor']"
  ])assert.ok(migration.includes(token),'missing audited daily series source rule '+token);
  assert.ok(admin.includes("source-safe-v4-observation-daily"),'admin must share daily monitor');
  assert.ok(admin.includes('const term=null; // Maturity months cannot be charted as daily observations.'));
  assert.ok(!admin.includes("safe.dates=[...term.dates]"),'admin maturity labels must never replace observed dates');
  assert.ok(client.includes("if(empty)empty.remove()"),'all four products must remove obsolete no-publication overlay when graph present');
  assert.ok(client.includes('CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14'));
  assert.ok(!client.includes("hasTerm?product.termCurve.asOfDate"),'client must not use last delivery as trade date');
  assert.ok(client.includes("dates.every(d=>"),'monthly term labels rejected for main chart');
});

test('LPG v13 source-gap history retains verified same-contract dates but draws no cross-gap line',async()=>{
  const db=await readFile('supabase/migrations/20261009221000_lpg_verified_observation_segments_v13.sql','utf8');
  const api=await readFile('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
  const client=await readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
  const renderer=await readFile('functions/portal/lpg-observation-gap-runtime-v13.js','utf8');
  const page=await readFile('functions/portal/analytics-v2-ui.js','utf8');
  for(const marker of ['historyIncludesAllGapSegments','segmentIds','gapBeforeDays','segmentCount','WHERE true'])
    assert.ok(db.includes(marker),'LPG gap-aware DB proof missing '+marker);
  for(const marker of ['segmentIds','observedDates','historyIncludesAllGapSegments','CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14'])
    assert.ok(api.includes(marker),'safe client projection absent '+marker);
  assert.ok(client.includes('ronaLpgHistorySegments'),'client must expose source-provenanced gaps');
  assert.ok(page.includes('LPG_GAP_RUNTIME'),'Admin and Client should share gap-aware graph painter');
  for(const marker of ['new Set(ids.map(Number))','path.rmc-area','ids[i-1]','Date.parse','rmc-point'])
    assert.ok(renderer.includes(marker),'gap-free visualization marker missing '+marker);
});
