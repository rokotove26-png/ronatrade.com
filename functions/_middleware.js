const FORM_TRANSPORT_MAP = Object.freeze({
  'https://formsubmit.co/ajax/office_kg@ronaoil.com': '/api/forms/trade',
  'https://formsubmit.co/ajax/rokotove26@gmail.com': '/api/forms/investments'
});

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

const BRIDGE_SCRIPT = `<script id="rona-controlled-form-transport-v1-1">
(()=>{
  'use strict';
  if(window.__RONA_CONTROLLED_FORM_TRANSPORT__) return;
  window.__RONA_CONTROLLED_FORM_TRANSPORT__ = true;
  const MAP = Object.freeze({'https://formsubmit.co/ajax/office_kg@ronaoil.com':'/api/forms/trade','https://formsubmit.co/ajax/rokotove26@gmail.com':'/api/forms/investments'});
  function rawUrl(input){if(typeof input === 'string') return input;if(input instanceof URL) return input.href;return input && typeof input.url === 'string' ? input.url : ''}
  function absoluteTarget(target){return new URL(target, window.location.origin).href}
  function remapInput(input){const target=MAP[rawUrl(input)];if(!target)return input;const url=absoluteTarget(target);return input instanceof Request?new Request(url,input):url}
  const parentFetch=window.fetch.bind(window);window.fetch=(input,init)=>parentFetch(remapInput(input),init);
  try{const descriptor=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'srcdoc');if(descriptor&&descriptor.get&&descriptor.set&&descriptor.configurable){Object.defineProperty(HTMLIFrameElement.prototype,'srcdoc',{configurable:descriptor.configurable,enumerable:descriptor.enumerable,get:descriptor.get,set(value){if(typeof value==='string'){for(const [from,to] of Object.entries(MAP))value=value.split(from).join(absoluteTarget(to))}return descriptor.set.call(this,value)}})}}catch(_){}
  function patchFrame(frame){try{const w=frame&&frame.contentWindow;if(!w||w.__RONA_CONTROLLED_FORM_TRANSPORT__)return;const frameFetch=w.fetch.bind(w);w.fetch=(input,init)=>{const target=MAP[rawUrl(input)];if(!target)return frameFetch(input,init);const url=absoluteTarget(target);const nextInput=input instanceof w.Request?new w.Request(url,input):url;return frameFetch(nextInput,init)};w.__RONA_CONTROLLED_FORM_TRANSPORT__=true}catch(_){}}
  function installFrameBridges(){document.querySelectorAll('iframe').forEach(frame=>{frame.addEventListener('load',()=>patchFrame(frame));patchFrame(frame)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installFrameBridges,{once:true});else installFrameBridges();
})();
</script>`;

const PORTAL_ENTRY_SCRIPT = `<script id="rona-canonical-portal-entry-g82">
(()=>{
 'use strict';
 if(window.__RONA_CANONICAL_PORTAL_ENTRY_G82__)return;
 window.__RONA_CANONICAL_PORTAL_ENTRY_G82__=true;
 const DEST='/portal/login';
 const labels=['личный кабинет','personal account','client portal'];
 const norm=v=>String(v||'').replace(/\\s+/g,' ').trim().toLowerCase();
 function labelNode(doc){
   const nodes=doc.querySelectorAll('h1,h2,h3,h4,strong,b,span,div,p,a,button,label');
   for(const el of nodes){const t=norm(el.textContent);if(t&&t.length<90&&labels.some(x=>t===x||t.includes(x)))return el}
   return null;
 }
 function containerFor(el){
   let cur=el;
   for(let i=0;i<8&&cur&&cur.parentElement;i++,cur=cur.parentElement){
     const txt=norm(cur.textContent);const hasCredential=!!cur.querySelector?.('input[type="password"],input[name*="pass" i]');const hasAction=!!cur.querySelector?.('button,input[type="submit"],a');
     if((hasCredential&&hasAction)||(hasAction&&txt.length<900&&txt.includes(norm(el.textContent))))return cur;
   }
   return el.parentElement||el;
 }
 function wireDoc(doc){
   try{
     if(!doc||!doc.documentElement||doc.documentElement.dataset.ronaPortalEntryG82==='1')return false;
     const label=labelNode(doc);if(!label)return false;
     const host=containerFor(label);if(!host)return false;
     doc.documentElement.dataset.ronaPortalEntryG82='1';
     host.querySelectorAll('input,textarea').forEach(x=>{x.disabled=true;x.tabIndex=-1;x.setAttribute('aria-hidden','true')});
     host.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();window.top.location.assign(DEST)},{capture:true}));
     const cs=doc.defaultView?.getComputedStyle(host);if(!cs||cs.position==='static')host.style.position='relative';
     const a=doc.createElement('a');a.href=DEST;a.target='_top';a.setAttribute('aria-label','Личный кабинет RONA Trade');a.title='Личный кабинет';a.dataset.ronaPortalOverlay='g82';a.style.cssText='position:absolute;inset:0;z-index:2147483000;display:block;background:transparent;cursor:pointer;text-decoration:none;color:transparent;font-size:0';host.appendChild(a);
     return true;
   }catch(_){return false}
 }
 function frames(){let ok=wireDoc(document);document.querySelectorAll('iframe').forEach(frame=>{const run=()=>{try{if(wireDoc(frame.contentDocument))ok=true}catch(_){}};frame.addEventListener('load',run);run()});return ok}
 function fallback(){if(document.getElementById('ronaPortalFallbackG82'))return;const a=document.createElement('a');a.id='ronaPortalFallbackG82';a.href=DEST;a.textContent=document.documentElement.lang?.toLowerCase().startsWith('en')?'Personal account':'Личный кабинет';a.style.cssText='position:fixed;right:18px;top:16px;z-index:2147483000;padding:9px 13px;border:1px solid rgba(40,40,40,.25);border-radius:8px;background:rgba(255,255,255,.92);color:#202124;text-decoration:none;font:600 13px/1.2 Arial,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.12)';document.body.appendChild(a)}
 function install(){const ok=frames();setTimeout(()=>{if(!frames()&&!ok)fallback()},1200);setTimeout(frames,2600)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;

const MOBILE_RUNTIME = `<script id="rona-mobile-remediation-loader-v2" src="/assets/mobile/rona-mobile-remediation-v2.js" defer></script><script id="rona-mobile-design-lock-loader-v2" src="/assets/mobile/rona-mobile-design-lock-v2.js" defer></script>`;
const MOBILE_HOME_STYLE = `<link id="rona-mobile-home-style-v2" rel="stylesheet" href="/assets/mobile/rona-mobile-home-v2.css">`;
const MOBILE_CONTACTS_STYLE = `<link id="rona-mobile-contacts-underlay-style-v2" rel="stylesheet" href="/assets/mobile/rona-mobile-contacts-underlay-v2.css">`;

class FormHeadInjector { element(element) { element.prepend(BRIDGE_SCRIPT, { html: true }); } }
class PortalEntryHeadInjector { element(element) { element.prepend(PORTAL_ENTRY_SCRIPT, { html: true }); } }
class MobileHeadInjector { constructor(isHome,isContacts){this.isHome=isHome;this.isContacts=isContacts} element(element){element.prepend(`${this.isHome?MOBILE_HOME_STYLE:''}${this.isContacts?MOBILE_CONTACTS_STYLE:''}${MOBILE_RUNTIME}`,{html:true})} }
class ContactsInnerHeadInjector { element(element){element.prepend(MOBILE_CONTACTS_STYLE,{html:true})} }
class MobileViewportNormalizer { element(element){element.setAttribute('content','width=device-width,initial-scale=1,viewport-fit=cover')} }

function canonicalHostRedirect(request){const url=new URL(request.url);if(url.hostname.toLowerCase()!=='www.ronaoil.com')return null;url.protocol='https:';url.hostname='ronaoil.com';url.port='';return Response.redirect(url.toString(),308)}

export async function onRequest(context){
  const {request}=context;if(request.method!=='GET')return context.next();
  const hostRedirect=canonicalHostRedirect(request);if(hostRedirect)return hostRedirect;
  const pathname=new URL(request.url).pathname;
  const needsFormBridge=FORM_PAGES.has(pathname),needsPortalEntry=PORTAL_ENTRY_PAGES.has(pathname),needsMobileRuntime=MOBILE_REMEDIATION_PAGES.has(pathname),needsContactsInnerStyle=MOBILE_CONTACTS_INNER_PAGES.has(pathname);
  if(!needsFormBridge&&!needsPortalEntry&&!needsMobileRuntime&&!needsContactsInnerStyle)return context.next();
  const response=await context.next();const contentType=response.headers.get('content-type')||'';if(!response.ok||!contentType.toLowerCase().includes('text/html'))return response;
  let rewriter=new HTMLRewriter();
  if(needsFormBridge)rewriter=rewriter.on('head',new FormHeadInjector());
  if(needsPortalEntry)rewriter=rewriter.on('head',new PortalEntryHeadInjector());
  if(needsMobileRuntime){rewriter=rewriter.on('head',new MobileHeadInjector(MOBILE_HOME_PAGES.has(pathname),MOBILE_CONTACTS_PAGES.has(pathname)));rewriter=rewriter.on('meta[name="viewport"]',new MobileViewportNormalizer())}
  if(needsContactsInnerStyle)rewriter=rewriter.on('head',new ContactsInnerHeadInjector());
  const transformed=rewriter.transform(response);const headers=new Headers(transformed.headers);headers.delete('content-length');headers.delete('etag');
  if(needsFormBridge)headers.set('x-rona-form-transport','controlled-v1.1');if(needsPortalEntry)headers.set('x-rona-portal-entry','g8.2-canonical');if(needsMobileRuntime)headers.set('x-rona-mobile-remediation','v2-design-lock-v2');if(needsContactsInnerStyle)headers.set('x-rona-mobile-contacts-underlay','inner-v2');
  return new Response(transformed.body,{status:transformed.status,statusText:transformed.statusText,headers});
}
