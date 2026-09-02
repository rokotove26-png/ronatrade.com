import { readFile } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');
const must=(text,token,label)=>{if(!text.includes(token))throw new Error(`${label}: missing ${token}`)};
const forbid=(text,token,label)=>{if(text.includes(token))throw new Error(`${label}: forbidden ${token}`)};

const html=await read('dist/portal/client.html');
const integrity=JSON.parse(await read('dist/canonical-visual-integrity.json'));
const runtime=await read('assets/portal-runtime/client-market-intelligence-v1.js');
const preload=await read('assets/portal-runtime/client-background-section-preload-v1.js');
const endpoint=await read('functions/portal/api/v1/client/market-intelligence.js');
const migration=await read('supabase/migrations/20260902173000_client_market_intelligence_safe_feed_v1.sql');

for(const token of [
  'id="rona-client-market-intelligence-v1"',
  '/assets/portal-runtime/client-market-intelligence-v1.js?v=20260902-client-safe-feed-v1'
])must(html,token,'built client');

for(const token of [
  '20260902-client-market-intelligence-v1',
  '/v1/client/market-intelligence',
  'RONA_CLIENT_MARKET_INTELLIGENCE_V1',
  '7 календарных дат',
  'duplicate_group',
  'source_published_at',
  'public_chart'
])must(runtime,token,'client market runtime');
for(const token of ['owner_analytics_admin_bootstrap','/portal/api/v1/admin/analytics','service_role','SUPABASE_SERVICE_ROLE'])forbid(runtime,token,'client market runtime');

for(const token of [
  '/v1/client/market-intelligence',
  "markSection('analytics'",
  "markSection('market_news'",
  'window_calendar_dates:7',
  "authoritative_date:'source_published_at'"
])must(preload,token,'background preload');

for(const token of [
  'owner_client_market_intelligence_feed_v1',
  "ACCESS_COOKIE='rona_portal_at'",
  "REFRESH_COOKIE='rona_portal_rt'",
  "payload.version!=='RONA_CLIENT_MARKET_INTELLIGENCE_V1'",
  "if(request.method!=='GET')",
  'CLIENT_MARKET_FEED_INVALID'
])must(endpoint,token,'client market endpoint');
for(const token of ['owner_analytics_admin_bootstrap','service_role','SUPABASE_SERVICE_ROLE'])forbid(endpoint,token,'client market endpoint');

for(const token of [
  "owner_r1_actor('CLIENT')",
  "p.status::text='PUBLISHED'",
  "pi.distribution_allowed=true",
  "coalesce(pi.metadata->>'publication_layer','')='DERIVED_ANALYTICS'",
  "lower(coalesce(pi.metadata->>'public_chart_ready','false'))='true'",
  "portal_private.try_timestamptz_v1(pi.metadata->>'source_published_at')",
  'between (v_server_date-6) and v_server_date',
  'distinct on (coalesce(nullif(duplicate_group',
  'PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_AUTHORITATIVE_SOURCE_DATE_7_CALENDAR_DATES_DEDUP'
])must(migration,token,'client market migration');

const mi=integrity.client_runtime?.market_intelligence;
if(mi?.mode!=='ADMIN_PRINCIPLE_CLIENT_SAFE_PROJECTION')throw new Error('integrity market intelligence mode missing');
if(mi?.news_window_calendar_dates!==7||mi?.authoritative_news_date!=='source_published_at')throw new Error('integrity authoritative seven-date news window missing');
if(mi?.raw_internal_benchmarks_exposed!==false||mi?.business_mutation!==false||mi?.read_only!==true)throw new Error('integrity client safe read-only scope invalid');
const bg=integrity.client_runtime?.background_section_preload;
if(!bg?.global?.includes('/portal/api/v1/client/market-intelligence'))throw new Error('background preload market intelligence endpoint missing');
if(!bg?.covered_sections?.includes('analytics')||!bg?.covered_sections?.includes('market_news'))throw new Error('background preload section coverage missing');

console.log('CLIENT_MARKET_INTELLIGENCE_QA=PASS server-gated Analytics + 7-calendar-date deduped Market News, tenant-safe read-only Client projection');
