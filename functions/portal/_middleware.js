import { onRequest as coreOnRequest } from './_middleware-core.js';

const CLIENT_CANONICAL_PREPAINT = `<style id="rona-client-canonical-prepaint-v5">html[data-rona-client-canon-ready="0"] body{visibility:hidden!important}</style><script id="rona-client-canonical-prepaint-boot-v5">(()=>{const d=document.documentElement;d.dataset.ronaClientCanonReady='0';setTimeout(()=>{if(d.dataset.ronaClientCanonReady!=='1')d.dataset.ronaClientCanonReady='1'},3000)})();<\/script>`;
const CLIENT_DEAL_CANONICAL_VISUAL_RUNTIME = `<script id="rona-client-deal-canonical-visual-v2-loader" src="/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260829-v5-canonical-compact-v2" defer><\/script>`;
const CLIENT_ADMIN_SYNC_RUNTIME = `${CLIENT_CANONICAL_PREPAINT}<script id="rona-client-single-logout-loader-v3" src="/assets/portal-runtime/client-shell-guard-v3.js?v=20260829-bounded-role-v3" defer><\/script><script id="rona-client-contract-download-v3-loader" src="/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-context-v3-2" defer><\/script><script id="rona-client-deal-documents-v5-loader" src="/assets/portal-runtime/client-deal-documents-v5.js?v=20260829-role-canonical-v5" defer><\/script>${CLIENT_DEAL_CANONICAL_VISUAL_RUNTIME}<script id="rona-client-price-sync-bounded-loader" src="/assets/portal-runtime/client-price-sync-v1.js?v=20260829-bounded-context-v7" defer><\/script>`;
const OSM_TILE_ORIGIN='https://tile.openstreetmap.org';

class ClientAdminSyncHeadInjector {
  element(el) {
    el.append(CLIENT_ADMIN_SYNC_RUNTIME,{html:true});
  }
}

function allowClientRailTileCsp(headers){
  const csp=String(headers.get('content-security-policy')||'');
  if(!csp||csp.includes(OSM_TILE_ORIGIN))return;
  const marker="img-src 'self' data: blob:;";
  if(csp.includes(marker))headers.set('content-security-policy',csp.replace(marker,`img-src 'self' data: blob: ${OSM_TILE_ORIGIN};`));
}

export async function onRequest(context) {
  const response=await coreOnRequest(context);
  const url=new URL(context.request.url);
  if(url.pathname!=='/portal/client')return response;
  const contentType=String(response.headers.get('content-type')||'').toLowerCase();
  if(response.status!==200||!contentType.includes('text/html'))return response;

  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-client-admin-sync','role-v3-contract-authoritative-deal-v5-canonical-compact-v2-source-no-standalone-documents-price-bounded');
  allowClientRailTileCsp(headers);

  if(typeof HTMLRewriter==='function'){
    const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    return new HTMLRewriter().on('head',new ClientAdminSyncHeadInjector()).transform(base);
  }

  const source=await response.text();
  if(source.includes('rona-client-deal-documents-v5-loader'))return new Response(source,{status:response.status,statusText:response.statusText,headers});
  const html=source.replace('</head>',CLIENT_ADMIN_SYNC_RUNTIME+'</head>');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
