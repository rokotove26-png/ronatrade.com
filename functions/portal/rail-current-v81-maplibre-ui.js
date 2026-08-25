import { onRequest as baseRailV7 } from './rail-current-v7-real-map-ui.js';

const TILE_FROM="img.src='https://tile.openstreetmap.org/'+z+'/'+wrap+'/'+ty+'.png';";
const TILE_TO="img.src='/portal/map-assets/osm/'+z+'/'+wrap+'/'+ty+'.png';";
const V7_MARKER="window.__RONA_RAIL_REAL_MAP__='20260824-1026-v7';";
const V82_MARKER="window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2';";
const TITLE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-title{color:#16232b;background:rgba(255,255,255,.91);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12)}';
const TITLE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-title{color:#07141c!important;background:rgba(255,255,255,.96);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12);font-family:Inter,Arial,sans-serif!important;font-size:13px!important;font-weight:800!important;line-height:1.25!important;opacity:1!important;text-shadow:none!important}';
const NOTE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-note{color:#24343e!important;opacity:.82!important;font-weight:650}';
const NOTE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-note{color:#08161f!important;opacity:1!important;font-family:Inter,Arial,sans-serif!important;font-size:12px!important;font-weight:750!important;line-height:1.35!important;text-shadow:none!important}';

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
    !source.includes(NOTE_STYLE_FROM)
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
    .replace(NOTE_STYLE_FROM,NOTE_STYLE_TO);

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-rail-ui','current-v8.2-raster-first');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
