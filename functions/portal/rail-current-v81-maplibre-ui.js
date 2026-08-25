import { onRequest as baseRailV7 } from './rail-current-v7-real-map-ui.js';

const TILE_FROM="img.src='https://tile.openstreetmap.org/'+z+'/'+wrap+'/'+ty+'.png';";
const TILE_TO="img.src='/portal/map-assets/osm/'+z+'/'+wrap+'/'+ty+'.png';";
const V7_MARKER="window.__RONA_RAIL_REAL_MAP__='20260824-1026-v7';";
const V82_MARKER="window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2';";

export async function onRequest(context){
  const response=await baseRailV7(context);
  let source=await response.text();
  if(
    response.status!==200||
    !source.includes(TILE_FROM)||
    !source.includes(V7_MARKER)||
    !source.includes("version:'v7'")||
    !source.includes('mountRealRailMap')||
    !source.includes('rona-rail-v7-map-viewport')
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
    .replace('Интерактивная карта','Интерактивная ЖД-карта');

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-rail-ui','current-v8.2-raster-first');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
