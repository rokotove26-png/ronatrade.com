import { onRequest as coreOnRequest } from './_middleware-core.js';

const CLIENT_ADMIN_SYNC_RUNTIME = `<script id="rona-client-single-logout-loader-v3" src="/assets/portal-runtime/client-shell-guard-v3.js?v=20260829-bounded-role-v3" defer><\/script><script id="rona-client-contract-download-v3-loader" src="/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-context-v3" defer><\/script><script id="rona-client-deal-documents-v3-loader" src="/assets/portal-runtime/client-deal-documents-v3.js?v=20260829-canonical-deal-card-v3" defer><\/script>`;

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
  headers.set('x-rona-client-admin-sync','role-v3-contract-v3-deal-v3-bounded');

  if(typeof HTMLRewriter==='function'){
    const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    return new HTMLRewriter().on('head',new ClientAdminSyncHeadInjector()).transform(base);
  }

  const source=await response.text();
  const html=source.includes('rona-client-deal-documents-v3-loader')?source:source.replace('</head>',CLIENT_ADMIN_SYNC_RUNTIME+'</head>');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
