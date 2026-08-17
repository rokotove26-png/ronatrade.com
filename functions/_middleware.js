const FORM_PAGES = new Set([
  '/pages/home_large.html','/pages/home_large','/pages/home_compact.html','/pages/home_compact',
  '/en/pages/home_large.html','/en/pages/home_large','/en/pages/home_compact.html','/en/pages/home_compact',
  '/investments/home.html','/investments/home','/en/investments/home.html','/en/investments/home'
]);
const PORTAL_ENTRY_PAGES = new Set([
  '/pages/home_large.html','/pages/home_large','/pages/home_compact.html','/pages/home_compact',
  '/en/pages/home_large.html','/en/pages/home_large','/en/pages/home_compact.html','/en/pages/home_compact'
]);
const MOBILE_REMEDIATION_PAGES = new Set([
  '/pages/home_compact.html','/pages/home_compact','/en/pages/home_compact.html','/en/pages/home_compact',
  '/pages/about.html','/pages/about','/pages/products.html','/pages/products','/pages/logistics.html','/pages/logistics',
  '/pages/geography.html','/pages/geography','/pages/contacts.html','/pages/contacts',
  '/en/pages/about.html','/en/pages/about','/en/pages/products.html','/en/pages/products','/en/pages/logistics.html','/en/pages/logistics',
  '/en/pages/geography.html','/en/pages/geography','/en/pages/contacts.html','/en/pages/contacts'
]);
const MOBILE_HOME_PAGES = new Set(['/pages/home_compact.html','/pages/home_compact','/en/pages/home_compact.html','/en/pages/home_compact']);
const MOBILE_CONTACTS_PAGES = new Set(['/pages/contacts.html','/pages/contacts','/en/pages/contacts.html','/en/pages/contacts']);
const MOBILE_CONTACTS_INNER_PAGES = new Set(['/pages/inner/contacts_compact.html','/pages/inner/contacts_compact','/en/pages/inner/contacts_compact.html','/en/pages/inner/contacts_compact']);
const ADMIN_RUNTIME_PAGES = new Set(['/portal/admin']);

const BRIDGE_SCRIPT = `<script id="rona-controlled-form-transport-v1-1">
(()=>{
  'use strict';
  if(window.__RONA_CONTROLLED_FORM_TRANSPORT__) return;
  window.__RONA_CONTROLLED_FORM_TRANSPORT__=true;
  const MAP=Object.freeze({'https://formsubmit.co/ajax/office_kg@ronaoil.com':'/api/forms/trade','https://formsubmit.co/ajax/rokotove26@gmail.com':'/api/forms/investments'});
  const raw=input=>typeof input==='string'?input:(input instanceof URL?input.href:(input&&typeof input.url==='string'?input.url:''));
  const absolute=target=>new URL(target,window.location.origin).href;
  const remap=input=>{const target=MAP[raw(input)];if(!target)return input;const url=absolute(target);return input instanceof Request?new Request(url,input):url};
  const parentFetch=window.fetch.bind(window);window.fetch=(input,init)=>parentFetch(remap(input),init);
  try{const d=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'srcdoc');if(d&&d.get&&d.set&&d.configurable){Object.defineProperty(HTMLIFrameElement.prototype,'srcdoc',{configurable:d.configurable,enumerable:d.enumerable,get:d.get,set(value){if(typeof value==='string'){for(const [from,to] of Object.entries(MAP))value=value.split(from).join(absolute(to))}return d.set.call(this,value)}})}}catch(_){}
  function patchFrame(frame){try{const w=frame&&frame.contentWindow;if(!w||w.__RONA_CONTROLLED_FORM_TRANSPORT__)return;const frameFetch=w.fetch.bind(w);w.fetch=(input,init)=>{const target=MAP[raw(input)];if(!target)return frameFetch(input,init);const url=absolute(target);const next=input instanceof w.Request?new w.Request(url,input):url;return frameFetch(next,init)};w.__RONA_CONTROLLED_FORM_TRANSPORT__=true}catch(_){}}
  function install(){document.querySelectorAll('iframe').forEach(frame=>{frame.addEventListener('load',()=>patchFrame(frame));patchFrame(frame)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;

const PORTAL_ENTRY_SCRIPT = `<script id="rona-home-inline-auth-loader-g82-v2" src="/assets/g82/portal-home-inline-auth-v2.js"></script>`;
const MOBILE_RUNTIME = `<script id="rona-mobile-remediation-loader-v2" src="/assets/mobile/rona-mobile-remediation-v2.js" defer></script><script id="rona-mobile-design-lock-loader-v2" src="/assets/mobile/rona-mobile-design-lock-v2.js" defer></script>`;
const MOBILE_HOME_STYLE = `<link id="rona-mobile-home-style-v2" rel="stylesheet" href="/assets/mobile/rona-mobile-home-v2.css">`;
const MOBILE_CONTACTS_STYLE = `<link id="rona-mobile-contacts-underlay-style-v2" rel="stylesheet" href="/assets/mobile/rona-mobile-contacts-underlay-v2.css">`;
const ADMIN_RUNTIME_COMPAT = `<script id="rona-admin-runtime-compat-v1">
(()=>{
  'use strict';
  if(window.__RONA_ADMIN_RUNTIME_COMPAT_V1__)return;
  window.__RONA_ADMIN_RUNTIME_COMPAT_V1__=true;
  const stamp=()=>{
    const home=document.getElementById('page-home');
    if(!home)return;
    if(home.querySelector('#clock')&&home.querySelector('#calendar'))return;
    const host=home.querySelector('.page-head')||home.querySelector('.title-row');
    if(!host)return;
    const wrap=document.createElement('div');
    wrap.innerHTML='<div data-rona-admin-clock-compat="true"><div class="clock" id="clock">--:--</div><div class="calendar" id="calendar">--</div></div>';
    const node=wrap.firstElementChild;
    const slot=host.querySelector('.asof');
    if(slot)slot.replaceWith(node);else host.appendChild(node);
    const d=new Date(),clock=document.getElementById('clock'),calendar=document.getElementById('calendar');
    if(clock)clock.textContent=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    if(calendar)calendar.textContent=d.toLocaleDateString('ru-RU',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  };
  const install=()=>{stamp();const home=document.getElementById('page-home');if(home)new MutationObserver(stamp).observe(home,{childList:true,subtree:true});document.addEventListener('rona:admin-live-ready',stamp);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;

class FormHeadInjector { element(element){ element.prepend(BRIDGE_SCRIPT,{html:true}); } }
class PortalEntryHeadInjector { element(element){ element.prepend(PORTAL_ENTRY_SCRIPT,{html:true}); } }
class MobileHeadInjector { constructor(isHome,isContacts){this.isHome=isHome;this.isContacts=isContacts} element(element){element.prepend(`${this.isHome?MOBILE_HOME_STYLE:''}${this.isContacts?MOBILE_CONTACTS_STYLE:''}${MOBILE_RUNTIME}`,{html:true})} }
class ContactsInnerHeadInjector { element(element){element.prepend(MOBILE_CONTACTS_STYLE,{html:true})} }
class MobileViewportNormalizer { element(element){element.setAttribute('content','width=device-width,initial-scale=1,viewport-fit=cover')} }
class AdminRuntimeBodyInjector { element(element){element.append(ADMIN_RUNTIME_COMPAT,{html:true})} }

function canonicalHostRedirect(request){
  const url=new URL(request.url);
  if(url.hostname.toLowerCase()!=='www.ronaoil.com')return null;
  url.protocol='https:';url.hostname='ronaoil.com';url.port='';
  return Response.redirect(url.toString(),308);
}

export async function onRequest(context){
  const {request}=context;
  if(request.method!=='GET')return context.next();
  const hostRedirect=canonicalHostRedirect(request);if(hostRedirect)return hostRedirect;
  const pathname=new URL(request.url).pathname;
  const needsFormBridge=FORM_PAGES.has(pathname);
  const needsPortalEntry=PORTAL_ENTRY_PAGES.has(pathname);
  const needsMobileRuntime=MOBILE_REMEDIATION_PAGES.has(pathname);
  const needsContactsInnerStyle=MOBILE_CONTACTS_INNER_PAGES.has(pathname);
  const needsAdminRuntime=ADMIN_RUNTIME_PAGES.has(pathname);
  if(!needsFormBridge&&!needsPortalEntry&&!needsMobileRuntime&&!needsContactsInnerStyle&&!needsAdminRuntime)return context.next();
  const response=await context.next();
  const contentType=response.headers.get('content-type')||'';
  if(!response.ok||!contentType.toLowerCase().includes('text/html'))return response;
  let rewriter=new HTMLRewriter();
  if(needsFormBridge)rewriter=rewriter.on('head',new FormHeadInjector());
  if(needsPortalEntry)rewriter=rewriter.on('head',new PortalEntryHeadInjector());
  if(needsMobileRuntime){
    rewriter=rewriter.on('head',new MobileHeadInjector(MOBILE_HOME_PAGES.has(pathname),MOBILE_CONTACTS_PAGES.has(pathname)));
    rewriter=rewriter.on('meta[name="viewport"]',new MobileViewportNormalizer());
  }
  if(needsContactsInnerStyle)rewriter=rewriter.on('head',new ContactsInnerHeadInjector());
  if(needsAdminRuntime)rewriter=rewriter.on('body',new AdminRuntimeBodyInjector());
  const transformed=rewriter.transform(response);
  const headers=new Headers(transformed.headers);
  headers.delete('content-length');headers.delete('etag');
  if(needsFormBridge)headers.set('x-rona-form-transport','controlled-v1.1');
  if(needsPortalEntry)headers.set('x-rona-portal-entry','g8.2-home-inline-auth-v2');
  if(needsMobileRuntime)headers.set('x-rona-mobile-remediation','v2-design-lock-v2');
  if(needsContactsInnerStyle)headers.set('x-rona-mobile-contacts-underlay','inner-v2');
  if(needsAdminRuntime)headers.set('x-rona-admin-runtime-compat','v1');
  return new Response(transformed.body,{status:transformed.status,statusText:transformed.statusText,headers});
}
