// Canonical portal interfaces are frozen. Agent and Client pass through byte-for-byte.
// Admin receives only two nonvisual technical scripts required by the existing
// server-authenticated canonical boot path. They do not rewrite canonical DOM,
// CSS, text, navigation, controls, or business content.

const ADMIN_EXTERNAL_RESOURCE_GUARD = `<script id="rona-admin-external-resource-guard">(()=>{'use strict';if(window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__)return;window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__=true;window.addEventListener('error',event=>{const target=event&&event.target;if(!target||target===window)return;const src=String(target.src||target.href||'');if(src.startsWith('https://static.cloudflareinsights.com/beacon.min.js/'))event.stopImmediatePropagation()},true)})();<\/script>`;
const ADMIN_BOOT_KICK = `<script id="rona-server-authenticated-admin-boot-kick">(()=>{'use strict';if(window.__RONA_ADMIN_BOOT_KICK_INSTALLED__)return;window.__RONA_ADMIN_BOOT_KICK_INSTALLED__=true;const kick=()=>{try{window.RONA_ADMIN_SERVER_BOOTSTRAP?.start?.()}catch(_e){}};kick();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kick,{once:true});queueMicrotask(kick);setTimeout(kick,0)})();<\/script>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname !== '/portal/admin') return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200 || !contentType.toLowerCase().includes('text/html')) return response;

  let source = await response.text();
  if (!source.includes('rona-admin-external-resource-guard')) source = source.replace('</head>', `${ADMIN_EXTERNAL_RESOURCE_GUARD}</head>`);
  if (!source.includes('rona-server-authenticated-admin-boot-kick')) source = source.replace('</body>', `${ADMIN_BOOT_KICK}</body>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
}
