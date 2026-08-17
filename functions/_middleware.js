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
const STAFF_RUNTIME_PAGES = new Set(['/portal/staff']);
const SESSION_MENU_PAGES = new Set(['/portal/agent','/portal/client']);

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
const STAFF_LOGOUT_BUTTON = `<button class="btn" id="ronaLogout" type="button">Выйти</button>`;
const ADMIN_RUNTIME_COMPAT = `<script id="rona-admin-runtime-compat-v1">
(()=>{
  'use strict';
  if(window.__RONA_ADMIN_RUNTIME_COMPAT_V1__)return;
  window.__RONA_ADMIN_RUNTIME_COMPAT_V1__=true;
  const disableLegacySnapshotRenderer=()=>{
    if(window.__RONA_ADMIN_LIVE_READY__!==true)return;
    window.renderPage=()=>{};
    window.__RONA_ADMIN_LEGACY_SNAPSHOT_RENDER_DISABLED__=true;
  };
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
  const onLive=()=>{disableLegacySnapshotRenderer();stamp()};
  const install=()=>{stamp();disableLegacySnapshotRenderer();const home=document.getElementById('page-home');if(home)new MutationObserver(stamp).observe(home,{childList:true,subtree:true});document.addEventListener('rona:admin-live-ready',onLive);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
const SESSION_MENU_SCRIPT = `<script id="rona-portal-session-menu-v1">
(()=>{
  'use strict';
  if(window.__RONA_PORTAL_SESSION_MENU_V1__)return;
  window.__RONA_PORTAL_SESSION_MENU_V1__=true;
  const install=()=>{
    const agent=document.getElementById('agentAuthState');
    const client=document.querySelector('.top-right .pill.green');
    const anchor=agent||client;
    if(!anchor)return;
    anchor.setAttribute('role','button');anchor.setAttribute('tabindex','0');anchor.setAttribute('aria-haspopup','menu');anchor.setAttribute('title','Меню сеанса');
    let menu=null;
    const close=()=>{if(menu){menu.remove();menu=null}anchor.setAttribute('aria-expanded','false')};
    const open=()=>{if(menu){close();return}const r=anchor.getBoundingClientRect();menu=document.createElement('div');menu.id='ronaPortalSessionMenu';menu.setAttribute('role','menu');menu.style.cssText='position:fixed;z-index:2147483000;top:'+Math.min(innerHeight-58,r.bottom+8)+'px;right:'+Math.max(12,innerWidth-r.right)+'px;padding:6px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:#0b141b;box-shadow:0 12px 34px rgba(0,0,0,.36)';menu.innerHTML='<button id="ronaPortalLogoutMenuButton" type="button" role="menuitem" style="border:1px solid rgba(255,255,255,.16);background:#17232a;color:#fff;border-radius:8px;padding:8px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer">Выйти</button>';document.body.appendChild(menu);anchor.setAttribute('aria-expanded','true');menu.querySelector('#ronaPortalLogoutMenuButton').focus()};
    anchor.addEventListener('click',e=>{e.preventDefault();open()});
    anchor.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}else if(e.key==='Escape')close()});
    document.addEventListener('click',e=>{if(menu&&!menu.contains(e.target)&&e.target!==anchor)close()},true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
const AGENT_ACTION_RUNTIME = `<script id="rona-agent-live-action-runtime-v1">
(()=>{
  'use strict';
  if(window.__RONA_AGENT_LIVE_ACTION_RUNTIME_V1__)return;
  window.__RONA_AGENT_LIVE_ACTION_RUNTIME_V1__=true;
  const sendEvent=async body=>{const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random());const r=await fetch('/portal/api/v1/events',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json','x-idempotency-key':'agent-ui-'+id},body:JSON.stringify({...body,idempotency_key:'agent-ui-'+id})});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.code||('HTTP_'+r.status));return j};
  const classify=()=>{document.querySelectorAll('button,a,input,select,textarea').forEach(el=>{const cs=getComputedStyle(el),r=el.getBoundingClientRect();if(cs.display==='none'||cs.visibility==='hidden'||r.width===0||r.height===0)return;el.dataset.ronaControlStatus=el.disabled||el.getAttribute('aria-disabled')==='true'?'INTENTIONALLY_READ_ONLY_BY_AUTHORITY':'FUNCTIONAL'})};
  document.addEventListener('click',async e=>{const btn=e.target.closest('#page-messages button.btn');if(!btn||String(btn.textContent||'').trim()!=='Отправить')return;e.preventDefault();e.stopImmediatePropagation();const page=document.getElementById('page-messages'),sel=page?.querySelector('select'),subject=page?.querySelector('input')?.value.trim(),message=page?.querySelector('textarea')?.value.trim(),dealId=String(sel?.value||'').trim();if(!/^DEAL-\d{4}-\d{3,}$/.test(dealId)||!subject||!message){window.toast?.('Укажите разрешённую сделку, тему и сообщение.');return}btn.disabled=true;try{const j=await sendEvent({role:'AGENT',event_type:'AGENT_MESSAGE_SUBMIT',authority_domain:'AGENT_PORTAL',authority_target_type:'DEAL',authority_target_id:dealId,deal_id:dealId,payload:{subject,message}});window.toast?.('Сообщение зарегистрировано: '+String(j.event?.event_id||''));if(page?.querySelector('input'))page.querySelector('input').value='';if(page?.querySelector('textarea'))page.querySelector('textarea').value=''}catch(err){window.toast?.('Сообщение не отправлено: '+String(err.message||err))}finally{btn.disabled=false;classify()}},true);
  const install=()=>{classify();new MutationObserver(classify).observe(document.documentElement,{subtree:true,childList:true})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
const CLIENT_ACTION_RUNTIME = `<script id="rona-client-live-action-runtime-v1">
(()=>{
  'use strict';
  if(window.__RONA_CLIENT_LIVE_ACTION_RUNTIME_V1__)return;
  window.__RONA_CLIENT_LIVE_ACTION_RUNTIME_V1__=true;
  const event=async body=>{const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random());const r=await fetch('/portal/api/v1/events',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json','x-idempotency-key':'client-ui-'+id},body:JSON.stringify({...body,idempotency_key:'client-ui-'+id})});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.code||('HTTP_'+r.status));return j};
  const current=()=>{try{return window.CLIENT_CONTEXTS?.[window.activeClientContractId]||window.activeClientContext?.()||null}catch(_e){return null}};
  const toastText=t=>{try{window.toast?.(t)}catch(_e){}};
  const classify=()=>{document.querySelectorAll('button,a,input,select,textarea,form').forEach(el=>{const cs=getComputedStyle(el),r=el.getBoundingClientRect();if(cs.display==='none'||cs.visibility==='hidden'||r.width===0||r.height===0)return;let s='FUNCTIONAL';if(el.disabled||el.getAttribute('aria-disabled')==='true')s='INTENTIONALLY_READ_ONLY_BY_AUTHORITY';if(el.id==='claimSubmitBtn'||el.id==='sendPaymentProof'||el.closest?.('#ronaOrderForm')?.matches?.('form')&&el.type==='submit')s='INTENTIONALLY_READ_ONLY_BY_AUTHORITY';el.dataset.ronaControlStatus=s})};
  document.addEventListener('click',async e=>{const send=e.target.closest('#sendMessage');if(send){e.preventDefault();e.stopImmediatePropagation();const c=current(),box=document.getElementById('page-messages'),subject=box?.querySelector('#msgSubject')?.value.trim(),message=box?.querySelector('#msgText')?.value.trim(),object=String(box?.querySelector('#messageObject')?.value||'').trim(),file=box?.querySelector('input[type=file]')?.files?.[0];if(!c||!subject||!message){toastText('Укажите тему и сообщение.');return}if(file){toastText('Вложения требуют авторитетного хранилища; сообщение не отправлено.');return}const dealId=(object.match(/DEAL-\d{4}-\d{3,}/)||[])[0]||null;send.disabled=true;try{const j=await event({role:'CLIENT',event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'CLIENT_PORTAL',authority_target_type:dealId?'DEAL':'CONTRACT',authority_target_id:dealId||c.contractId,client_id:c.clientId,contract_id:c.contractId,deal_id:dealId,payload:{subject,message,object}});toastText('Сообщение зарегистрировано: '+String(j.event?.event_id||''));box.querySelector('#msgSubject').value='';box.querySelector('#msgText').value=''}catch(err){toastText('Сообщение не отправлено: '+String(err.message||err))}finally{send.disabled=false;classify()}return}const claim=e.target.closest('#claimSubmitBtn');if(claim){e.preventDefault();e.stopImmediatePropagation();toastText('Регистрация претензии доступна после подключения авторитетного PDF-хранилища. Претензия не зарегистрирована.');return}const proof=e.target.closest('#sendPaymentProof');if(proof){e.preventDefault();e.stopImmediatePropagation();toastText('Передача платёжного PDF доступна после подключения авторитетного хранилища. Банковский статус не изменён.');return}},true);
  document.addEventListener('submit',e=>{if(e.target?.id!=='ronaOrderForm')return;e.preventDefault();e.stopImmediatePropagation();toastText('Подача заявки из ценовой формы требует серверно подтверждённых параметров страны и станции назначения. Заявка не зарегистрирована.');classify()},true);
  const install=()=>{classify();new MutationObserver(classify).observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('rona:client-live-ready',classify)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;

class FormHeadInjector { element(element){ element.prepend(BRIDGE_SCRIPT,{html:true}); } }
class PortalEntryHeadInjector { element(element){ element.prepend(PORTAL_ENTRY_SCRIPT,{html:true}); } }
class MobileHeadInjector { constructor(isHome,isContacts){this.isHome=isHome;this.isContacts=isContacts} element(element){element.prepend(`${this.isHome?MOBILE_HOME_STYLE:''}${this.isContacts?MOBILE_CONTACTS_STYLE:''}${MOBILE_RUNTIME}`,{html:true})} }
class ContactsInnerHeadInjector { element(element){element.prepend(MOBILE_CONTACTS_STYLE,{html:true})} }
class MobileViewportNormalizer { element(element){element.setAttribute('content','width=device-width,initial-scale=1,viewport-fit=cover')} }
class AdminRuntimeBodyInjector { element(element){element.append(ADMIN_RUNTIME_COMPAT,{html:true})} }
class StaffRefreshInjector { element(element){element.after(STAFF_LOGOUT_BUTTON,{html:true})} }
class SessionMenuBodyInjector { constructor(path){this.path=path} element(element){const actions=this.path==='/portal/agent'?AGENT_ACTION_RUNTIME:CLIENT_ACTION_RUNTIME;element.append(SESSION_MENU_SCRIPT+actions,{html:true})} }

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
  const needsStaffRuntime=STAFF_RUNTIME_PAGES.has(pathname);
  const needsSessionMenu=SESSION_MENU_PAGES.has(pathname);
  if(!needsFormBridge&&!needsPortalEntry&&!needsMobileRuntime&&!needsContactsInnerStyle&&!needsAdminRuntime&&!needsStaffRuntime&&!needsSessionMenu)return context.next();
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
  if(needsStaffRuntime)rewriter=rewriter.on('#refresh',new StaffRefreshInjector());
  if(needsSessionMenu)rewriter=rewriter.on('body',new SessionMenuBodyInjector(pathname));
  const transformed=rewriter.transform(response);
  const headers=new Headers(transformed.headers);
  headers.delete('content-length');headers.delete('etag');
  if(needsFormBridge)headers.set('x-rona-form-transport','controlled-v1.1');
  if(needsPortalEntry)headers.set('x-rona-portal-entry','g8.2-home-inline-auth-v2');
  if(needsMobileRuntime)headers.set('x-rona-mobile-remediation','v2-design-lock-v2');
  if(needsContactsInnerStyle)headers.set('x-rona-mobile-contacts-underlay','inner-v2');
  if(needsAdminRuntime)headers.set('x-rona-admin-runtime-compat','v1');
  if(needsStaffRuntime)headers.set('x-rona-staff-root-logout','v1');
  if(needsSessionMenu)headers.set('x-rona-portal-session-menu','v1');
  return new Response(transformed.body,{status:transformed.status,statusText:transformed.statusText,headers});
}
