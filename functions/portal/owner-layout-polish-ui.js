const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_OWNER_LAYOUT_POLISH__)return;
window.__RONA_OWNER_LAYOUT_POLISH__='20260824-1346-rail-claims-v1';
window.__RONA_SECTION_VISUAL_HARMONY__='20260824-home-parity-v1';
var s=document.createElement('style');
s.id='ronaOwnerLayoutPolishStyle';
s.textContent=[
'#page-monitoring .rona-rail-v4-work{align-items:stretch!important}',
'#page-monitoring .rona-rail-v4-left{height:100%!important;align-self:stretch!important;grid-template-rows:auto minmax(0,1fr)!important}',
'#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child{height:100%!important;min-height:0!important;display:flex!important;flex-direction:column!important}',
'#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child>.rona-rail-v4-table-wrap{flex:1 1 auto!important;min-height:0!important}',
'html body #page-claims>.rona-claims-r2-root{width:min(1480px,calc(100% - 36px))!important;max-width:1480px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}',
'html.rona-visual-v2 #page-access #rona-ca4>.ca4-hero.rona-visual-hero,html.rona-visual-v2 #page-analytics #rona-analytics-v2>.an2-head.rona-visual-hero{position:relative!important;overflow:hidden!important;display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:20px!important;min-height:132px!important;margin:0 0 16px!important;padding:26px 28px!important;border:1px solid rgba(118,211,255,.18)!important;border-radius:26px!important;background:radial-gradient(420px 160px at 90% 0%,rgba(89,215,255,.17),transparent 65%),linear-gradient(135deg,rgba(13,24,36,.96),rgba(9,15,24,.82) 58%,rgba(15,22,35,.9))!important;box-shadow:0 22px 70px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.035)!important;backdrop-filter:blur(22px) saturate(130%)!important}',
'html.rona-visual-v2 #page-access #rona-ca4>.ca4-hero.rona-visual-hero .rona-visual-kicker,html.rona-visual-v2 #page-analytics #rona-analytics-v2>.an2-head.rona-visual-hero .rona-visual-kicker{margin-bottom:8px!important;color:var(--rv-cyan,#59d7ff)!important;font-size:11px!important;font-weight:850!important;letter-spacing:.17em!important;text-transform:uppercase!important}',
'html.rona-visual-v2 #page-access #rona-ca4>.ca4-hero.rona-visual-hero .rona-visual-title,html.rona-visual-v2 #page-analytics #rona-analytics-v2>.an2-head.rona-visual-hero .rona-visual-title{display:block!important;visibility:visible!important;opacity:1!important;margin:0!important;color:#fff!important;font-size:clamp(28px,3.1vw,44px)!important;line-height:1.02!important;font-weight:900!important;letter-spacing:-.035em!important}',
'html.rona-visual-v2 #page-access #rona-ca4>.ca4-hero.rona-visual-hero .rona-visual-sub,html.rona-visual-v2 #page-analytics #rona-analytics-v2>.an2-head.rona-visual-hero .rona-visual-sub{max-width:720px!important;margin-top:10px!important;color:var(--rv-muted,#91a2b3)!important;font-size:13px!important;line-height:1.55!important;opacity:1!important}',
'html.rona-visual-v2 #page-analytics #rona-analytics-v2.an2{width:min(100%,1360px)!important;max-width:1360px!important;margin-left:auto!important;margin-right:auto!important;gap:14px!important;box-sizing:border-box!important}',
'html.rona-visual-v2 #page-analytics #rona-analytics-v2>.an2-head.rona-visual-hero>.rona-fin-pill{display:none!important}',
'html.rona-visual-v2 #page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:minmax(0,1.55fr) minmax(300px,.72fr)!important;gap:14px!important}',
'html.rona-visual-v2 #page-analytics #rona-analytics-v2 .an2-kpis{gap:14px!important}',
'@media(max-width:1040px){#page-monitoring .rona-rail-v4-work{align-items:start!important}#page-monitoring .rona-rail-v4-left{height:auto!important;grid-template-rows:auto auto!important}#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child{height:auto!important}}',
'@media(max-width:1050px){html.rona-visual-v2 #page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:1fr!important}}',
'@media(max-width:980px){html body #page-claims>.rona-claims-r2-root{width:calc(100% - 24px)!important}}',
'@media(max-width:680px){html.rona-visual-v2 #page-access #rona-ca4>.ca4-hero.rona-visual-hero,html.rona-visual-v2 #page-analytics #rona-analytics-v2>.an2-head.rona-visual-hero{min-height:0!important;padding:22px 20px!important;border-radius:22px!important}html.rona-visual-v2 #page-analytics #rona-analytics-v2.an2{width:100%!important;max-width:none!important}}'
].join('');
document.head.appendChild(s);

if(location.pathname!=='/portal/admin')return;
if(window.__RONA_CANONICAL_SECTION_RECOVERY__)return;
window.__RONA_CANONICAL_SECTION_RECOVERY__='20260824-independent-access-analytics-v5';
var root=document.documentElement,busy=false,harmonyBusy=false;
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function load(src,id){return new Promise(function(resolve,reject){var old=document.querySelector('script[data-rona-section-recovery="'+id+'"]');if(old){resolve();return}var x=document.createElement('script');x.src=src;x.async=false;x.dataset.ronaSectionRecovery=id;x.onload=function(){resolve()};x.onerror=function(){reject(new Error('SECTION_LOAD_FAILED:'+id))};(document.body||document.documentElement).appendChild(x)})}
async function waitFor(test,label,timeout){var until=Date.now()+timeout;while(Date.now()<until){try{if(test())return true}catch(_e){}await sleep(60)}throw new Error('SECTION_READY_TIMEOUT:'+label)}
function forceStyle(el,name,value){if(el.style.getPropertyValue(name)!==value||el.style.getPropertyPriority(name)!=='important')el.style.setProperty(name,value,'important')}
function showOwnedPage(pageId,rootId){var p=document.querySelector(pageId),r=p&&p.querySelector(':scope>'+rootId);if(!p||!r)return;if(p.classList.contains('rona-rs-gated'))p.classList.remove('rona-rs-gated');var loading=p.querySelector(':scope>.rona-rs-loading');if(loading)loading.remove();forceStyle(r,'display','grid');forceStyle(r,'visibility','visible');forceStyle(r,'opacity','1');forceStyle(r,'pointer-events','auto');if(r.hasAttribute('aria-hidden'))r.removeAttribute('aria-hidden');Array.from(p.children).forEach(function(x){if(x===r)return;forceStyle(x,'display','none');forceStyle(x,'visibility','hidden');forceStyle(x,'opacity','0');forceStyle(x,'pointer-events','none');if(x.getAttribute('aria-hidden')!=='true')x.setAttribute('aria-hidden','true')})}
function prepHero(hero){if(!hero)return;hero.classList.remove('rona-owner-card');hero.classList.add('rona-visual-hero');var copy=hero.firstElementChild;if(!copy)return;var title=copy.querySelector('.ca4-title,.rona-visual-title,h1,h2');if(title){title.classList.add('rona-visual-title');title.removeAttribute('aria-hidden');title.style.removeProperty('display');title.style.removeProperty('visibility');title.style.removeProperty('opacity');if(title.dataset&&title.dataset.ronaVisualDuplicateTitle)delete title.dataset.ronaVisualDuplicateTitle}var sub=copy.querySelector('.ca4-sub,.rona-visual-sub,p');if(sub){sub.classList.remove('rona-owner-muted');sub.classList.add('rona-visual-sub')}if(!copy.querySelector(':scope>.rona-visual-kicker')){var k=document.createElement('div');k.className='rona-visual-kicker';k.textContent='RONA TRADE · OPERATIONS';copy.insertBefore(k,copy.firstChild)}}
function watchHarmonyRoot(node){if(!node||node.__ronaHarmonyWatch)return;node.__ronaHarmonyWatch=true;new MutationObserver(function(){queueMicrotask(harmonizeSections)}).observe(node,{childList:true})}
function harmonizeSections(){if(harmonyBusy)return;harmonyBusy=true;try{var access=document.querySelector('#rona-ca4');if(access){prepHero(access.querySelector(':scope>.ca4-hero'));watchHarmonyRoot(access)}var analytics=document.querySelector('#rona-analytics-v2');if(analytics){var head=analytics.querySelector(':scope>.an2-head');if(head){prepHero(head);var badge=head.querySelector(':scope>.rona-fin-pill');if(badge)badge.remove()}watchHarmonyRoot(analytics)}}finally{harmonyBusy=false}}
function enforce(){if(busy)return;busy=true;try{if(window.__RONA_CLIENTS_AGENTS_V4_READY__===true){root.classList.add('rona-access-v4-ready');root.classList.remove('rona-access-fallback');root.dataset.ronaAccessRecovery='ready';showOwnedPage('#page-access','#rona-ca4')}if(window.__RONA_ANALYTICS_V2_READY__===true){root.classList.add('rona-analytics-v2-ready');root.classList.remove('rona-analytics-fallback');root.dataset.ronaAnalyticsRecovery='ready';showOwnedPage('#page-analytics','#rona-analytics-v2')}harmonizeSections()}finally{busy=false}}
function watchPages(){['#page-access','#page-analytics'].forEach(function(sel){var p=document.querySelector(sel);if(!p||p.__ronaCanonicalOwnerWatch)return;p.__ronaCanonicalOwnerWatch=true;new MutationObserver(function(){queueMicrotask(enforce)}).observe(p,{childList:true})});document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest&&ev.target.closest('#nav button[data-page]');if(!b||!['access','analytics'].includes(String(b.dataset.page||'')))return;[0,60,160,360,800,1600].forEach(function(ms){setTimeout(enforce,ms)})},true)}
async function access(){try{await load('/portal/clients-agents-canonical-guard-ui?v=20260824-recovery-5','access-guard');try{await waitFor(function(){return window.__RONA_ACCESS_FUNCTIONAL_ARCHIVE_READY__===true||window.__RONA_CLIENTS_AGENTS_V4_READY__===true},'ACCESS_ARCHIVE_OR_READY',7000)}catch(e){window.__RONA_ACCESS_RECOVERY_ARCHIVE_WARNING__=String(e&&e.message||e)}if(window.__RONA_CLIENTS_AGENTS_V4_READY__===true){enforce();return}await load('/portal/clients-agents-v4-ui?v=20260824-2018-home-parity-v1-recovery-5','access-v4');await waitFor(function(){return window.__RONA_CLIENTS_AGENTS_V4_READY__===true},'ACCESS_V4',7000);enforce()}catch(e){root.classList.add('rona-access-fallback');root.dataset.ronaAccessRecovery='fallback';window.__RONA_ACCESS_RECOVERY_ERROR__=String(e&&e.message||e);console.error('[RONA access independent recovery]',e)}}
async function analytics(){try{await load('/portal/analytics-v2-ui?v=20260824-v3-market-rona-lpg-recovery-5','analytics-v2');await waitFor(function(){return window.__RONA_ANALYTICS_V2_READY__===true},'ANALYTICS_V2',7000);enforce()}catch(e){root.classList.add('rona-analytics-fallback');root.dataset.ronaAnalyticsRecovery='fallback';window.__RONA_ANALYTICS_RECOVERY_ERROR__=String(e&&e.message||e);console.error('[RONA analytics independent recovery]',e)}}
async function run(){try{await waitFor(function(){return window.__RONA_OWNER_ADMIN_READY__===true&&document.querySelector('#page-access')&&document.querySelector('#page-analytics')},'ADMIN_CORE',15000)}catch(e){window.__RONA_SECTION_RECOVERY_ERROR__=String(e&&e.message||e);return}watchPages();await Promise.allSettled([access(),analytics()]);enforce();window.__RONA_CANONICAL_SECTION_RECOVERY_READY__=window.__RONA_CLIENTS_AGENTS_V4_READY__===true&&window.__RONA_ANALYTICS_V2_READY__===true}
setInterval(enforce,1000);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(run,0)},{once:true});else setTimeout(run,0);
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-owner-layout-polish':'rail-claims-v1',
    'x-rona-section-visual-harmony':'home-parity-v1'
  }});
}