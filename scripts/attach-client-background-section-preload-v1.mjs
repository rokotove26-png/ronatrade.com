import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-background-section-preload-v1.js';
const id='rona-client-background-section-preload-v1';
const src='/assets/portal-runtime/client-background-section-preload-v1.js?v=20260902-current-context-v6';
const marker='20260902-client-background-section-preload-current-context-v6';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_BACKGROUND_PRELOAD_MARKER_MISSING: ${marker}`);
for(const required of [
  'RONA_CLIENT_CONTEXT','getCurrentContext','selectionRequired','authority.subscribe','marketPath(current)','shipmentsPath(current)','railPath(current)',
  '/v1/client/market','/v1/client/shipments','/v1/client/rail','/v1/client/context','/v1/client/prices',
  "cycle('open')","REFRESH_POLICY='OPEN_CONTEXT_CHANGE_PAGESHOW_LAZY_MANIFEST'","mode:'LAZY_ROUTE_MANIFEST'",'rona:client:background-sections','window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache'
])if(!runtime.includes(required))throw new Error(`CLIENT_BACKGROUND_PRELOAD_CONTRACT_MISSING: ${required}`);
for(const forbidden of [
  '/v1/client/bootstrap','getAuthorizedContexts','state.contexts.map(preloadContext)','/v1/client/market-intelligence','MARKET_INTELLIGENCE_REFRESH_MS','readMarketIntelligence',"markSection('analytics'","markSection('market_news'",'method:\'POST\'','method:"POST"','/v1/client/applications\'','/v1/events\'',"read('/v1/client/market')",'setInterval(','REFRESH_MS=30000','legacyRefreshMs','fetch('
])if(runtime.includes(forbidden))throw new Error(`CLIENT_BACKGROUND_PRELOAD_FORBIDDEN: ${forbidden}`);

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-background-section-preload-v1.js'))throw new Error('CLIENT_BACKGROUND_PRELOAD_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.background_section_preload={
  id,src,marker,mode:'LAZY_ROUTE_MANIFEST',trigger:'PORTAL_OPEN_PLUS_CURRENT_CONTEXT_CHANGE_PLUS_PAGESHOW',refresh_ms:null,refresh_policy:'OPEN_CONTEXT_CHANGE_PAGESHOW_LAZY_MANIFEST',periodic_polling:false,network_preload:false,
  scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY',context_source:'RONA_CLIENT_CONTEXT_AUTHORITY',authorized_context_catalog:'NOT_CONSUMED_BY_MODULE',read_only:true,
  current_context:['/portal/api/v1/client/context','/portal/api/v1/client/prices','/portal/api/v1/client/market','/portal/api/v1/client/shipments','/portal/api/v1/client/rail'],
  global:[],
  covered_sections:['company_contract','home','applications','deals','documents','payments','prices','market','rail'],
  excluded_sections:['analytics','market_news'],market_intelligence_owned:false,rail_disabled_is_loaded_state:true,visual_change:false,business_mutation:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');
if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_BACKGROUND_PRELOAD_BRIDGE_MISSING_AFTER_WRITE');
console.log('CLIENT_BACKGROUND_SECTION_PRELOAD=PASS lazy route manifest only; selected CURRENT_CONTEXT; periodic polling absent; background network preload absent');
