import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-rail-production-v1.js';
const id='rona-client-rail-production-v1';
const src='/assets/portal-runtime/client-rail-production-v1.js?v=20260830-map-auto-v1';
const marker='20260830-map-auto-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_RAIL_PRODUCTION_MARKER_MISSING: ${marker}`);
for(const required of [
  "location.pathname!=='/portal/client'",
  "img.rona-rail-v7-tile",
  'https://tile.openstreetmap.org/',
  '/portal/map-assets/osm/',
  'window.setInterval(scan,5000)',
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('pageshow'",
  "window.addEventListener('focus'"
]){
  if(!runtime.includes(required))throw new Error(`CLIENT_RAIL_PRODUCTION_CONTRACT_MISSING: ${required}`);
}
if(runtime.includes('MutationObserver'))throw new Error('CLIENT_RAIL_PRODUCTION_MUTATION_OBSERVER_FORBIDDEN');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_RAIL_PRODUCTION_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/\/v1\/rail\/|\/rail\/snapshot|monitoring_status|production_polling_enabled|client_publication_enabled/.test(runtime))throw new Error('CLIENT_RAIL_PRODUCTION_MUST_NOT_BYPASS_AUTHORITATIVE_RAIL_GATE');

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-rail-production-v1.js'))throw new Error('CLIENT_RAIL_PRODUCTION_BRIDGE_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.rail_map_recovery={
  id,
  src,
  marker,
  route:'/portal/client',
  scope:'ONLINE_RAIL_MAP_TILES_ONLY',
  tile_sources:['DIRECT_OPENSTREETMAP','SAME_ORIGIN_OSM_PROXY'],
  recovery:'DIRECT_PROXY_BIDIRECTIONAL_FALLBACK',
  health_scan_ms:5000,
  visibility_resume:true,
  provider_state_source:'UNCHANGED_AUTHORITATIVE_SERVER_GATE',
  movement_data_changed:false,
  business_logic_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_RAIL_PRODUCTION_BRIDGE_MISSING_AFTER_WRITE');
if((html.match(/client-rail-production-v1\.js/g)||[]).length!==1)throw new Error('CLIENT_RAIL_PRODUCTION_BRIDGE_NOT_SINGLE_OWNER');
console.log(`CLIENT_RAIL_PRODUCTION_BRIDGE=PASS id=${id} map recovery=direct-proxy auto-scan; authoritative provider gate unchanged.`);
