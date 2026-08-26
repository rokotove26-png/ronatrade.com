import { onRequest as baseRemaining } from './remaining-sections-ui.js';

const ANALYTICS_LABEL="'аналитика':'analytics',";

export async function onRequest(context){
  const response=await baseRemaining(context);
  let source=await response.text();
  const count=source.split(ANALYTICS_LABEL).length-1;
  if(response.status!==200||count!==2){
    return new Response('REMAINING_CURRENT_ANALYTICS_OWNER_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.split(ANALYTICS_LABEL).join('');
  source=source.replace("'use strict';","'use strict';window.__RONA_REMAINING_CURRENT_OWNER__='20260826-no-analytics-v1';");
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','current-no-analytics-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
