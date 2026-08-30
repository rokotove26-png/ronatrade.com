import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const adapterPath='functions/portal/client-rail-current-ui.js';
const adminCanonPath='functions/portal/rail-current-v81-maplibre-ui.js';
const adminBasePath='functions/portal/rail-current-v4-ui.js';
const heroRuntimePath='dist/assets/portal-runtime/client-rail-canonical-hero-v1.js';
const id='rona-client-rail-admin-canonical-v1';
const src='/portal/client-rail-current-ui?v=20260831-admin-canonical-v1';
const marker='20260831-admin-canonical-v1';
const heroId='rona-client-rail-canonical-hero-v1';
const heroSrc='/assets/portal-runtime/client-rail-canonical-hero-v1.js?v=20260831-client-canonical-hero-v1';
const heroMarker='20260831-client-rail-canonical-hero-v1';
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
  "EVENT_DRIVEN_PLUS_MANUAL",
  "x-rona-client-rail-visual-canon",
  "x-rona-client-rail-refresh-mode",
  "rona-rail-v4-root",
  "rona-rail-v4-work",
  "rona-rail-v6-selector",
  "rona-rail-v6-wagon-box",
  "rona-rail-v7-real",
  "/portal/map-assets/osm/"
]){
  if(!adapter.includes(required))throw new Error(`CLIENT_RAIL_ADMIN_OPERATIONAL_ADAPTER_MISSING: ${required}`);
}
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(adapter))throw new Error('CLIENT_RAIL_ADMIN_OPERATIONAL_ADAPTER_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

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
  if(!adminBase.includes(required))throw new Error(`ADMIN_RAIL_OPERATIONAL_BODY_CONTRACT_MISSING: ${required}`);
}

const heroRuntime=await readFile(heroRuntimePath,'utf8');
for(const required of [
  heroMarker,
  "const KICKER='RONA Trade · Operations'",
  "const TITLE='Онлайн ЖД'",
  "const SUBTITLE='Операционная картина железнодорожных отправок по данным клиентского контура.'",
  'font-size:18px!important',
  'min-height:300px!important',
  'COMPACT_STANDARD_V1',
  'rona-client-rail-hero-actions',
  'Обновление · по изменению',
  'Обновить',
  'CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY',
  'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS'
]){
  if(!heroRuntime.includes(required))throw new Error(`CLIENT_RAIL_CANONICAL_HERO_CONTRACT_MISSING: ${required}`);
}
if(heroRuntime.includes('Автообновление · 30 с'))throw new Error('CLIENT_RAIL_PERIODIC_REFRESH_LABEL_REGRESSION');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(heroRuntime))throw new Error('CLIENT_RAIL_CANONICAL_HERO_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

function elementBoundsById(source,idValue,required=true){
  const quoted=escapeRe(idValue);
  const openRe=new RegExp(`<([A-Za-z][A-Za-z0-9:_-]*)\\b[^>]*\\bid\\s*=\\s*(["'])${quoted}\\2[^>]*>`,'i');
  const match=openRe.exec(source);
  if(!match){
    if(required)throw new Error(`CLIENT_RAIL_STATIC_HOST_MISSING: ${idValue}`);
    return null;
  }
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
      return {id:idValue,openStart:match.index,openEnd:innerStart,innerStart,innerEnd:token.index,closeEnd:tagRe.lastIndex,openTag:match[0],tag};
    }
  }
  throw new Error(`CLIENT_RAIL_STATIC_HOST_UNCLOSED: ${idValue}`);
}

function appendAttribute(openTag,name,value){
  const re=new RegExp(`\\s${escapeRe(name)}\\s*=`,'i');
  if(re.test(openTag))return openTag;
  return openTag.replace(/>$/,` ${name}="${value}">`);
}
function addCurrentOnlyAttributes(openTag,outerId){
  if(/data-rona-client-rail-current-only\s*=/.test(openTag))throw new Error('CLIENT_RAIL_CURRENT_ONLY_ATTRIBUTE_ALREADY_PRESENT');
  let out=appendAttribute(openTag,'data-rona-client-rail-current-only',staticHostMarker);
  out=appendAttribute(out,'aria-label','Онлайн ЖД');
  if(outerId==='page-monitoring'){
    out=appendAttribute(out,'data-rona-client-rail-admin-canonical-mount','v1');
    out=appendAttribute(out,'data-rona-client-rail-owner','admin-current-v81-client-authority-v1');
    out=appendAttribute(out,'data-rona-client-rail-current-visual','v2');
  }
  return out;
}

let html=await readFile(htmlPath,'utf8');
for(const retired of ['client-rail-production-v1.js','client-rail-movizor-gate-v1.js','rona-client-rail-production-v1','rona-client-rail-movizor-gate-v1']){
  if(html.includes(retired))throw new Error(`CLIENT_RAIL_RETIRED_OWNER_PRESENT_BEFORE_ATTACH: ${retired}`);
}
if(html.includes(id)||html.includes('/portal/client-rail-current-ui'))throw new Error('CLIENT_RAIL_OPERATIONAL_BRIDGE_ALREADY_PRESENT');
if(html.includes(heroId)||html.includes('client-rail-canonical-hero-v1.js'))throw new Error('CLIENT_RAIL_CANONICAL_HERO_BRIDGE_ALREADY_PRESENT');
if(html.includes(staticStyleId)||html.includes(`data-rona-client-rail-current-only="${staticHostMarker}"`))throw new Error('CLIENT_RAIL_CURRENT_ONLY_HOST_ALREADY_PRESENT');

const before=elementBoundsById(html,'page-rail',false)||elementBoundsById(html,'page-monitoring',false);
if(!before)throw new Error('CLIENT_RAIL_STATIC_HOST_MISSING: page-rail|page-monitoring');
const removedStaticBytes=Buffer.byteLength(html.slice(before.innerStart,before.innerEnd),'utf8');
if(removedStaticBytes===0)throw new Error('CLIENT_RAIL_LEGACY_STATIC_SOURCE_EMPTY_UNEXPECTEDLY');
const nestedMount='<div id="page-monitoring" data-rona-client-rail-admin-canonical-mount="v1" data-rona-client-rail-owner="admin-current-v81-client-authority-v1" data-rona-client-rail-current-visual="v2"></div>';
const currentOnlyInner=before.id==='page-monitoring'?'':nestedMount;
const currentOpen=addCurrentOnlyAttributes(before.openTag,before.id);
html=html.slice(0,before.openStart)+currentOpen+currentOnlyInner+html.slice(before.innerEnd);

const currentOnlyStyle=`<style id="${staticStyleId}">[data-rona-client-rail-current-only="${staticHostMarker}"]{width:100%;min-width:0;max-width:none}[data-rona-client-rail-current-only="${staticHostMarker}"]::before{content:none!important}</style>`;
if(currentOnlyStyle.includes('content:"Онлайн ЖД"')||currentOnlyStyle.includes('.rona-rail-v4-hero{display:none!important}'))throw new Error('CLIENT_RAIL_CURRENT_ONLY_STYLE_REGRESSION_BEFORE_EMIT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
html=html.slice(0,headClose)+currentOnlyStyle+html.slice(headClose);

const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script><script id="${heroId}" src="${heroSrc}" defer></script>`;
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
  visual_canon:'CLIENT_CANONICAL_RAIL_HERO_V1',
  visual_contract:'CLIENT_CANONICAL_HERO_V1_WITH_ADMIN_CURRENT_V8_2_OPERATIONAL_BODY',
  visual_source_mode:'CLIENT_CANONICAL_HERO_RUNTIME_PLUS_ADMIN_OPERATIONAL_BODY_ADAPTER',
  operational_body_canon:'/portal/rail-current-v81-maplibre-ui',
  host_mode:'BUILD_TIME_CURRENT_ONLY_SOURCE_HOST',
  static_host:before.id,
  static_host_marker:staticHostMarker,
  static_title_owner:'CLIENT_CANONICAL_HERO_RUNTIME_V1',
  static_legacy_dom_removed:true,
  static_removed_bytes:removedStaticBytes,
  runtime_replaces_legacy_page_dom:false,
  canonical_hero:{
    id:heroId,
    src:heroSrc,
    marker:heroMarker,
    kicker:'RONA Trade · Operations',
    title:'Онлайн ЖД',
    title_px:18,
    density:'COMPACT_STANDARD_V1',
    subtitle:'Операционная картина железнодорожных отправок по данным клиентского контура.',
    refresh_label:'Обновление · по изменению',
    refresh_action:'Обновить'
  },
  client_data_source:'/portal/api/v1/client/shipments',
  provider_state_source:'/portal/api/v1/client/rail',
  authoritative_refresh_ms:null,
  auto_refresh:false,
  refresh_mode:'EVENT_DRIVEN_PLUS_MANUAL',
  event_refresh:true,
  manual_refresh:true,
  map_tile_source:'/portal/map-assets/osm/{z}/{x}/{y}.png',
  movement_publication:'FAIL_CLOSED_FROM_CLIENT_PROVIDER_STATE',
  legacy_client_visual_owner:false,
  separate_movizor_visual_gate:false,
  business_data_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_RAIL_OPERATIONAL_BRIDGE_MISSING_AFTER_WRITE');
if(!html.includes(`id="${heroId}"`)||!html.includes(heroSrc))throw new Error('CLIENT_RAIL_CANONICAL_HERO_BRIDGE_MISSING_AFTER_WRITE');
if((html.match(/client-rail-current-ui/g)||[]).length!==1)throw new Error('CLIENT_RAIL_OPERATIONAL_BRIDGE_NOT_SINGLE_OWNER');
if((html.match(/client-rail-canonical-hero-v1\.js/g)||[]).length!==1)throw new Error('CLIENT_RAIL_CANONICAL_HERO_BRIDGE_NOT_SINGLE_OWNER');
if(!html.includes(`data-rona-client-rail-current-only="${staticHostMarker}"`)||!html.includes(`id="${staticStyleId}"`))throw new Error('CLIENT_RAIL_CURRENT_ONLY_STATIC_HOST_MISSING_AFTER_WRITE');
const currentStyleOpen=`<style id="${staticStyleId}">`;
const currentStyleStart=html.indexOf(currentStyleOpen);
const currentStyleEnd=currentStyleStart<0?-1:html.indexOf('</style>',currentStyleStart);
if(currentStyleStart<0||currentStyleEnd<0)throw new Error('CLIENT_RAIL_CURRENT_ONLY_STYLE_MISSING_AFTER_WRITE');
const emittedCurrentOnlyStyle=html.slice(currentStyleStart,currentStyleEnd+8);
if(emittedCurrentOnlyStyle.includes('content:"Онлайн ЖД"')||emittedCurrentOnlyStyle.includes('.rona-rail-v4-hero{display:none!important}'))throw new Error('CLIENT_RAIL_CURRENT_ONLY_STYLE_REGRESSION_AFTER_EMIT');
const after=elementBoundsById(html,before.id);
const afterInner=html.slice(after.innerStart,after.innerEnd);
if(afterInner!==currentOnlyInner)throw new Error('CLIENT_RAIL_STATIC_PAGE_NOT_CURRENT_ONLY');
if(before.id==='page-monitoring'&&after.openTag.indexOf('data-rona-client-rail-admin-canonical-mount="v1"')<0)throw new Error('CLIENT_RAIL_DIRECT_MOUNT_NOT_CANONICAL');
for(const retired of ['client-rail-production-v1.js','client-rail-movizor-gate-v1.js'])if(html.includes(retired))throw new Error(`CLIENT_RAIL_RETIRED_OWNER_EMITTED: ${retired}`);
console.log(`CLIENT_RAIL_CURRENT_ONLY=PASS id=${id} hero=${heroMarker} operational-body=/portal/rail-current-v81-maplibre-ui client-authority=server-scoped refresh=event-driven-plus-manual density=compact-standard-v1 static-host=${before.id} current-only=${staticHostMarker} removed-static-bytes=${removedStaticBytes} single-owner=true.`);
