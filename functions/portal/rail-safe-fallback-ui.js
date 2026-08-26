import { onRequest as baseRail } from './rail-r2-ui.js';

const ISOLATE_FROM="function isolateLegacy(page,host){var matrix=findTariffMatrix(page);if(matrix&&host.contains(matrix)&&!matrix.closest('[data-rail-current-root]'))matrix.remove();Array.from(page.children).forEach(function(n){if(n===host)return;n.classList.add('rona-owner-original-hidden');n.setAttribute('aria-hidden','true')});if(matrix&&!host.contains(matrix)){matrix.classList.remove('rona-owner-original-hidden');matrix.removeAttribute('aria-hidden');host.append(matrix)}return matrix}";
const ISOLATE_TO="function isolateLegacy(page,host){var matrix=findTariffMatrix(page);Array.from(page.children).forEach(function(n){if(n===host)return;n.classList.add('rona-owner-original-hidden');n.setAttribute('aria-hidden','true')});if(matrix&&!host.contains(matrix)){matrix.classList.remove('rona-owner-original-hidden');matrix.removeAttribute('aria-hidden');host.append(matrix)}return matrix}";
const WATCH_FROM="function watch(){var page=q('#page-monitoring');if(!page||observer)return;observer=new MutationObserver(queueRepair);observer.observe(page,{childList:true,subtree:true});window.__RONA_RAIL_CURRENT_OBSERVER__=observer}";
const WATCH_TO="function watch(){var page=q('#page-monitoring'),host=page?getHost(page):null;if(!page||!host||observer)return;observer=new MutationObserver(function(){if(!q('[data-rail-current-root]',host))queueRepair()});observer.observe(host,{childList:true});window.__RONA_RAIL_CURRENT_OBSERVER__=observer}";

export async function onRequest(context){
  const response=await baseRail(context);
  let source=await response.text();
  if(response.status!==200||!source.includes(ISOLATE_FROM)||!source.includes(WATCH_FROM)||!source.includes("window.__RONA_RAIL_CURRENT_FIRST__='20260824-0231-v3'")){
    return new Response('RAIL_SAFE_FALLBACK_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source
    .replace(ISOLATE_FROM,ISOLATE_TO)
    .replace(WATCH_FROM,WATCH_TO)
    .replace("window.__RONA_RAIL_CURRENT_FIRST__='20260824-0231-v3';","window.__RONA_RAIL_CURRENT_FIRST__='20260824-0231-v3';window.__RONA_RAIL_SAFE_FALLBACK__='20260826-direct-child-v1';");
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-rail-ui','safe-fallback-direct-child-v1');
  headers.set('x-rona-rail-observer','direct-child-root-loss-only');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
