const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_OWNER_LAYOUT_POLISH__)return;
window.__RONA_OWNER_LAYOUT_POLISH__='20260824-1346-rail-claims-v1';
var s=document.createElement('style');
s.id='ronaOwnerLayoutPolishStyle';
s.textContent=[
'#page-monitoring .rona-rail-v4-work{align-items:stretch!important}',
'#page-monitoring .rona-rail-v4-left{height:100%!important;align-self:stretch!important;grid-template-rows:auto minmax(0,1fr)!important}',
'#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child{height:100%!important;min-height:0!important;display:flex!important;flex-direction:column!important}',
'#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child>.rona-rail-v4-table-wrap{flex:1 1 auto!important;min-height:0!important}',
'html body #page-claims>.rona-claims-r2-root{width:min(1480px,calc(100% - 36px))!important;max-width:1480px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}',
'@media(max-width:1040px){#page-monitoring .rona-rail-v4-work{align-items:start!important}#page-monitoring .rona-rail-v4-left{height:auto!important;grid-template-rows:auto auto!important}#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child{height:auto!important}}',
'@media(max-width:980px){html body #page-claims>.rona-claims-r2-root{width:calc(100% - 24px)!important}}'
].join('');
document.head.appendChild(s);

if(location.pathname!=='/portal/admin')return;
if(window.__RONA_CANONICAL_SECTION_RECOVERY__)return;
window.__RONA_CANONICAL_SECTION_RECOVERY__='20260824-independent-access-analytics-v3';
var root=document.documentElement;
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function load(src,id){return new Promise(function(resolve,reject){var old=document.querySelector('script[data-rona-section-recovery="'+id+'"]');if(old){resolve();return}var x=document.createElement('script');x.src=src;x.async=false;x.dataset.ronaSectionRecovery=id;x.onload=function(){resolve()};x.onerror=function(){reject(new Error('SECTION_LOAD_FAILED:'+id))};(document.body||document.documentElement).appendChild(x)})}
async function waitFor(test,label,timeout){var until=Date.now()+timeout;while(Date.now()<until){try{if(test())return true}catch(_e){}await sleep(60)}throw new Error('SECTION_READY_TIMEOUT:'+label)}
function showOwnedPage(pageId,rootId){var p=document.querySelector(pageId),r=p&&p.querySelector(':scope>'+rootId);if(!p||!r)return;p.classList.remove('rona-rs-gated');var loading=p.querySelector(':scope>.rona-rs-loading');if(loading)loading.remove();if(r.style.getPropertyValue('display'))r.style.removeProperty('display');if(r.style.getPropertyValue('visibility'))r.style.removeProperty('visibility');if(r.style.getPropertyValue('opacity'))r.style.removeProperty('opacity');if(r.getAttribute('aria-hidden')==='true')r.removeAttribute('aria-hidden');Array.from(p.children).forEach(function(x){if(x===r)return;if(x.style.getPropertyValue('display')!=='none'||x.style.getPropertyPriority('display')!=='important')x.style.setProperty('display','none','important');if(x.style.getPropertyValue('visibility')!=='hidden'||x.style.getPropertyPriority('visibility')!=='important')x.style.setProperty('visibility','hidden','important');if(x.getAttribute('aria-hidden')!=='true')x.setAttribute('aria-hidden','true')})}
function enforce(){if(window.__RONA_CLIENTS_AGENTS_V4_READY__===true){root.classList.add('rona-access-v4-ready');root.classList.remove('rona-access-fallback');root.dataset.ronaAccessRecovery='ready';showOwnedPage('#page-access','#rona-ca4')}if(window.__RONA_ANALYTICS_V2_READY__===true){root.classList.add('rona-analytics-v2-ready');root.classList.remove('rona-analytics-fallback');root.dataset.ronaAnalyticsRecovery='ready';showOwnedPage('#page-analytics','#rona-analytics-v2')}}
function watchPages(){['#page-access','#page-analytics'].forEach(function(sel){var p=document.querySelector(sel);if(!p||p.__ronaCanonicalOwnerWatch)return;p.__ronaCanonicalOwnerWatch=true;new MutationObserver(function(){enforce()}).observe(p,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','aria-hidden']})});document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest&&ev.target.closest('#nav button[data-page]');if(!b||!['access','analytics'].includes(String(b.dataset.page||'')))return;[0,60,160,360,800,1600].forEach(function(ms){setTimeout(enforce,ms)})},true)}
async function access(){try{await load('/portal/clients-agents-canonical-guard-ui?v=20260824-recovery-3','access-guard');try{await waitFor(function(){return window.__RONA_ACCESS_FUNCTIONAL_ARCHIVE_READY__===true||window.__RONA_CLIENTS_AGENTS_V4_READY__===true},'ACCESS_ARCHIVE_OR_READY',7000)}catch(e){window.__RONA_ACCESS_RECOVERY_ARCHIVE_WARNING__=String(e&&e.message||e)}if(window.__RONA_CLIENTS_AGENTS_V4_READY__===true){enforce();return}await load('/portal/clients-agents-v4-ui?v=20260824-2018-home-parity-v1-recovery-3','access-v4');await waitFor(function(){return window.__RONA_CLIENTS_AGENTS_V4_READY__===true},'ACCESS_V4',7000);enforce()}catch(e){root.classList.add('rona-access-fallback');root.dataset.ronaAccessRecovery='fallback';window.__RONA_ACCESS_RECOVERY_ERROR__=String(e&&e.message||e);console.error('[RONA access independent recovery]',e)}}
async function analytics(){try{await load('/portal/analytics-v2-ui?v=20260824-v3-market-rona-lpg-recovery-3','analytics-v2');await waitFor(function(){return window.__RONA_ANALYTICS_V2_READY__===true},'ANALYTICS_V2',7000);enforce()}catch(e){root.classList.add('rona-analytics-fallback');root.dataset.ronaAnalyticsRecovery='fallback';window.__RONA_ANALYTICS_RECOVERY_ERROR__=String(e&&e.message||e);console.error('[RONA analytics independent recovery]',e)}}
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
    'x-rona-owner-layout-polish':'rail-claims-v1'
  }});
}
