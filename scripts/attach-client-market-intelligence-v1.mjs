import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-market-intelligence-v1.js';
const id='rona-client-market-intelligence-v1';
const src='/assets/portal-runtime/client-market-intelligence-v1.js?v=20260902-client-safe-feed-v1';
const marker='20260902-client-market-intelligence-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [
  marker,
  '/v1/client/market-intelligence',
  'RONA_CLIENT_MARKET_INTELLIGENCE_V1',
  'data-rona-client-market-intelligence-owner',
  '7 календарных дат',
  'duplicate_group',
  'source_published_at',
  'public_chart',
  "window.addEventListener('rona:client:background-sections'"
])if(!runtime.includes(required))throw new Error(`CLIENT_MARKET_INTELLIGENCE_RUNTIME_MISSING: ${required}`);
for(const forbidden of ['owner_analytics_admin_bootstrap','/portal/api/v1/admin/analytics','service_role','SUPABASE_SERVICE_ROLE'])if(runtime.includes(forbidden))throw new Error(`CLIENT_MARKET_INTELLIGENCE_FORBIDDEN_MARKER: ${forbidden}`);

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-market-intelligence-v1.js'))throw new Error('CLIENT_MARKET_INTELLIGENCE_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.market_intelligence={
  id,
  src,
  marker,
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
  visual_scope:'SECTION_CONTENT_ONLY_GLOBAL_CLIENT_SHELL_UNCHANGED',
  raw_internal_benchmarks_exposed:false,
  business_mutation:false,
  read_only:true
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_MARKET_INTELLIGENCE_BRIDGE_MISSING_AFTER_WRITE');
console.log('CLIENT_MARKET_INTELLIGENCE_ATTACH=PASS analytics+market-news use safe client feed; shell unchanged; 7-calendar-date authoritative news window');
