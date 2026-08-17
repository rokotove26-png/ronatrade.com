const ADMIN_EXTERNAL_RESOURCE_GUARD = `<script id="rona-admin-external-resource-guard">(()=>{'use strict';if(window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__)return;window.__RONA_ADMIN_EXTERNAL_RESOURCE_GUARD__=true;window.addEventListener('error',event=>{const target=event&&event.target;if(!target||target===window)return;const src=String(target.src||target.href||'');if(src.startsWith('https://static.cloudflareinsights.com/beacon.min.js/'))event.stopImmediatePropagation()},true)})();<\/script>`;
const ADMIN_BOOT_KICK = `<script id="rona-server-authenticated-admin-boot-kick">(()=>{'use strict';if(window.__RONA_ADMIN_BOOT_KICK_INSTALLED__)return;window.__RONA_ADMIN_BOOT_KICK_INSTALLED__=true;const kick=()=>{try{window.RONA_ADMIN_SERVER_BOOTSTRAP?.start?.()}catch(_e){}};kick();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kick,{once:true});queueMicrotask(kick);setTimeout(kick,0)})();<\/script>`;
const PORTAL_LOGOUT_CAPTURE = `<script id="rona-portal-root-logout">(()=>{'use strict';if(window.__RONA_PORTAL_ROOT_LOGOUT__)return;window.__RONA_PORTAL_ROOT_LOGOUT__=true;let running=false;const isLogoutControl=el=>{if(!el)return false;if(['adminLogoutBtn','ronaLogout'].includes(el.id))return true;const form=el.closest?.('form');if(form&&new URL(form.action||'',location.href).pathname==='/portal/auth/logout')return true;return String(el.textContent||'').trim()==='Выйти'};const doLogout=async()=>{if(running)return;running=true;try{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin',headers:{accept:'text/html'}})}catch(_e){}finally{location.replace('/')}};document.addEventListener('click',e=>{const el=e.target?.closest?.('button,a,[role="button"]');if(!isLogoutControl(el))return;e.preventDefault();e.stopImmediatePropagation();void doLogout()},true);document.addEventListener('submit',e=>{const form=e.target;if(!(form instanceof HTMLFormElement))return;let p='';try{p=new URL(form.action||location.href,location.href).pathname}catch(_e){}if(p!=='/portal/auth/logout')return;e.preventDefault();e.stopImmediatePropagation();void doLogout()},true)})();<\/script>`;

class AdminExternalResourceGuardHead {
  element(el) {
    el.append(ADMIN_EXTERNAL_RESOURCE_GUARD, { html: true });
  }
}

class PortalRuntimeBody {
  constructor(admin) { this.admin = admin; }
  element(el) {
    if (this.admin) el.append(ADMIN_BOOT_KICK, { html: true });
    el.append(PORTAL_LOGOUT_CAPTURE, { html: true });
  }
}

export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);
  const contentType = response.headers.get('content-type') || '';
  const protectedHtml = ['/portal/admin','/portal/staff','/portal/agent','/portal/client','/portal/select'].includes(url.pathname)
    && response.status === 200
    && contentType.toLowerCase().includes('text/html');
  if (!protectedHtml) return response;
  const isAdmin = url.pathname === '/portal/admin';
  const rewriter = new HTMLRewriter().on('body', new PortalRuntimeBody(isAdmin));
  if (isAdmin) rewriter.on('head', new AdminExternalResourceGuardHead());
  return rewriter.transform(response);
}
