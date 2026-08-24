import { onRequest as baseRailV6 } from './rail-current-v6-ui.js';

export async function onRequest(context){
  const response=await baseRailV6(context);
  let source=await response.text();
  const needle="'.rona-rail-v6-selector{display:block!important;margin-top:14px!important}',";
  const hiddenHero="'.rona-rail-v4-hero{display:none!important}',";
  if(response.status!==200||!source.includes(needle)){
    return new Response('RAIL_V61_SINGLE_TITLE_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.replace(needle,hiddenHero+'\n'+needle);
  source=source.replace("'use strict';","'use strict';\nwindow.__RONA_RAIL_SINGLE_TITLE__='20260824-0320-v6.1';");
  source=source.replace("__RONA_RAIL_CURRENT_V6__='20260824-0308-v6'","__RONA_RAIL_CURRENT_V6__='20260824-0320-v6.1'");
  source=source.replace("version:'v6'","version:'v6.1'");
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-rail-ui','current-v6.1-visual');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
