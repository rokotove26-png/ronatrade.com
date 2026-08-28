// Admin HTML is intentionally excluded from shell middleware. Its exact route serves the
// canonical static shell and a static resilience runtime without response buffering.
// Agent keeps the shared logout control here. Client receives only the isolated price-sync runtime.
// Analytics JS is normalized at the delivery boundary so stale title runtimes cannot
// replace the owner-approved v4.5.5 hero after deployment.

const PORTAL_LOGOUT_RUNTIME = `<script id="rona-portal-logout-runtime">(()=>{'use strict';if(window.__RONA_PORTAL_LOGOUT_RUNTIME__)return;window.__RONA_PORTAL_LOGOUT_RUNTIME__=true;const HOME='https://ronaoil.com';let signingOut=false;const norm=v=>String(v||'').trim().toLocaleLowerCase('ru-RU');function existingControl(){const direct=document.querySelector('#adminLogoutBtn,#ronaLogout,[data-action="logout"],[data-logout],a[href="/portal/logout"],a[href="/portal/auth/logout"],form[action="/portal/logout"] button,form[action="/portal/auth/logout"] button');if(direct)return direct;return Array.from(document.querySelectorAll('button,a,[role="button"]')).find(el=>['выход','выйти','logout'].includes(norm(el.textContent)))||null}function fallbackControl(){const b=document.createElement('button');const kind='agent';b.type='button';b.id=kind+'LogoutBtn';b.textContent='Выход';b.setAttribute('aria-label','Выход');b.setAttribute('data-rona-logout-control',kind);const host=document.querySelector('[data-user-menu],.user-menu,.user-actions,.header-actions,.topbar-actions,.topbar,header')||document.body;const ref=host.querySelector('button:last-of-type,a[role="button"]:last-of-type');if(ref&&typeof ref.className==='string'&&ref.className.trim())b.className=ref.className;else{b.style.cursor='pointer';b.style.border='1px solid rgba(255,255,255,.18)';b.style.borderRadius='8px';b.style.padding='8px 12px';b.style.background='rgba(12,20,26,.9)';b.style.color='inherit';if(host===document.body){b.style.position='fixed';b.style.top='18px';b.style.right='18px';b.style.zIndex='2147483000'}}host.appendChild(b);return b}async function signOut(event){if(event){event.preventDefault();event.stopImmediatePropagation()}if(signingOut)return;signingOut=true;const b=event?.currentTarget||event?.target;if(b&&'disabled'in b)b.disabled=true;try{await fetch('/portal/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})}catch(_e){}finally{window.location.replace(HOME)}}function bind(){const b=existingControl()||fallbackControl();if(!b||b?.dataset?.ronaLogoutBound==='true')return;if(['выйти','logout'].includes(norm(b.textContent)))b.textContent='Выход';b.setAttribute('aria-label','Выход');b.dataset.ronaLogoutBound='true';b.addEventListener('click',signOut,true)}async function verifyRestore(){try{const r=await fetch('/portal/api/session/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});if(r.status===401||r.status===403)window.location.replace(HOME)}catch(_e){}}window.addEventListener('pageshow',event=>{const nav=performance.getEntriesByType?.('navigation')?.[0];if(event.persisted||nav?.type==='back_forward')verifyRestore()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else queueMicrotask(bind)})();<\/script>`;
const CLIENT_PRICE_SYNC_RUNTIME = `<script id="rona-client-price-sync-loader" src="/assets/portal-runtime/client-price-sync-v1.js?v=20260828-2125-price-hover-v1" defer><\/script><script id="rona-client-price-conditions-loader" src="/assets/portal-runtime/client-price-conditions-v1.js?v=20260828-conditions-below-v1" defer><\/script><script id="rona-cis-rail-reference-loader" src="/assets/portal-runtime/cis-rail-reference-v1.js?v=20260827-tr4-book2-v1" defer><\/script><script id="rona-client-application-form-v3-loader" src="/assets/portal-runtime/client-application-form-v3.js?v=20260828-cis-rail-reference-v3" defer><\/script>`;

const ANALYTICS_V455_FINAL_LOCK = String.raw`
;(()=>{'use strict';
if(window.__RONA_ANALYTICS_V455_FINAL_LOCK__)return;
window.__RONA_ANALYTICS_V455_FINAL_LOCK__='20260827-owner-approved-hero-v455-final-v2';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
function ensureStyle(){let s=q('#ronaAnalyticsV455FinalHeaderStyle');if(s){document.head.appendChild(s);return}s=document.createElement('style');s.id='ronaAnalyticsV455FinalHeaderStyle';s.textContent=[
'html body #current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title,html body #current-admin-main #page-analytics>.rona-global-sticky-title,html body #current-admin-main #page-analytics>.rona-global-sticky-slot{display:none!important;visibility:hidden!important;opacity:0!important}',
'html body #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head{display:flex!important;visibility:visible!important;opacity:1!important;align-items:flex-start!important;justify-content:space-between!important;flex-wrap:wrap!important;gap:14px!important;min-height:0!important;margin:0 0 14px!important;padding:22px!important;border:1px solid rgba(132,196,224,.15)!important;border-radius:22px!important;background:radial-gradient(420px 190px at 100% 0,rgba(89,215,255,.11),transparent 65%),linear-gradient(160deg,rgba(9,24,37,.72),rgba(5,12,20,.28))!important;box-shadow:0 22px 70px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.035)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;color:inherit!important}',
'html body #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head h1{display:block!important;visibility:visible!important;opacity:1!important;margin:6px 0 8px!important;font-size:clamp(30px,3vw,46px)!important;line-height:1.02!important;letter-spacing:-.035em!important;color:#f4f8fb!important;font-weight:800!important}',
'html body #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-kicker{display:block!important;visibility:visible!important;opacity:1!important;margin:0!important;font-size:11px!important;line-height:1.25!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:#65d9ff!important;font-weight:850!important}',
'html body #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head p,html body #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-sub{display:block!important;visibility:visible!important;max-width:900px!important;margin:0!important;color:#9eb3c1!important;font-size:13px!important;line-height:1.55!important;opacity:1!important}',
'@media(max-width:680px){html body #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head{padding:18px!important;border-radius:18px!important}html body #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head h1{font-size:32px!important}}'
].join('');document.head.appendChild(s)}
function apply(){
 const page=q('#page-analytics');if(!page)return false;const root=q('#rona-analytics-v2',page);if(!root)return false;ensureStyle();
 qa(':scope>.rona-global-sticky-title,:scope>.rona-global-sticky-slot,:scope>.rona-module-error,:scope>.current-loading',page).forEach(n=>{if(n!==root)n.remove()});
 qa('.rona-analytics-canonical-title,.rona-analytics-canonical-title-text',root).forEach(n=>n.remove());
 qa('.rona-global-title-duplicate,.rona-global-title-duplicate-heading',root).forEach(n=>{n.classList.remove('rona-global-title-duplicate');n.classList.remove('rona-global-title-duplicate-heading')});
 const head=q(':scope>.an2-head',root)||q('.an2-head',root);if(!head)return false;
 const left=head.firstElementChild||head;let kicker=q('.rona-visual-kicker',head);if(!kicker){kicker=document.createElement('div');kicker.className='rona-visual-kicker';left.prepend(kicker)}kicker.textContent='RONA TRADE · ANALYTICS';
 let h=q('h1',head);if(!h){h=document.createElement('h1');const target=q('p,.rona-visual-sub',left);if(target)left.insertBefore(h,target);else left.appendChild(h)}h.textContent='Аналитика';
 const d=q('p',head)||q('.rona-visual-sub',head);if(d)d.textContent='Рыночная аналитика Коммерческого директора: динамика котировок, прогноз рынка следующего месяца и индикативный прогноз возможных цен RONA Trade по рабочим базисам.';
 document.documentElement.dataset.ronaAnalyticsHeader='owner-approved-v455-final-v2';return true
}
let queued=false;function soon(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',soon,{once:true});else soon();
const obs=new MutationObserver(soon);obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-hidden']});
window.addEventListener('rona:admin-pagechange',e=>{if(e.detail?.page==='analytics')soon()});
[0,50,120,250,500,900,1600,3500,7000].forEach(ms=>setTimeout(apply,ms));
})();`;

class LogoutBodyInjector{
  element(el){el.append(PORTAL_LOGOUT_RUNTIME,{html:true});}
}
class ClientPriceSyncInjector{
  element(el){el.append(CLIENT_PRICE_SYNC_RUNTIME,{html:true});}
}

export async function onRequest(context){
  const url=new URL(context.request.url);

  // Permanent resilience rule: Admin HTML must not be buffered or rewritten here.
  if(url.pathname==='/portal/admin')return context.next();

  if(url.pathname==='/portal/analytics-v2-ui')return analyticsResponse(context);

  // Client receives isolated same-origin runtimes: published prices, price conditions and canonical application form.
  // No theme guard, no attribute observer and no global CSS injection are allowed here.
  if(url.pathname==='/portal/client'){
    const response=await context.next();
    const contentType=String(response.headers.get('content-type')||'').toLowerCase();
    if(response.status!==200||!contentType.includes('text/html'))return response;
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');
    headers.set('cache-control','no-store, no-cache, must-revalidate');
    headers.set('x-rona-client-price-sync','safe-v7-cis-rail-application');
    if(typeof HTMLRewriter==='function'){
      const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      return new HTMLRewriter().on('body',new ClientPriceSyncInjector()).transform(base);
    }
    const source=await response.text();
    const html=source.includes('rona-client-price-sync-loader')?source:source.replace('</body>',CLIENT_PRICE_SYNC_RUNTIME+'</body>');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }

  if(url.pathname!=='/portal/agent')return context.next();
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

async function analyticsResponse(context){
  const downstream=await context.next();
  if(downstream.status!==200)return downstream;
  const contentType=String(downstream.headers.get('content-type')||'').toLowerCase();
  if(!contentType.includes('javascript')&&!contentType.includes('text/plain'))return downstream;
  const source=await downstream.text();
  const legacyTitleCreate=/const title=el\('div','rona-global-sticky-title rona-analytics-canonical-title'\);title\.dataset\.page='analytics';title\.append\(el\('div','rona-global-sticky-title-text rona-analytics-canonical-title-text','Аналитика'\)\);r\.append\(title\);/g;
  let clean=source
    .replace(/<script[^>]*data-rona-analytics-legacy[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/\/\*\s*RONA_ANALYTICS_LEGACY_BEGIN\s*\*\/[\s\S]*?\/\*\s*RONA_ANALYTICS_LEGACY_END\s*\*\//g,'')
    .replace(legacyTitleCreate,'')
    .replace(/'#current-admin-main #page-analytics #rona-analytics-v2 \.rona-analytics-canonical-title\{[^']*\}',?/g,'')
    .replace(/'#current-admin-main #page-analytics #rona-analytics-v2 \.rona-analytics-canonical-title-text\{[^']*\}',?/g,'')
    .replace(/'#current-admin-main #page-analytics #rona-analytics-v2\.an2>\.an2-head h1\{display:none!important\}',?/g,'')
    .replace(/'#current-admin-main #page-analytics #rona-analytics-v2\.an2>\.an2-head \.rona-visual-kicker\{display:none!important\}',?/g,'');
  const headers=new Headers(downstream.headers);
  headers.delete('content-length');headers.delete('etag');
  headers.set('content-type','application/javascript; charset=utf-8');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');headers.set('expires','0');
  headers.set('x-rona-analytics-header','owner-approved-v455-final-lock-v2');
  headers.set('x-rona-analytics-legacy-title','removed-at-delivery-boundary');
  return new Response(clean+'\n'+ANALYTICS_V455_FINAL_LOCK+'\n',{status:downstream.status,statusText:downstream.statusText,headers});
}
