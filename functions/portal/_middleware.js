const ADMIN_BOOT_KICK = `<script id="rona-server-authenticated-admin-boot-kick">(()=>{'use strict';if(window.__RONA_ADMIN_BOOT_KICK_INSTALLED__)return;window.__RONA_ADMIN_BOOT_KICK_INSTALLED__=true;const kick=()=>{try{window.RONA_ADMIN_SERVER_BOOTSTRAP?.start?.()}catch(_e){}};kick();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kick,{once:true});queueMicrotask(kick);setTimeout(kick,0)})();<\/script>`;

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
  return new HTMLRewriter().on('body', new AdminBootKickBody()).transform(response);
}
