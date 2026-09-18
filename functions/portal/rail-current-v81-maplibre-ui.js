import { onRequest as baseRailV7 } from './rail-current-v7-real-map-ui.js';

const TILE_FROM="img.src='https://tile.openstreetmap.org/'+z+'/'+wrap+'/'+ty+'.png';";
const TILE_TO="img.src='/portal/map-assets/osm/'+z+'/'+wrap+'/'+ty+'.png';";
const V7_MARKER="window.__RONA_RAIL_REAL_MAP__='20260824-1026-v7';";
const V82_MARKER="window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2';window.__RONA_RAIL_VISUAL_V84__='20260918-compact-dark-v8.4';";
const TITLE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-title{color:#16232b;background:rgba(255,255,255,.91);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12)}';
const TITLE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-title{color:#07141c!important;background:rgba(255,255,255,.96);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12);font-family:Inter,Arial,sans-serif!important;font-size:13px!important;font-weight:800!important;line-height:1.25!important;opacity:1!important;text-shadow:none!important}';
const NOTE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-note{color:#24343e!important;opacity:.82!important;font-weight:650}';
const NOTE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-note{color:#08161f!important;opacity:1!important;font-family:Inter,Arial,sans-serif!important;font-size:12px!important;font-weight:750!important;line-height:1.35!important;text-shadow:none!important}';
const REPAIR_ANCHOR="function waitAdminReady(){";
const REPAIR_RUNTIME=String.raw`window.__RONA_RAIL_CURRENT_REPAIR_VERSION__='20260918-owner-v2-compact-dark';
function ensureRailCompactDarkStyle(){
  if(q('#ronaRailCompactDarkStyle'))return;
  var s=el('style');s.id='ronaRailCompactDarkStyle';s.textContent=[
    '#page-monitoring>.rona-owner-page-content{width:100%!important;max-width:1420px!important;margin:0 auto!important;padding-bottom:28px!important}',
    '.rona-rail-v4-root{gap:12px!important;width:100%!important}',
    '.rona-rail-v4-work{grid-template-columns:minmax(280px,.78fr) minmax(560px,1.62fr)!important;gap:12px!important;align-items:start!important}',
    '.rona-rail-v4-left{gap:12px!important}',
    '.rona-rail-v4-card{border-radius:16px!important;background:linear-gradient(160deg,rgba(7,21,34,.93),rgba(4,14,24,.88))!important;border-color:rgba(104,183,219,.16)!important;box-shadow:0 12px 30px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.025)!important}',
    '.rona-rail-v4-card h2{margin:0 0 10px!important;font-size:18px!important;line-height:1.18!important;letter-spacing:-.01em!important}',
    '.rona-rail-v4-kpis{gap:8px!important}',
    '.rona-rail-v4-kpi{padding:11px 12px!important;border-radius:12px!important;background:rgba(5,17,29,.50)!important}',
    '.rona-rail-v4-kpi span{font-size:10.5px!important;color:#8fa8b8!important;opacity:1!important}',
    '.rona-rail-v4-kpi strong{margin-top:5px!important;font-size:23px!important;color:#eef8fd!important}',
    '.rona-rail-v6-selector{margin-top:10px!important}',
    '.rona-rail-v6-select-wrap{gap:5px!important}',
    '.rona-rail-v6-select{min-height:38px!important;border-radius:10px!important}',
    '.rona-rail-v4-banner{margin-top:9px!important;padding:9px 10px!important;font-size:11.5px!important;line-height:1.35!important}',
    '.rona-rail-v6-wagon-box{gap:7px!important;margin:0 0 10px!important;padding:10px 12px!important;min-height:68px!important;border-radius:12px!important;background:rgba(5,17,29,.46)!important}',
    '.rona-rail-v6-wagon-count{min-width:25px!important;height:25px!important}',
    '.rona-rail-v6-wagon-chip{padding:5px 8px!important;font-size:11.5px!important}',
    '.rona-rail-v7-real{min-height:405px!important;margin-bottom:10px!important;background:#07131f!important;border-color:rgba(86,189,219,.24)!important;box-shadow:0 16px 38px rgba(0,0,0,.24)!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-canvas{inset:40px 9px 43px!important;border-radius:12px!important;background:#071722!important}',
    '.rona-rail-v7-map-viewport{background:#071722!important}',
    '.rona-rail-v7-tile{filter:brightness(.62) saturate(.52) hue-rotate(158deg) contrast(1.14)!important;opacity:.92!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-title{color:#dff8ff!important;background:rgba(5,20,31,.90)!important;border:1px solid rgba(96,210,238,.20)!important;box-shadow:0 5px 18px rgba(0,0,0,.24)!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-badge{background:rgba(5,20,31,.84)!important;border:1px solid rgba(96,210,238,.14)!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-note{left:12px!important;right:12px!important;bottom:9px!important;padding:6px 8px!important;color:#c4dce7!important;background:rgba(4,16,25,.88)!important;border:1px solid rgba(96,210,238,.12)!important;font-size:10.5px!important}',
    '.rona-rail-v7-control{width:34px!important;height:34px!important;border-color:rgba(116,205,231,.22)!important;background:rgba(5,20,31,.92)!important;color:#dff8ff!important;box-shadow:0 4px 14px rgba(0,0,0,.24)!important}',
    '.rona-rail-v7-control--home{font-size:11px!important}',
    '.rona-rail-v7-map-status{left:10px!important;bottom:8px!important;padding:4px 7px!important;background:rgba(3,14,22,.86)!important;color:#d9edf5!important;font-size:9.5px!important}',
    '.rona-rail-v7-attribution{right:5px!important;bottom:5px!important;background:rgba(4,16,25,.82)!important;color:#a9c2cf!important}',
    '.rona-rail-v7-attribution a{color:#a9c2cf!important}',
    '.rona-rail-v4-table-wrap{border-radius:11px!important;background:rgba(4,15,25,.42)!important}',
    '.rona-rail-v4-table{font-size:11.5px!important}',
    '.rona-rail-v4-table th,.rona-rail-v4-table td{padding:8px 7px!important}',
    '.rona-rail-v4-table th{font-size:9.5px!important;color:#83b8ca!important;opacity:1!important}',
    '.rona-rail-v4-pill{justify-content:center!important;text-align:center!important;min-height:27px!important;padding:4px 8px!important;font-size:10.5px!important}',
    '#page-monitoring>.rona-owner-page-content>section,#page-monitoring>.rona-owner-page-content>.rona-owner-card{max-width:1420px!important;margin-left:auto!important;margin-right:auto!important}',
    '@media(max-width:1180px){#page-monitoring>.rona-owner-page-content{max-width:100%!important}.rona-rail-v4-work{grid-template-columns:minmax(260px,.82fr) minmax(500px,1.5fr)!important}.rona-rail-v7-real{min-height:370px!important}}',
    '@media(max-width:1040px){.rona-rail-v4-work{grid-template-columns:1fr!important}.rona-rail-v7-real{min-height:360px!important}}',
    '@media(max-width:680px){.rona-rail-v7-real{min-height:330px!important}.rona-rail-v7-real .rona-rail-v4-map-canvas{inset:40px 7px 46px!important}}'
  ].join('');
  document.head.appendChild(s);
}
ensureRailCompactDarkStyle();
window.__RONA_RAIL_CURRENT_REPAIR__=function(){try{ensureRailCompactDarkStyle();paint();sync();return true}catch(_e){return false}};
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

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-rail-ui','current-v8.4-compact-dark');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
