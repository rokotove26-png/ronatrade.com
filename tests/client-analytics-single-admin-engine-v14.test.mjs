import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  onRequest as approvedAdminUi,
  CANONICAL_PRICING_BRIDGE_RUNTIME
} from '../functions/portal/analytics-v2-ui.js';
import {
  onRequest as approvedClientUi,
  clientHydrationRuntime
} from '../functions/portal/analytics-v2-client-canonical-ui.js';
import { CANONICAL_LIVE_HYDRATION_RUNTIME } from '../functions/portal/analytics-canonical-live-hydration.js';

test('Client and Admin use byte-identical approved Analytics renderer, layout and controls',async()=>{
  const [a,b]=await Promise.all([approvedAdminUi({}),approvedClientUi({})]);
  assert.equal(a.status,200);
  assert.equal(b.status,200);
  const admin=await a.text(),client=await b.text();
  assert.equal(b.headers.get('x-rona-analytics-engine'),'admin-approved-v4.3.2-exact');
  assert.equal(b.headers.get('x-rona-analytics-projection'),'CLIENT_EFFECTIVE_CONTRACT');
  assert.ok(admin.includes(CANONICAL_PRICING_BRIDGE_RUNTIME));
  assert.ok(admin.includes(CANONICAL_LIVE_HYDRATION_RUNTIME));
  assert.ok(client.includes(clientHydrationRuntime()));
  assert.equal(
    client.replace(clientHydrationRuntime(),''),
    admin.replace(CANONICAL_PRICING_BRIDGE_RUNTIME,'').replace(CANONICAL_LIVE_HYDRATION_RUNTIME,''),
    'Admin/client approved native HTML, CSS and controls must match byte for byte');
  for(const token of ['RONA TRADE · ANALYTICS','Внутренний аналитический контур','RONA_ANALYTICS_VIEW','__RONA_LPG_OBSERVATION_GAPS_V13__'])
    assert.ok(client.includes(token),'client loses Admin native element '+token);
  assert.ok(!client.includes("const API='/portal/api/v1/admin/analytics';"),'Client must not fetch admin credentials');
  assert.ok(!client.includes('function calculateRonaScenario'),'Do not forward Admin pricing bridge');
  assert.ok(client.includes("const API='/portal/api/v1/client/market-intelligence';"));
  assert.ok(client.includes("const payload=body?.data?.clientCanonicalAnalytics;"));
  assert.ok(client.includes("source-safe-v5-client-admin-engine"));
});

test('Client is thin role-scoped adapter; no second chart renderer can overwrite Admin-native UI',async()=>{
  const [client,edge,attach]=await Promise.all([
    readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8'),
    readFile('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8'),
    readFile('scripts/attach-client-market-intelligence-v1.mjs','utf8')
  ]);
  assert.ok(client.includes("const CLIENT_CANONICAL_PARITY='CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14'"));
  assert.ok(client.includes("if(window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__==='source-safe-v5-client-admin-engine')"));
  assert.ok(client.includes('Suppress the legacy second client setPayload'));
  assert.ok(client.includes('paintAuthorizedPrices(owner,product)'));
  assert.ok(client.includes('SERVER_AUTHORITATIVE_PRICE_PROJECTION'));
  assert.ok(attach.includes("canonicalEngineSrc='/portal/analytics-v2-client-canonical-ui'"));
  assert.ok(attach.includes('src="${canonicalEngineSrc}" defer'));
  assert.ok(attach.includes('src="${analyticsSrc}" defer'));
  assert.ok(attach.indexOf('src="${canonicalEngineSrc}"')<attach.indexOf('src="${analyticsSrc}"'));
  assert.ok(edge.includes("public.owner_analytics_admin_bootstrap()->'canonicalAnalytics'"));
  assert.ok(edge.includes('portal_private.client_user_has_contract_access'));
  assert.ok(edge.includes('pi.distribution_allowed=true'));
  assert.ok(edge.includes('publication_client_targets'));
  assert.ok(edge.includes('CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14'));
  assert.ok(edge.includes('notMonthlyMaturityCurve: daily.notMonthlyMaturityCurve === true'));
  assert.ok(!edge.includes('payload.clientCanonicalAnalytics = source'));
});

test('Client source change fails closed and never retains a prior client’s chart',()=>{
  const runtime=clientHydrationRuntime();
  assert.ok(runtime.includes("indicateUnavailable('CLIENT_CONTEXT_CHANGED')"));
  assert.ok(runtime.includes('lastApplied=\'\';lastSource=null'));
  assert.ok(runtime.includes("root.dataset.ronaClientSourceSafe='0'"));
  assert.ok(runtime.includes("data-rona-client-source-safe','1'"));
  assert.ok(runtime.includes('rona:client-market-intelligence-invalidated'));
});
