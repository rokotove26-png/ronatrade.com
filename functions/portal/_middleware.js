import { onRequest as coreOnRequest } from './_middleware-core.js';

const CLIENT_CANONICAL_PREPAINT = `<style id="rona-client-canonical-prepaint-v5">html[data-rona-client-canon-ready="0"] body{visibility:hidden!important}</style><script id="rona-client-canonical-prepaint-boot-v5">(()=>{const d=document.documentElement;d.dataset.ronaClientCanonReady='0';setTimeout(()=>{if(d.dataset.ronaClientCanonReady!=='1')d.dataset.ronaClientCanonReady='1'},3000)})();<\/script>`;
const CLIENT_OBSOLETE_DS_INVOICE_GUARD = `<script id="rona-client-obsolete-ds-invoice-guard-v2">(()=>{'use strict';const MARK='20260829-client-no-standalone-ds-invoices-v2';if(window.__RONA_CLIENT_NO_STANDALONE_DS_INVOICES__===MARK)return;window.__RONA_CLIENT_NO_STANDALONE_DS_INVOICES__=MARK;const norm=v=>String(v??'').replace(/\\s+/g,' ').trim().toLocaleLowerCase('ru-RU');const obsolete=v=>/^(?:дс|ds)\\s*(?:(?:и|and|\\/|&)\\s*)?(?:инвойс(?:ы)?|invoices?)$/i.test(norm(v));const controls=()=>[...document.querySelectorAll('aside a,aside button,aside [role="tab"],aside [role="menuitem"],nav a,nav button,nav [role="tab"],nav [role="menuitem"],[role="navigation"] a,[role="navigation"] button,[role="navigation"] [role="tab"],[role="navigation"] [role="menuitem"]')];const remove=()=>{let removed=0;for(const n of controls()){if(!obsolete(n.textContent))continue;const host=n.closest('li,[role="menuitem"]')||n;host.remove();removed++}const oldHeading=[...document.querySelectorAll('h1,h2,h3')].find(n=>obsolete(n.textContent));if(oldHeading){const deals=controls().find(n=>norm(n.textContent)==='сделки');if(deals)try{deals.click()}catch{}}document.documentElement.dataset.ronaStandaloneDsInvoices=removed?'removed':'absent';return removed};let queued=false;const sweep=()=>{remove();for(const ms of [60,180,420,900,1800,3200])setTimeout(remove,ms)};const schedule=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;sweep()},0)};window.__RONA_REMOVE_OBSOLETE_DS_INVOICES__=sweep;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sweep,{once:true});else sweep();window.addEventListener('load',sweep,{once:true});window.addEventListener('pageshow',sweep,{passive:true});document.addEventListener('click',schedule,true);document.addEventListener('change',schedule,true);setInterval(()=>{if(document.visibilityState==='visible')remove()},1500)})();<\/script>`;
const CLIENT_DEAL_CANONICAL_VISUAL_RUNTIME = `<script id="rona-client-deal-canonical-visual-v2-loader" src="/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260829-v5-canonical-compact-v2" defer><\/script>`;
const CLIENT_ADMIN_SYNC_RUNTIME = `${CLIENT_CANONICAL_PREPAINT}${CLIENT_OBSOLETE_DS_INVOICE_GUARD}<script id="rona-client-single-logout-loader-v3" src="/assets/portal-runtime/client-shell-guard-v3.js?v=20260829-bounded-role-v3" defer><\/script><script id="rona-client-contract-download-v3-loader" src="/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-context-v3-2" defer><\/script><script id="rona-client-deal-documents-v5-loader" src="/assets/portal-runtime/client-deal-documents-v5.js?v=20260829-role-canonical-v5" defer><\/script>${CLIENT_DEAL_CANONICAL_VISUAL_RUNTIME}<script id="rona-client-price-sync-bounded-loader" src="/assets/portal-runtime/client-price-sync-v1.js?v=20260829-bounded-context-v7" defer><\/script>`;

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
  headers.set('x-rona-client-admin-sync','role-v3-contract-authoritative-deal-v5-canonical-compact-v2-no-standalone-ds-invoices-v2-price-bounded');

  if(typeof HTMLRewriter==='function'){
    const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    return new HTMLRewriter().on('head',new ClientAdminSyncHeadInjector()).transform(base);
  }

  const source=await response.text();
  if(source.includes('rona-client-obsolete-ds-invoice-guard-v2'))return new Response(source,{status:response.status,statusText:response.statusText,headers});
  const runtime=source.includes('rona-client-deal-documents-v5-loader')?CLIENT_OBSOLETE_DS_INVOICE_GUARD+CLIENT_DEAL_CANONICAL_VISUAL_RUNTIME:CLIENT_ADMIN_SYNC_RUNTIME;
  const html=source.replace('</head>',runtime+'</head>');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
