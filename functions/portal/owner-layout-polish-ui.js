const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_OWNER_LAYOUT_POLISH__)return;
window.__RONA_OWNER_LAYOUT_POLISH__='20260824-2236-independent-sections-v2';
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
window.__RONA_CANONICAL_SECTION_RECOVERY__='20260824-independent-access-analytics-v1';
var root=document.documentElement;
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function load(src,id){return new Promise(function(resolve,reject){var old=document.querySelector('script[data-rona-section-recovery="'+id+'"]');if(old){resolve();return}var x=document.createElement('script');x.src=src;x.async=false;x.dataset.ronaSectionRecovery=id;x.onload=function(){resolve()};x.onerror=function(){reject(new Error('SECTION_LOAD_FAILED:'+id))};(document.body||document.documentElement).appendChild(x)})}
async function waitFor(test,label,timeout){var until=Date.now()+timeout;while(Date.now()<until){try{if(test())return true}catch(_e){}await sleep(60)}throw new Error('SECTION_READY_TIMEOUT:'+label)}
function enforce(){if(window.__RONA_CLIENTS_AGENTS_V4_READY__===true){root.classList.add('rona-access-v4-ready');root.classList.remove('rona-access-fallback');root.dataset.ronaAccessRecovery='ready'}if(window.__RONA_ANALYTICS_V2_READY__===true){root.classList.add('rona-analytics-v2-ready');root.classList.remove('rona-analytics-fallback');root.dataset.ronaAnalyticsRecovery='ready'}}
async function access(){try{await load('/portal/clients-agents-canonical-guard-ui?v=20260824-recovery-1','access-guard');await load('/portal/clients-agents-v4-ui?v=20260824-2018-home-parity-v1-recovery-1','access-v4');await waitFor(function(){return window.__RONA_CLIENTS_AGENTS_V4_READY__===true},'ACCESS_V4',7000);enforce()}catch(e){root.classList.add('rona-access-fallback');root.dataset.ronaAccessRecovery='fallback';window.__RONA_ACCESS_RECOVERY_ERROR__=String(e&&e.message||e);console.error('[RONA access independent recovery]',e)}}
async function analytics(){try{await load('/portal/analytics-v2-ui?v=20260824-v3-market-rona-lpg-recovery-1','analytics-v2');await waitFor(function(){return window.__RONA_ANALYTICS_V2_READY__===true},'ANALYTICS_V2',7000);enforce()}catch(e){root.classList.add('rona-analytics-fallback');root.dataset.ronaAnalyticsRecovery='fallback';window.__RONA_ANALYTICS_RECOVERY_ERROR__=String(e&&e.message||e);console.error('[RONA analytics independent recovery]',e)}}
async function run(){try{await waitFor(function(){return window.__RONA_OWNER_ADMIN_READY__===true&&document.querySelector('#page-access')&&document.querySelector('#page-analytics')},'ADMIN_CORE',15000)}catch(e){window.__RONA_SECTION_RECOVERY_ERROR__=String(e&&e.message||e);return}await Promise.allSettled([access(),analytics()]);enforce();window.__RONA_CANONICAL_SECTION_RECOVERY_READY__=window.__RONA_CLIENTS_AGENTS_V4_READY__===true&&window.__RONA_ANALYTICS_V2_READY__===true}
var obs=new MutationObserver(enforce);obs.observe(root,{attributes:true,attributeFilter:['class']});setInterval(enforce,1000);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(run,0)},{once:true});else setTimeout(run,0);
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-owner-layout-polish':'rail-claims-v1; canonical-section-recovery-v1'
  }});
}
