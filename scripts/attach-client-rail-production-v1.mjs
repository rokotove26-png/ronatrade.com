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
  "const SHIPMENTS_API='/portal/api/v1/client/shipments'",
  "const MAPLIBRE_JS='/portal/map-assets/maplibre-gl.js'",
  "const MAPLIBRE_CSS='/portal/map-assets/maplibre-gl.css'",
  "const TILE_TEMPLATE='/portal/map-assets/osm/{z}/{x}/{y}.png'",
  'const DATA_REFRESH_MS=30000',
  'function removeLegacyTariffMatrix(root)',
  "root.innerHTML=workspaceMarkup()",
  "movement_source:'NOT_CONNECTED'",
  'movement_publication:false',
  'movements:[]',
  "document.documentElement.dataset.ronaClientRailTariffMatrix='REMOVED'",
  'window.setInterval(()=>refresh(false),DATA_REFRESH_MS)',
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('pageshow'",
  "new CustomEvent('rona:rail:update'",
  'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS'
]){
  if(!runtime.includes(required))throw new Error(`CLIENT_RAIL_PRODUCTION_CONTRACT_MISSING: ${required}`);
}
if(runtime.includes('MutationObserver'))throw new Error('CLIENT_RAIL_PRODUCTION_MUTATION_OBSERVER_FORBIDDEN');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_RAIL_PRODUCTION_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/\/v1\/client\/rail|MOVIZOR|provider_gate_source|PROVIDER_GATE_API/.test(runtime))throw new Error('CLIENT_RAIL_PRODUCTION_PROVIDER_GATE_MUST_NOT_BE_CONSUMED');
if(/owner_rail_tariff_matrix|rail_tariff_matrix|\/rail\/tariff/i.test(runtime))throw new Error('CLIENT_RAIL_PRODUCTION_TARIFF_DATA_FORBIDDEN');

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
integrity.client_runtime.rail_client_workspace={
  id,
  src,
  marker,
  route:'/portal/client',
  scope:'ONLINE_RAIL_CLIENT_WORKSPACE',
  shipment_source:'/portal/api/v1/client/shipments',
  authoritative_refresh_ms:30000,
  auto_refresh:true,
  manual_refresh:true,
  map_engine:'MAPLIBRE_SAME_ORIGIN',
  map_library_sources:['/portal/map-assets/maplibre-gl.js','/portal/map-assets/maplibre-gl.css'],
  tile_source:'/portal/map-assets/osm/{z}/{x}/{y}.png',
  map_interactive:true,
  movement_source:'NOT_CONNECTED',
  movement_publication:false,
  provider_gate_consumed:false,
  tariff_matrix:'REMOVED_FROM_CLIENT_WORKSPACE',
  business_logic_changed:false,
  hardcoded_business_entities:false
};
delete integrity.client_runtime.rail_map_recovery;
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_RAIL_PRODUCTION_BRIDGE_MISSING_AFTER_WRITE');
if((html.match(/client-rail-production-v1\.js/g)||[]).length!==1)throw new Error('CLIENT_RAIL_PRODUCTION_BRIDGE_NOT_SINGLE_OWNER');
console.log(`CLIENT_RAIL_PRODUCTION_BRIDGE=PASS id=${id} client workspace=single-owner shipments=authoritative auto-refresh=30s map=maplibre-same-origin tariff-matrix=removed provider=not-consumed.`);
