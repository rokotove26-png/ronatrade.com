import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const adapterPath='functions/portal/client-rail-current-ui.js';
const adminCanonPath='functions/portal/rail-current-v81-maplibre-ui.js';
const adminBasePath='functions/portal/rail-current-v4-ui.js';
const id='rona-client-rail-admin-canonical-v1';
const src='/portal/client-rail-current-ui?v=20260831-admin-canonical-v1';
const marker='20260831-admin-canonical-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const adapter=await readFile(adapterPath,'utf8');
for(const required of [
  marker,
  "import { onRequest as adminRailCurrent } from './rail-current-v81-maplibre-ui.js'",
  "'/portal/api/v1/client/shipments'",
  "'/portal/api/v1/client/rail'",
  "ADMIN_CURRENT_V81_CANONICAL",
  "admin-current-v81-client-authority-v1",
  "AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS",
  "x-rona-client-rail-visual-canon",
  "rona-rail-v4-root",
  "rona-rail-v4-work",
  "rona-rail-v6-selector",
  "rona-rail-v6-wagon-box",
  "rona-rail-v7-real",
  "/portal/map-assets/osm/"
]){
  if(!adapter.includes(required))throw new Error(`CLIENT_RAIL_ADMIN_CANONICAL_ADAPTER_MISSING: ${required}`);
}
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(adapter))throw new Error('CLIENT_RAIL_ADMIN_CANONICAL_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

const adminCanon=await readFile(adminCanonPath,'utf8');
for(const required of [
  "import { onRequest as baseRailV7 } from './rail-current-v7-real-map-ui.js'",
  "window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2'",
  "'/portal/map-assets/osm/'",
  "Интерактивная ЖД-карта"
]){
  if(!adminCanon.includes(required))throw new Error(`ADMIN_RAIL_CURRENT_CANON_MISSING: ${required}`);
}
const adminBase=await readFile(adminBasePath,'utf8');
for(const required of ['rona-rail-v4-root','rona-rail-v4-work','ЖД-контур','Операционная картина ЖД','Позиции вагонов']){
  if(!adminBase.includes(required))throw new Error(`ADMIN_RAIL_VISUAL_CONTRACT_MISSING: ${required}`);
}

let html=await readFile(htmlPath,'utf8');
for(const retired of ['client-rail-production-v1.js','client-rail-movizor-gate-v1.js','rona-client-rail-production-v1','rona-client-rail-movizor-gate-v1']){
  if(html.includes(retired))throw new Error(`CLIENT_RAIL_RETIRED_OWNER_PRESENT_BEFORE_ATTACH: ${retired}`);
}
if(html.includes(id)||html.includes('/portal/client-rail-current-ui'))throw new Error('CLIENT_RAIL_ADMIN_CANONICAL_BRIDGE_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
delete integrity.client_runtime.rail_client_workspace;
delete integrity.client_runtime.rail_map_recovery;
integrity.client_runtime.rail_client_admin_canonical={
  id,
  src,
  marker,
  route:'/portal/client',
  scope:'ONLINE_RAIL_ADMIN_CANONICAL_VISUAL_CLIENT_AUTHORITY',
  visual_canon:'/portal/rail-current-v81-maplibre-ui',
  visual_contract:'ADMIN_CURRENT_V8_2',
  visual_source_mode:'DIRECT_ADMIN_CANONICAL_RUNTIME_ADAPTER',
  client_data_source:'/portal/api/v1/client/shipments',
  provider_state_source:'/portal/api/v1/client/rail',
  authoritative_refresh_ms:30000,
  auto_refresh:true,
  map_tile_source:'/portal/map-assets/osm/{z}/{x}/{y}.png',
  movement_publication:'FAIL_CLOSED_FROM_CLIENT_PROVIDER_STATE',
  legacy_client_visual_owner:false,
  separate_movizor_visual_gate:false,
  business_data_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_RAIL_ADMIN_CANONICAL_BRIDGE_MISSING_AFTER_WRITE');
if((html.match(/client-rail-current-ui/g)||[]).length!==1)throw new Error('CLIENT_RAIL_ADMIN_CANONICAL_BRIDGE_NOT_SINGLE_OWNER');
for(const retired of ['client-rail-production-v1.js','client-rail-movizor-gate-v1.js'])if(html.includes(retired))throw new Error(`CLIENT_RAIL_RETIRED_OWNER_EMITTED: ${retired}`);
console.log(`CLIENT_RAIL_ADMIN_CANONICAL=PASS id=${id} visual=/portal/rail-current-v81-maplibre-ui client-authority=server-scoped single-owner=true.`);