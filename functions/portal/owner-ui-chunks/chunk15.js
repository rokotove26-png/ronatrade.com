import basePrepaintRuntime from './chunk15-base.js';
import adminTopbarTickerSafeRuntime from '../main-ui/admin-topbar-ticker-safe-v2.js';

const paymentsCanonicalFirstPaintGuardRuntime = `(()=>{'use strict';
if(window.__RONA_PAYMENTS_CANONICAL_FIRST_PAINT_GUARD_V3__)return;
window.__RONA_PAYMENTS_CANONICAL_FIRST_PAINT_GUARD_V3__=true;
const STYLE_ID='ronaPaymentsCanonicalFirstPaintGuardV3';
const READY_ATTR='data-rona-payments-canonical-ready';
const CANONICAL_SELECTOR='.rona-payments-v7[data-rona-payments-owner="admin-payments-v7-native-v2"]';
let observedPage=null;
let pageObserver=null;
let syncQueued=false;
function installStyle(){if(document.getElementById(STYLE_ID))return;document.getElementById('ronaPaymentsV8FirstPaintGuard')?.remove();document.getElementById('ronaPaymentsCanonicalFirstPaintGuardV2')?.remove();const s=document.createElement('style');s.id=STYLE_ID;s.textContent='#page-payments:not(['+READY_ATTR+'="1"]){position:relative;min-height:420px}#page-payments:not(['+READY_ATTR+'="1"])>*{display:none!important}#page-payments:not(['+READY_ATTR+'="1"])::before{content:"Загрузка актуальных платежей…";display:grid;place-items:center;min-height:320px;margin:18px 0;padding:24px;border:1px solid rgba(126,170,203,.16);border-radius:20px;background:linear-gradient(180deg,rgba(8,22,33,.72),rgba(5,14,24,.72));color:#9fb4c0;font:600 13px/1.4 system-ui,sans-serif;box-sizing:border-box}';(document.head||document.documentElement).appendChild(s)}
function scheduleSync(){if(syncQueued)return;syncQueued=true;queueMicrotask(syncPage)}
function syncPage(){syncQueued=false;const page=document.getElementById('page-payments');if(page!==observedPage){pageObserver?.disconnect();observedPage=page||null;pageObserver=null;if(observedPage){pageObserver=new MutationObserver(scheduleSync);pageObserver.observe(observedPage,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-rona-payments-owner']});window.__RONA_PAYMENTS_CANONICAL_PAGE_OBSERVER_V3__=pageObserver}}if(!page)return;const canonical=page.querySelector(CANONICAL_SELECTOR);if(canonical&&canonical.isConnected){if(page.getAttribute(READY_ATTR)!=='1')page.setAttribute(READY_ATTR,'1');page.dataset.ronaPaymentsVisualOwner='admin-payments-v7-native-v2'}else{page.removeAttribute(READY_ATTR);delete page.dataset.ronaPaymentsVisualOwner}}
function installGuard(){installStyle();window.__RONA_PAYMENTS_CANONICAL_FIRST_PAINT_OBSERVER_V2__?.disconnect?.();const root=document.documentElement||document;const rootObserver=new MutationObserver(scheduleSync);rootObserver.observe(root,{childList:true,subtree:true});window.__RONA_PAYMENTS_CANONICAL_ROOT_OBSERVER_V3__=rootObserver;syncPage()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGuard,{once:true});else installGuard();
})();`;

export default basePrepaintRuntime + adminTopbarTickerSafeRuntime + paymentsCanonicalFirstPaintGuardRuntime;
