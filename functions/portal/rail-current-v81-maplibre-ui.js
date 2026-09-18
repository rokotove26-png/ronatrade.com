import { onRequest as baseRailV7 } from './rail-current-v7-real-map-ui.js';

const TILE_FROM="img.src='https://tile.openstreetmap.org/'+z+'/'+wrap+'/'+ty+'.png';";
const TILE_TO="img.src='/portal/map-assets/osm/'+z+'/'+wrap+'/'+ty+'.png';";
const V7_MARKER="window.__RONA_RAIL_REAL_MAP__='20260824-1026-v7';";
const V82_MARKER="window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2';window.__RONA_RAIL_VISUAL_V87__='20260918-wide-natural-map-v8.7';";
const TITLE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-title{color:#16232b;background:rgba(255,255,255,.91);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12)}';
const TITLE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-title{color:#07141c!important;background:rgba(255,255,255,.96);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12);font-family:Inter,Arial,sans-serif!important;font-size:13px!important;font-weight:800!important;line-height:1.25!important;opacity:1!important;text-shadow:none!important}';
const NOTE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-note{color:#24343e!important;opacity:.82!important;font-weight:650}';
const NOTE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-note{color:#08161f!important;opacity:1!important;font-family:Inter,Arial,sans-serif!important;font-size:12.5px!important;font-weight:750!important;line-height:1.35!important;text-shadow:none!important}';
const REPAIR_ANCHOR="function waitAdminReady(){";
const REPAIR_RUNTIME=String.raw`window.__RONA_RAIL_CURRENT_REPAIR_VERSION__='20260918-owner-v5-wide-natural-map';
function ensureRailCompactDarkStyle(){
  var current=q('#ronaRailCompactDarkStyle');
  if(current){
    if(current.parentNode===document.head&&current!==document.head.lastElementChild)document.head.appendChild(current);
    return current
  }
  var s=el('style');s.id='ronaRailCompactDarkStyle';s.textContent=[
    '#page-monitoring>.rona-owner-page-content{width:100%!important;max-width:1584px!important;margin:0 auto!important;padding-bottom:22px!important}',
    '.rona-rail-v4-root{gap:12px!important;width:100%!important;max-width:1584px!important;margin:0 auto!important}',
    '.rona-rail-v4-work{display:grid!important;width:100%!important;max-width:1584px!important;grid-template-columns:minmax(430px,1fr) minmax(650px,1.55fr)!important;gap:14px!important;align-items:start!important}',
    '.rona-rail-v4-left{gap:12px!important;min-width:0!important}',
    '.rona-rail-v4-hero{width:100%!important;max-width:1584px!important;margin-left:auto!important;margin-right:auto!important}',
    '.rona-rail-v4-card{margin:0!important;border-radius:15px!important;background:linear-gradient(160deg,rgba(7,21,34,.95),rgba(4,14,24,.91))!important;border-color:rgba(104,183,219,.16)!important;box-shadow:0 12px 28px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.026)!important}',
    '.rona-rail-v4-card h2{margin:0 0 10px!important;color:#e9f6fb!important;font-size:19px!important;line-height:1.18!important;font-weight:840!important;letter-spacing:-.012em!important}',
    '.rona-rail-v4-kpis{gap:8px!important}',
    '.rona-rail-v4-kpi{position:relative!important;overflow:hidden!important;padding:11px 12px 10px 14px!important;border-radius:11px!important;background:rgba(5,17,29,.55)!important;border-color:rgba(110,190,220,.12)!important}',
    '.rona-rail-v4-kpi:before{content:""!important;position:absolute!important;left:0!important;top:9px!important;bottom:9px!important;width:2px!important;border-radius:0 3px 3px 0!important;background:#63d8ff!important;box-shadow:0 0 10px rgba(99,216,255,.24)!important}',
    '.rona-rail-v4-kpi:nth-child(2):before{background:#5ee7d5!important;box-shadow:0 0 10px rgba(94,231,213,.22)!important}',
    '.rona-rail-v4-kpi:nth-child(3):before{background:#69d8ff!important}',
    '.rona-rail-v4-kpi:nth-child(4):before{background:#ffc86a!important;box-shadow:0 0 10px rgba(255,200,106,.20)!important}',
    '.rona-rail-v4-kpi span{font-size:12px!important;line-height:1.2!important;color:#98afbc!important;opacity:1!important}',
    '.rona-rail-v4-kpi strong{margin-top:5px!important;font-size:28px!important;line-height:1!important;font-weight:890!important;color:#eef9fd!important;font-variant-numeric:tabular-nums!important}',
    '.rona-rail-v4-kpi:nth-child(1) strong{color:#a9edff!important}.rona-rail-v4-kpi:nth-child(2) strong{color:#a7f2e6!important}.rona-rail-v4-kpi:nth-child(4) strong{color:#ffd895!important}',
    '.rona-rail-v6-selector{margin-top:9px!important}',
    '.rona-rail-v6-select-wrap{gap:5px!important}',
    '.rona-rail-v6-select-label{font-size:10.5px!important;color:#8eb7c8!important;opacity:1!important}',
    '.rona-rail-v6-select{min-height:38px!important;border-radius:10px!important;background:rgba(4,16,27,.70)!important;border-color:rgba(103,198,230,.18)!important}',
    '.rona-rail-v4-banner{margin-top:8px!important;padding:8px 10px!important;border-radius:10px!important;border-color:rgba(255,200,106,.28)!important;background:rgba(146,93,22,.10)!important;color:#e8d6ad!important;font-size:11.5px!important;line-height:1.35!important}',
    '.rona-rail-v6-wagon-box{gap:6px!important;margin:0 0 8px!important;padding:9px 11px!important;min-height:62px!important;border-radius:11px!important;background:rgba(5,17,29,.54)!important;border-color:rgba(103,198,230,.12)!important}',
    '.rona-rail-v6-wagon-label{font-size:10.5px!important;color:#91adba!important;opacity:1!important}',
    '.rona-rail-v6-wagon-count{min-width:24px!important;height:24px!important;background:rgba(99,216,255,.10)!important;border-color:rgba(99,216,255,.22)!important;color:#b7f0ff!important}',
    '.rona-rail-v6-wagon-chip{padding:4px 8px!important;font-size:11.5px!important;border-radius:8px!important}',
    '.rona-rail-v6-wagon-placeholder{font-size:11.5px!important;color:#839ca9!important;opacity:1!important}',
    '.rona-rail-v7-real{min-height:350px!important;margin-bottom:8px!important;border:1px solid rgba(86,189,219,.16)!important;border-radius:14px!important;background:#071825!important;box-shadow:0 14px 32px rgba(0,0,0,.22)!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-canvas{inset:38px 7px 38px!important;border:0!important;border-radius:10px!important;background:#0a1d2a!important;box-shadow:0 8px 20px rgba(0,0,0,.20)!important}',
    '.rona-rail-v7-map-viewport{border:0!important;outline:0!important;border-radius:9px!important;background:#0a1d2a!important;box-shadow:none!important}',
    '.rona-rail-v7-map-viewport:after{display:none!important;content:none!important}',
    '.rona-rail-v7-tile{filter:none!important;opacity:1!important}',
    '.rona-rail-v7-markers,.rona-rail-v7-controls,.rona-rail-v7-map-status,.rona-rail-v7-attribution{z-index:8!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-title{left:11px!important;top:10px!important;padding:5px 8px!important;color:#dff8ff!important;background:rgba(4,18,29,.92)!important;border:1px solid rgba(96,210,238,.18)!important;border-radius:8px!important;box-shadow:0 4px 14px rgba(0,0,0,.23)!important;font-size:11.5px!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-badge{right:10px!important;top:9px!important;padding:2px!important;background:rgba(4,18,29,.88)!important;border:1px solid rgba(96,210,238,.13)!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-note{left:10px!important;right:10px!important;bottom:7px!important;padding:5px 7px!important;color:#a9c5d2!important;background:rgba(3,14,22,.88)!important;border:1px solid rgba(96,210,238,.10)!important;border-radius:7px!important;font-size:9.8px!important;line-height:1.25!important}',
    '.rona-rail-v7-controls{left:9px!important;top:9px!important;gap:5px!important}',
    '.rona-rail-v7-control{width:31px!important;height:31px!important;border-color:rgba(116,205,231,.20)!important;border-radius:8px!important;background:rgba(4,18,29,.94)!important;color:#dff8ff!important;box-shadow:0 4px 12px rgba(0,0,0,.24)!important;font-size:17px!important}',
    '.rona-rail-v7-control--home{font-size:10px!important}',
    '.rona-rail-v7-map-status{left:9px!important;bottom:7px!important;max-width:58%!important;padding:4px 7px!important;background:rgba(3,14,22,.86)!important;color:#d9edf5!important;font-size:9.2px!important}',
    '.rona-rail-v7-attribution{right:4px!important;bottom:4px!important;padding:2px 5px!important;background:rgba(3,14,22,.80)!important;color:#91aeba!important;font-size:8.5px!important}',
    '.rona-rail-v7-attribution a{color:#91aeba!important}',
    '.rona-rail-v7-marker{border-color:#bdf7ff!important;background:#ffb75d!important;box-shadow:0 0 0 3px rgba(99,216,255,.12),0 2px 10px rgba(0,0,0,.42)!important}',
    '.rona-rail-v4-table-wrap{border-radius:10px!important;background:rgba(4,15,25,.46)!important;border-color:rgba(103,198,230,.10)!important}',
    '.rona-rail-v4-table{font-size:12px!important}',
    '.rona-rail-v4-table th,.rona-rail-v4-table td{padding:8px 7px!important}',
    '.rona-rail-v4-table th{font-size:9.5px!important;color:#82b8ca!important;opacity:1!important}',
    '.rona-rail-v4-pill{justify-content:center!important;text-align:center!important;min-height:27px!important;padding:4px 8px!important;font-size:10.5px!important}',
    '.rona-rail-v4-left .rona-rail-v4-table{font-size:12.5px!important}',
    '.rona-rail-v4-left .rona-rail-v4-table th{font-size:10px!important;padding:8px 6px!important}',
    '.rona-rail-v4-left .rona-rail-v4-table td{font-size:12.5px!important;padding:9px 7px!important;line-height:1.32!important}',
    '.rona-rail-v4-left .rona-rail-v4-pill{min-width:118px!important;font-size:10.5px!important}',
    '.rona-rail-v4-matrix-preserved{width:100%!important;max-width:none!important;margin:0!important;padding:16px 18px!important;border-radius:15px!important;background:linear-gradient(160deg,rgba(7,21,34,.94),rgba(4,14,24,.90))!important;border-color:rgba(104,183,219,.16)!important;box-shadow:0 12px 28px rgba(0,0,0,.17)!important}',
    '.rona-rail-tariff-section{width:100%!important;max-width:1584px!important;margin:18px auto 0!important;padding-top:16px!important;border-top:1px solid rgba(104,183,219,.18)!important;position:relative!important}',
    '.rona-rail-tariff-section:before{content:"ЖД-ТАРИФЫ"!important;display:block!important;margin:0 0 9px 2px!important;color:#72d8f6!important;font-size:10px!important;line-height:1!important;font-weight:860!important;letter-spacing:.13em!important;text-transform:uppercase!important}',
    '.rona-rail-v4-matrix-preserved h1,.rona-rail-v4-matrix-preserved h2,.rona-rail-v4-matrix-preserved h3,.rona-rail-v4-matrix-preserved h4,.rona-rail-v4-matrix-preserved .section-title,.rona-rail-v4-matrix-preserved .card-title{margin:0 0 10px!important;color:#eaf7fb!important;font-size:18px!important;line-height:1.2!important;font-weight:840!important}',
    '.rona-rail-v4-matrix-preserved table{width:100%!important;font-size:11.5px!important}',
    '.rona-rail-v4-matrix-preserved th{color:#83b8ca!important;font-size:9.5px!important;letter-spacing:.04em!important;text-transform:uppercase!important}',
    '.rona-rail-v4-matrix-preserved th,.rona-rail-v4-matrix-preserved td{padding:8px 8px!important;line-height:1.35!important}',
    '#page-monitoring>.rona-owner-page-content>section,#page-monitoring>.rona-owner-page-content>.rona-owner-card{width:100%!important;max-width:1584px!important;margin-left:auto!important;margin-right:auto!important}',
    '@media(max-width:1180px){#page-monitoring>.rona-owner-page-content{max-width:100%!important}.rona-rail-v4-work{grid-template-columns:minmax(340px,.96fr) minmax(480px,1.36fr)!important}.rona-rail-v7-real{min-height:335px!important}}',
    '@media(max-width:1040px){.rona-rail-v4-work{grid-template-columns:1fr!important}.rona-rail-v7-real{min-height:320px!important}}',
    '@media(max-width:680px){.rona-rail-v7-real{min-height:300px!important}.rona-rail-v7-real .rona-rail-v4-map-canvas{inset:38px 6px 40px!important}}'
  ].join('');
  document.head.appendChild(s);
  return s
}
function bumpRailCompactDarkStyle(){
  [0,80,220,700].forEach(function(ms){setTimeout(function(){ensureRailCompactDarkStyle()},ms)})
}
ensureRailCompactDarkStyle();
bumpRailCompactDarkStyle();
window.__RONA_RAIL_CURRENT_REPAIR__=function(){
  try{
    ensureRailCompactDarkStyle();
    paint();
    sync();
    bumpRailCompactDarkStyle();
    return true
  }catch(_e){return false}
};
function waitAdminReady(){`;

export async function onRequest(context){
  const response=await baseRailV7(context);
  let source=await response.text();
  if(
    response.status!==200||
    !source.includes(TILE_FROM)||
    !source.includes(V7_MARKER)||
    !source.includes("version:'v7'")||
    !source.includes('mountRealRailMap')||
    !source.includes('rona-rail-v7-map-viewport')||
    !source.includes(TITLE_STYLE_FROM)||
    !source.includes(NOTE_STYLE_FROM)||
    !source.includes(REPAIR_ANCHOR)
  ){
    return new Response('RAIL_V82_SOURCE_MISMATCH',{status:500,headers:{
      'content-type':'text/plain; charset=utf-8',
      'cache-control':'no-store'
    }});
  }

  source=source
    .replace(TILE_FROM,TILE_TO)
    .replace(V7_MARKER,V82_MARKER)
    .replace("version:'v7'","version:'v8.2'")
    .replace('Интерактивная карта','Интерактивная ЖД-карта')
    .replace(TITLE_STYLE_FROM,TITLE_STYLE_TO)
    .replace(NOTE_STYLE_FROM,NOTE_STYLE_TO)
    .replace(REPAIR_ANCHOR,REPAIR_RUNTIME);
  source=source.split('if(matrix)host.append(matrix);').join("if(matrix){var tariff=el('section','rona-rail-tariff-section');tariff.setAttribute('data-rail-subsection','tariffs');matrix.classList.add('rona-rail-v4-matrix-preserved');tariff.append(matrix);host.append(tariff);}");

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-rail-ui','current-v8.7-wide-natural-map');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
