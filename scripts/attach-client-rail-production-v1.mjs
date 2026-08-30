import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-rail-production-v1.js';
const id='rona-client-rail-production-v1';
const src='/assets/portal-runtime/client-rail-production-v1.js?v=20260830-client-workspace-v3';
const marker='20260830-client-workspace-v3';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_RAIL_PRODUCTION_MARKER_MISSING: ${marker}`);
for(const required of [
  "location.pathname!=='/portal/client'",
  "img.rona-rail-v7-tile",
  'https://tile.openstreetmap.org/',
  '/portal/map-assets/osm/',
  "const SHIPMENTS_API='/portal/api/v1/client/shipments'",
  'const DATA_REFRESH_MS=30000',
  'window.setInterval(scanTiles,5000)',
  'window.setInterval(refresh,DATA_REFRESH_MS)',
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('pageshow'",
  "window.addEventListener('focus'",
  "new CustomEvent('rona:rail:update'",
  'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS',
  'TARIFF_MATRIX_TITLES',
  "dataset.ronaClientRailTariffMatrix='REMOVED'",
  'id="rona-client-rail-workspace-v3"',
  'external_positioning_used:false'
]){
  if(!runtime.includes(required))throw new Error(`CLIENT_RAIL_PRODUCTION_CONTRACT_MISSING: ${required}`);
}
if(runtime.includes('MutationObserver'))throw new Error('CLIENT_RAIL_PRODUCTION_MUTATION_OBSERVER_FORBIDDEN');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_RAIL_PRODUCTION_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/MOVIZOR|PROVIDER_GATE_API|\/portal\/api\/v1\/client\/rail|\/v1\/rail\/|\/rail\/snapshot|monitoring_status|production_polling_enabled|client_publication_enabled/i.test(runtime))throw new Error('CLIENT_RAIL_PRODUCTION_EXTERNAL_POSITIONING_MUST_NOT_BE_USED');

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
  scope:'ONLINE_RAIL_CLIENT_WORKSPACE',
  tile_sources:['DIRECT_OPENSTREETMAP','SAME_ORIGIN_OSM_PROXY'],
  recovery:'DIRECT_PROXY_BIDIRECTIONAL_FALLBACK',
  health_scan_ms:5000,
  authoritative_refresh_ms:30000,
  visibility_resume:true,
  shipment_source:'/portal/api/v1/client/shipments',
  source_contract:'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS',
  external_positioning:'NOT_USED',
  external_provider_request:false,
  movement_data_fail_closed:true,
  client_tariff_matrix:'REMOVED_BY_CURRENT_RUNTIME',
  business_logic_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_RAIL_PRODUCTION_BRIDGE_MISSING_AFTER_WRITE');
if((html.match(/client-rail-production-v1\.js/g)||[]).length!==1)throw new Error('CLIENT_RAIL_PRODUCTION_BRIDGE_NOT_SINGLE_OWNER');
console.log(`CLIENT_RAIL_PRODUCTION_BRIDGE=PASS id=${id} workspace=current auto-refresh=30s map=direct-proxy external-positioning=not-used client-tariff-matrix=removed.`);
