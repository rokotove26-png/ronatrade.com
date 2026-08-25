// Admin is intentionally excluded from shell middleware. Its exact route serves the
// canonical static shell and a static resilience runtime without response buffering.
// Client and Agent keep only the shared logout control here.

const PORTAL_LOGOUT_RUNTIME = `<script id="rona-portal-logout-runtime">(()=>{'use strict';if(window.__RONA_PORTAL_LOGOUT_RUNTIME__)return;window.__RONA_PORTAL_LOGOUT_RUNTIME__=true;const HOME='https://ronaoil.com';let signingOut=false;const norm=v=>String(v||'').trim().toLocaleLowerCase('ru-RU');function existingControl(){const direct=document.querySelector('#adminLogoutBtn,#ronaLogout,[data-action="logout"],[data-logout],a[href="/portal/logout"],a[href="/portal/auth/logout"],form[action="/portal/logout"] button,form[action="/portal/auth/logout"] button');if(direct)return direct;return Array.from(document.querySelectorAll('button,a,[role="button"]')).find(el=>['выход','выйти','logout'].includes(norm(el.textContent)))||null}function fallbackControl(){const b=document.createElement('button');const path=location.pathname;const kind=path.endsWith('/client')?'client':path.endsWith('/agent')?'agent':'portal';b.type='button';b.id=kind+'LogoutBtn';b.textContent='Выход';b.setAttribute('aria-label','Выход');b.setAttribute('data-rona-logout-control',kind);const host=document.querySelector('[data-user-menu],.user-menu,.user-actions,.header-actions,.topbar-actions,.topbar,header')||document.body;const ref=host.querySelector('button:last-of-type,a[role="button"]:last-of-type');if(ref&&typeof ref.className==='string'&&ref.className.trim())b.className=ref.className;else{b.style.cursor='pointer';b.style.border='1px solid rgba(255,255,255,.18)';b.style.borderRadius='8px';b.style.padding='8px 12px';b.style.background='rgba(12,20,26,.9)';b.style.color='inherit';if(host===document.body){b.style.position='fixed';b.style.top='18px';b.style.right='18px';b.style.zIndex='2147483000'}}host.appendChild(b);return b}async function signOut(event){if(event){event.preventDefault();event.stopImmediatePropagation()}if(signingOut)return;signingOut=true;const b=event?.currentTarget||event?.target;if(b&&'disabled'in b)b.disabled=true;try{await fetch('/portal/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})}catch(_e){}finally{window.location.replace(HOME)}}function bind(){const b=existingControl()||fallbackControl();if(!b||b?.dataset?.ronaLogoutBound==='true')return;if(['выйти','logout'].includes(norm(b.textContent)))b.textContent='Выход';b.setAttribute('aria-label','Выход');b.dataset.ronaLogoutBound='true';b.addEventListener('click',signOut,true)}async function verifyRestore(){try{const r=await fetch('/portal/api/session/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});if(r.status===401||r.status===403)window.location.replace(HOME)}catch(_e){}}window.addEventListener('pageshow',event=>{const nav=performance.getEntriesByType?.('navigation')?.[0];if(event.persisted||nav?.type==='back_forward')verifyRestore()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else queueMicrotask(bind)})();<\/script>`;

class LogoutBodyInjector{
  element(el){el.append(PORTAL_LOGOUT_RUNTIME,{html:true});}
}

export async function onRequest(context){
  const url=new URL(context.request.url);

  // Permanent resilience rule: Admin HTML must not be buffered or rewritten here.
  if(url.pathname==='/portal/admin')return context.next();

  if(!['/portal/client','/portal/agent'].includes(url.pathname))return context.next();
  const response=await context.next();
  const contentType=String(response.headers.get('content-type')||'').toLowerCase();
  if(response.status!==200||!contentType.includes('text/html'))return response;

  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-portal-shell-middleware','logout-stream-v2');

  if(typeof HTMLRewriter==='function'){
    const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    return new HTMLRewriter().on('body',new LogoutBodyInjector()).transform(base);
  }

  const source=await response.text();
  const html=source.includes('rona-portal-logout-runtime')?source:source.replace('</body>',PORTAL_LOGOUT_RUNTIME+'</body>');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
