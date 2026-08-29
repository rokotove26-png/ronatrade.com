import { onRequest as coreOnRequest } from './_middleware-core.js';

const CLIENT_CANONICAL_PREPAINT = `<style id="rona-client-canonical-prepaint-v5">html[data-rona-client-canon-ready="0"] body{visibility:hidden!important}</style><script id="rona-client-canonical-prepaint-boot-v5">(()=>{const d=document.documentElement;d.dataset.ronaClientCanonReady='0';setTimeout(()=>{if(d.dataset.ronaClientCanonReady!=='1')d.dataset.ronaClientCanonReady='1'},3000)})();<\/script>`;
const CLIENT_ADMIN_SYNC_RUNTIME = `${CLIENT_CANONICAL_PREPAINT}<script id="rona-client-single-logout-loader-v3" src="/assets/portal-runtime/client-shell-guard-v3.js?v=20260829-bounded-role-v3" defer><\/script><script id="rona-client-contract-download-v3-loader" src="/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-context-v3-2" defer><\/script><script id="rona-client-deal-documents-v5-loader" src="/assets/portal-runtime/client-deal-documents-v5.js?v=20260829-role-canonical-v5" defer><\/script><script id="rona-client-price-sync-bounded-loader" src="/assets/portal-runtime/client-price-sync-v1.js?v=20260829-bounded-context-v7" defer><\/script>`;

class ClientAdminSyncHeadInjector {
  element(el) {
    el.append(CLIENT_ADMIN_SYNC_RUNTIME,{html:true});
  }
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
  headers.set('x-rona-client-admin-sync','role-v3-contract-authoritative-deal-v5-role-canonical-price-bounded');

  if(typeof HTMLRewriter==='function'){
    const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    return new HTMLRewriter().on('head',new ClientAdminSyncHeadInjector()).transform(base);
  }

  const source=await response.text();
  const html=source.includes('rona-client-deal-documents-v5-loader')?source:source.replace('</head>',CLIENT_ADMIN_SYNC_RUNTIME+'</head>');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
