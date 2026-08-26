import { onRequest as basePrices } from './prices-current-ui.js';

const FROM="const[a,u,c]=await Promise.all([owner('/admin/bootstrap'),updateApi('bootstrap'),updateApi('cp-bootstrap')]);admin=a;updates=u;cpGate=c;";
const TO="const[a,u]=await Promise.all([owner('/admin/bootstrap'),updateApi('bootstrap')]);admin=a;updates=u;cpGate={generatedAt:new Date().toISOString(),currentPublicationId:u?.currentPublicationId||null,commercialProposals:[],ownerReviewProposals:[]};";

export async function onRequest(context){
  const response=await basePrices(context);
  let source=await response.text();
  if(response.status!==200||!source.includes(FROM)){
    return new Response('PRICES_STANDARD_LIST_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.replace(FROM,TO);
  source=source.replace("'use strict';","'use strict';window.__RONA_PRICES_STANDARD_LIST_ONLY__='20260826-v1';");
  if(source.includes("updateApi('cp-bootstrap')")){
    return new Response('PRICES_STANDARD_LIST_CP_DEPENDENCY_REMAINS',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-prices-ui','standard-price-list-current-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
