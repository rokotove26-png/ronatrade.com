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
const staticHostMarker='current-only-v2';
const staticStyleId='rona-client-rail-current-only-v2-style';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const escapeRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

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

function elementBoundsById(source,idValue){
  const quoted=escapeRe(idValue);
  const openRe=new RegExp(`<([A-Za-z][A-Za-z0-9:_-]*)\\b[^>]*\\bid\\s*=\\s*(["'])${quoted}\\2[^>]*>`,'i');
  const match=openRe.exec(source);
  if(!match)throw new Error(`CLIENT_RAIL_STATIC_HOST_MISSING: ${idValue}`);
  const tag=match[1];
  const innerStart=match.index+match[0].length;
  const tagRe=new RegExp(`<\\/?${escapeRe(tag)}\\b[^>]*>`,'gi');
  tagRe.lastIndex=innerStart;
  let depth=1;
  let token;
  while((token=tagRe.exec(source))){
    const raw=token[0];
    if(/^<\//.test(raw))depth--;
    else if(!/\/\s*>$/.test(raw))depth++;
    if(depth===0){
      return {openStart:match.index,openEnd:innerStart,innerStart,innerEnd:token.index,closeEnd:tagRe.lastIndex,openTag:match[0],tag};
    }
  }
  throw new Error(`CLIENT_RAIL_STATIC_HOST_UNCLOSED: ${idValue}`);
}

function addCurrentOnlyAttributes(openTag){
  if(/data-rona-client-rail-current-only\s*=/.test(openTag))throw new Error('CLIENT_RAIL_CURRENT_ONLY_ATTRIBUTE_ALREADY_PRESENT');
  if(/aria-label\s*=/.test(openTag))return openTag.replace(/>$/,` data-rona-client-rail-current-only="${staticHostMarker}">`);
  return openTag.replace(/>$/,` data-rona-client-rail-current-only="${staticHostMarker}" aria-label="Онлайн ЖД">`);
}

let html=await readFile(htmlPath,'utf8');
for(const retired of ['client-rail-production-v1.js','client-rail-movizor-gate-v1.js','rona-client-rail-production-v1','rona-client-rail-movizor-gate-v1']){
  if(html.includes(retired))throw new Error(`CLIENT_RAIL_RETIRED_OWNER_PRESENT_BEFORE_ATTACH: ${retired}`);
}
if(html.includes(id)||html.includes('/portal/client-rail-current-ui'))throw new Error('CLIENT_RAIL_ADMIN_CANONICAL_BRIDGE_ALREADY_PRESENT');
if(html.includes(staticStyleId)||html.includes(`data-rona-client-rail-current-only="${staticHostMarker}"`))throw new Error('CLIENT_RAIL_CURRENT_ONLY_HOST_ALREADY_PRESENT');

const before=elementBoundsById(html,'page-rail');
const removedStaticBytes=Buffer.byteLength(html.slice(before.innerStart,before.innerEnd),'utf8');
if(removedStaticBytes===0)throw new Error('CLIENT_RAIL_LEGACY_STATIC_SOURCE_EMPTY_UNEXPECTEDLY');
const currentOnlyInner=`<div id="page-monitoring" data-rona-client-rail-admin-canonical-mount="v1" data-rona-client-rail-owner="admin-current-v81-client-authority-v1" data-rona-client-rail-current-visual="v2"></div>`;
const currentOpen=addCurrentOnlyAttributes(before.openTag);
html=html.slice(0,before.openStart)+currentOpen+currentOnlyInner+html.slice(before.innerEnd);

const currentOnlyStyle=`<style id="${staticStyleId}">#page-rail[data-rona-client-rail-current-only="${staticHostMarker}"]::before{content:"Онлайн ЖД";display:block;margin:0 0 14px;font:800 24px/1.15 Inter,Arial,sans-serif;letter-spacing:-.02em;color:inherit}#page-rail[data-rona-client-rail-current-only="${staticHostMarker}"]>.rona-client-rail-current-title-accessible{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}#page-rail[data-rona-client-rail-current-only="${staticHostMarker}"]>.rona-rail-v4-hero,#page-rail[data-rona-client-rail-current-only="${staticHostMarker}"] .rona-rail-v4-hero{display:none!important}</style>`;
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
html=html.slice(0,headClose)+currentOnlyStyle+html.slice(headClose);

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
  scope:'ONLINE_RAIL_CURRENT_ONLY_SOURCE_HOST',
  visual_canon:'/portal/rail-current-v81-maplibre-ui',
  visual_contract:'ADMIN_CURRENT_V8_2',
  visual_source_mode:'BUILD_TIME_CURRENT_ONLY_HOST_WITH_ADMIN_CANONICAL_INNER_RUNTIME',
  static_host:'page-rail',
  static_host_marker:staticHostMarker,
  static_title_owner:'PAGE_RAIL_CURRENT_ONLY_PSEUDO_TITLE',
  static_legacy_dom_removed:true,
  static_removed_bytes:removedStaticBytes,
  runtime_replaces_legacy_page_dom:false,
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
if(!html.includes(`data-rona-client-rail-current-only="${staticHostMarker}"`)||!html.includes(`id="${staticStyleId}"`)||!html.includes(currentOnlyInner))throw new Error('CLIENT_RAIL_CURRENT_ONLY_STATIC_HOST_MISSING_AFTER_WRITE');
const after=elementBoundsById(html,'page-rail');
const afterInner=html.slice(after.innerStart,after.innerEnd);
if(afterInner!==currentOnlyInner)throw new Error('CLIENT_RAIL_STATIC_PAGE_NOT_CURRENT_ONLY');
for(const retired of ['client-rail-production-v1.js','client-rail-movizor-gate-v1.js'])if(html.includes(retired))throw new Error(`CLIENT_RAIL_RETIRED_OWNER_EMITTED: ${retired}`);
console.log(`CLIENT_RAIL_ADMIN_CANONICAL=PASS id=${id} visual=/portal/rail-current-v81-maplibre-ui client-authority=server-scoped static-host=${staticHostMarker} removed-static-bytes=${removedStaticBytes} single-owner=true.`);