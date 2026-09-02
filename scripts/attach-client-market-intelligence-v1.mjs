import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const analyticsRuntimePath='dist/assets/portal-runtime/client-market-intelligence-v1.js';
const newsRuntimePath='dist/assets/portal-runtime/client-market-news-admin-parity-v1.js';
const analyticsId='rona-client-market-intelligence-v1';
const analyticsSrc='/assets/portal-runtime/client-market-intelligence-v1.js?v=20260902-analytics-safe-v2';
const analyticsMarker='20260902-client-market-intelligence-v2-admin-news-parity';
const newsId='rona-client-market-news-admin-parity-v1';
const newsSrc='/assets/portal-runtime/client-market-news-admin-parity-v1.js?v=20260902-admin-canonical-exact-v1';
const newsMarker='20260902-admin-news-canonical-exact-v1';
const newsVisualContract='portal-market-news-current-v1/20260827-auto-refresh-v2';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const analyticsRuntime=await readFile(analyticsRuntimePath,'utf8');
for(const required of [
  analyticsMarker,
  '/v1/client/market-intelligence',
  'RONA_CLIENT_MARKET_INTELLIGENCE_V1',
  'data-rona-client-market-intelligence-owner',
  'public_chart',
  "window.addEventListener('rona:client:background-sections'"
])if(!analyticsRuntime.includes(required))throw new Error(`CLIENT_MARKET_INTELLIGENCE_RUNTIME_MISSING: ${required}`);
for(const forbidden of [
  'owner_analytics_admin_bootstrap',
  '/portal/api/v1/admin/analytics',
  'service_role',
  'SUPABASE_SERVICE_ROLE',
  'mi-news-list',
  'function renderNews(',
  "ensureOwner(root,'news')"
])if(analyticsRuntime.includes(forbidden))throw new Error(`CLIENT_MARKET_INTELLIGENCE_FORBIDDEN_MARKER: ${forbidden}`);

const newsRuntime=await readFile(newsRuntimePath,'utf8');
for(const required of [
  newsMarker,
  newsVisualContract,
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
  '/v1/client/market-intelligence',
  'source_published_at',
  'duplicate_group',
  'rona:client:background-sections',
  "data-rona-market-news-owner':'admin-canonical-client-safe-v1'"
])if(!newsRuntime.includes(required))throw new Error(`CLIENT_MARKET_NEWS_ADMIN_PARITY_RUNTIME_MISSING: ${required}`);
for(const forbidden of [
  '/portal/owner-api',
  '/admin/analytics-bootstrap',
  'owner_analytics_admin_bootstrap',
  'service_role',
  'SUPABASE_SERVICE_ROLE',
  'mi-news-list',
  'mi-open'
])if(newsRuntime.includes(forbidden))throw new Error(`CLIENT_MARKET_NEWS_ADMIN_PARITY_FORBIDDEN_MARKER: ${forbidden}`);

let html=await readFile(htmlPath,'utf8');
for(const token of [analyticsId,'client-market-intelligence-v1.js',newsId,'client-market-news-admin-parity-v1.js'])if(html.includes(token))throw new Error(`CLIENT_MARKET_INTELLIGENCE_ALREADY_PRESENT: ${token}`);
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridges=`<script id="${analyticsId}" src="${analyticsSrc}" defer></script><script id="${newsId}" src="${newsSrc}" defer></script>`;
html=html.slice(0,close)+bridges+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.market_intelligence={
  id:analyticsId,
  src:analyticsSrc,
  marker:analyticsMarker,
  mode:'ADMIN_PRINCIPLE_CLIENT_SAFE_PROJECTION',
  endpoint:'/portal/api/v1/client/market-intelligence',
  preload_cache_key:'/v1/client/market-intelligence',
  refresh_ms:60000,
  sections:['analytics','market-news'],
  analytics_gate:'PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_PUBLIC_CHART_ONLY',
  news_gate:'PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_AUTHORITATIVE_SOURCE_DATE_7_CALENDAR_DATES_DEDUP',
  authoritative_news_date:'source_published_at',
  news_window_calendar_dates:7,
  deduplication:'duplicate_group_then_news_id_then_publication_item_id',
  news_visual_owner:'ADMIN_MARKET_NEWS_CANONICAL_EXACT_V1',
  news_visual_contract:newsVisualContract,
  news_owner_asset:newsSrc,
  news_dom_contract:['mn-masthead','mn-front','mn-lead','mn-rail-item','mn-grid','mn-dialog'],
  news_visual_parity:'EXACT_ADMIN_RENDERER_DOM_CSS_TEXT',
  competing_client_news_renderer:false,
  visual_scope:'MARKET_NEWS_EXACT_ADMIN_CANONICAL_PARITY_ANALYTICS_FUNCTIONAL_ONLY_GLOBAL_CLIENT_SHELL_UNCHANGED',
  raw_internal_benchmarks_exposed:false,
  business_mutation:false,
  read_only:true
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

for(const token of [`id="${analyticsId}"`,analyticsSrc,`id="${newsId}"`,newsSrc])if(!html.includes(token))throw new Error(`CLIENT_MARKET_INTELLIGENCE_BRIDGE_MISSING_AFTER_WRITE: ${token}`);
console.log('CLIENT_MARKET_INTELLIGENCE_ATTACH=PASS Analytics uses safe Client feed; Market News uses exact Admin canonical renderer DOM/CSS/text with safe Client feed; global Client shell unchanged');
