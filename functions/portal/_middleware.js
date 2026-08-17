const ADMIN_EXTERNAL_RESOURCE_GUARD = `<script id="rona-admin-external-resource-guard">(()=>{'use strict';if(window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__)return;window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__=true;window.addEventListener('error',event=>{const target=event&&event.target;if(!target||target===window)return;const src=String(target.src||target.href||'');if(src.startsWith('https://static.cloudflareinsights.com/beacon.min.js/'))event.stopImmediatePropagation()},true)})();<\/script>`;
const ADMIN_BOOT_KICK = `<script id="rona-server-authenticated-admin-boot-kick">(()=>{'use strict';if(window.__RONA_ADMIN_BOOT_KICK_INSTALLED__)return;window.__RONA_ADMIN_BOOT_KICK_INSTALLED__=true;const kick=()=>{try{window.RONA_ADMIN_SERVER_BOOTSTRAP?.start?.()}catch(_e){}};kick();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kick,{once:true});queueMicrotask(kick);setTimeout(kick,0)})();<\/script>`;

class AdminExternalResourceGuardHead {
  element(el) {
    el.append(ADMIN_EXTERNAL_RESOURCE_GUARD, { html: true });
  }
}

class AdminBootKickBody {
  element(el) {
    el.append(ADMIN_BOOT_KICK, { html: true });
  }
}

export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);
  const contentType = response.headers.get('content-type') || '';
  if (url.pathname !== '/portal/admin' || response.status !== 200 || !contentType.toLowerCase().includes('text/html')) return response;
  return new HTMLRewriter()
    .on('head', new AdminExternalResourceGuardHead())
    .on('body', new AdminBootKickBody())
    .transform(response);
}
