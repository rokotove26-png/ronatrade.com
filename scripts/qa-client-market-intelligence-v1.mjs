import { readFile } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');
const must=(text,token,label)=>{if(!text.includes(token))throw new Error(`${label}: missing ${token}`)};
const forbid=(text,token,label)=>{if(text.includes(token))throw new Error(`${label}: forbidden ${token}`)};

const html=await read('dist/portal/client.html');
const integrity=JSON.parse(await read('dist/canonical-visual-integrity.json'));
const runtime=await read('assets/portal-runtime/client-market-intelligence-v1.js');
const newsRuntime=await read('assets/portal-runtime/client-market-news-admin-parity-v1.js');
const adminNewsRuntime=await read('assets/portal-market-news-current-v1.js');
const preload=await read('assets/portal-runtime/client-background-section-preload-v1.js');
const endpoint=await read('functions/portal/api/v1/client/market-intelligence.js');
const migration=await read('supabase/migrations/20260902173000_client_market_intelligence_safe_feed_v1.sql');

for(const token of [
  'id="rona-client-market-intelligence-v1"',
  '/assets/portal-runtime/client-market-intelligence-v1.js?v=20260902-analytics-hourly-v3',
  'id="rona-client-market-news-admin-parity-v1"',
  '/assets/portal-runtime/client-market-news-admin-parity-v1.js?v=20260902-admin-canonical-hourly-v2'
])must(html,token,'built client');

for(const token of [
  '20260902-client-market-intelligence-v2-admin-news-parity',
  '/v1/client/market-intelligence',
  'RONA_CLIENT_MARKET_INTELLIGENCE_V1',
  'public_chart',
  'REFRESH_MS=3600000',
  "load('open')",
  'rona:client:background-sections'
])must(runtime,token,'client analytics market runtime');
for(const token of [
  'owner_analytics_admin_bootstrap',
  '/portal/api/v1/admin/analytics',
  'service_role',
  'SUPABASE_SERVICE_ROLE',
  'mi-news-list',
  'function renderNews(',
  "ensureOwner(root,'news')",
  'REFRESH_MS=60000'
])forbid(runtime,token,'client analytics market runtime');

for(const token of [
  '20260902-admin-news-canonical-exact-v1',
  'portal-market-news-current-v1/20260827-auto-refresh-v2',
  '#page-market-news>.rona-market-news-current',
  '.mn-masthead',
  '.mn-front',
  '.mn-lead',
  '.mn-rail-item',
  '.mn-grid',
  '.mn-dialog',
  'Главная новость',
  'Последнее',
  'Все материалы',
  'MARKET DESK · CIS ENERGY',
  'Рыночные события, производство, поставки, логистика и торговые сигналы — в самостоятельной редакционной ленте RONA Trade.',
  '/v1/client/market-intelligence',
  'source_published_at',
  'duplicate_group',
  'AUTO_REFRESH_MS=3600000',
  'Актуализация при открытии кабинета и раз в час',
  'rona:client:background-sections',
  'admin-canonical-client-safe-v1'
])must(newsRuntime,token,'client Admin-parity Market News runtime');
for(const token of [
  '/portal/owner-api',
  '/admin/analytics-bootstrap',
  'owner_analytics_admin_bootstrap',
  'service_role',
  'SUPABASE_SERVICE_ROLE',
  'mi-news-list',
  'mi-open',
  'AUTO_REFRESH_MS=60000'
])forbid(newsRuntime,token,'client Admin-parity Market News runtime');

for(const token of [
  '#page-market-news>.rona-market-news-current',
  '.mn-masthead',
  '.mn-front',
  '.mn-lead',
  '.mn-rail-item',
  '.mn-grid',
  '.mn-dialog',
  'Главная новость',
  'Последнее',
  'Все материалы',
  'MARKET DESK · CIS ENERGY',
  'Рыночные события, производство, поставки, логистика и торговые сигналы — в самостоятельной редакционной ленте RONA Trade.'
]){
  must(adminNewsRuntime,token,'Admin Market News canonical source');
  must(newsRuntime,token,'Client Market News exact visual parity');
}

for(const token of [
  '/v1/client/market-intelligence',
  'MARKET_INTELLIGENCE_REFRESH_MS=3600000',
  'readMarketIntelligence(reason)',
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

const universalSources=[runtime,newsRuntime,preload,endpoint,migration].join('\n');
for(const pattern of [/\bRONA-C\d{3,}\b/iu,/НИК-ОЙЛ|NIK[- ]OIL/iu,/UNIVERSAL\s+SOLYARIS/iu,/GAZONE/iu]){
  if(pattern.test(universalSources))throw new Error(`CLIENT_MARKET_INTELLIGENCE_CLIENT_HARDCODE_FORBIDDEN: ${pattern}`);
}

const mi=integrity.client_runtime?.market_intelligence;
if(mi?.mode!=='ADMIN_PRINCIPLE_CLIENT_SAFE_PROJECTION')throw new Error('integrity market intelligence mode missing');
if(mi?.trigger!=='PORTAL_OPEN'||mi?.refresh_ms!==3600000||mi?.refresh_policy!=='OPEN_THEN_HOURLY')throw new Error('integrity market intelligence open+hourly refresh policy missing');
if(mi?.news_window_calendar_dates!==7||mi?.authoritative_news_date!=='source_published_at')throw new Error('integrity authoritative seven-date news window missing');
if(mi?.news_visual_owner!=='ADMIN_MARKET_NEWS_CANONICAL_EXACT_V1')throw new Error('integrity exact Admin Market News owner missing');
if(mi?.news_visual_contract!=='portal-market-news-current-v1/20260827-auto-refresh-v2')throw new Error('integrity Admin Market News visual contract missing');
if(mi?.news_visual_parity!=='EXACT_ADMIN_RENDERER_DOM_CSS_TEXT'||mi?.competing_client_news_renderer!==false)throw new Error('integrity exact Admin News visual parity invalid');
for(const token of ['mn-masthead','mn-front','mn-lead','mn-rail-item','mn-grid','mn-dialog'])if(!mi?.news_dom_contract?.includes(token))throw new Error(`integrity News DOM contract missing ${token}`);
if(mi?.raw_internal_benchmarks_exposed!==false||mi?.business_mutation!==false||mi?.read_only!==true)throw new Error('integrity client safe read-only scope invalid');
const bg=integrity.client_runtime?.background_section_preload;
if(!bg?.global?.includes('/portal/api/v1/client/market-intelligence'))throw new Error('background preload market intelligence endpoint missing');
if(!bg?.covered_sections?.includes('analytics')||!bg?.covered_sections?.includes('market_news'))throw new Error('background preload section coverage missing');
if(bg?.market_intelligence?.trigger!=='PORTAL_OPEN'||bg?.market_intelligence?.refresh_ms!==3600000||bg?.market_intelligence?.refresh_policy!=='OPEN_THEN_HOURLY')throw new Error('background preload market intelligence open+hourly policy missing');

console.log('CLIENT_MARKET_INTELLIGENCE_QA=PASS Analytics + Market News load on Client portal open and refresh hourly; server-gated safe feed, exact Admin News renderer, tenant-safe universal Client projection');
