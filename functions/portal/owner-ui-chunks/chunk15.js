import basePrepaintRuntime from './chunk15-base.js';
import adminTopbarTickerSafeRuntime from '../main-ui/admin-topbar-ticker-safe-v2.js';

const paymentsCanonicalFirstPaintGuardRuntime = `(()=>{'use strict';
if(window.__RONA_PAYMENTS_CANONICAL_FIRST_PAINT_GUARD_V2__)return;
window.__RONA_PAYMENTS_CANONICAL_FIRST_PAINT_GUARD_V2__=true;
const STYLE_ID='ronaPaymentsCanonicalFirstPaintGuardV2';
const READY_ATTR='data-rona-payments-canonical-ready';
const CANONICAL_SELECTOR='.rona-payments-v7[data-rona-payments-owner="admin-payments-v7-native-v2"]';
function installStyle(){if(document.getElementById(STYLE_ID))return;document.getElementById('ronaPaymentsV8FirstPaintGuard')?.remove();const s=document.createElement('style');s.id=STYLE_ID;s.textContent='#page-payments:not(['+READY_ATTR+'="1"]){position:relative;min-height:420px}#page-payments:not(['+READY_ATTR+'="1"])>*{display:none!important}#page-payments:not(['+READY_ATTR+'="1"])::before{content:"Загрузка актуальных платежей…";display:grid;place-items:center;min-height:320px;margin:18px 0;padding:24px;border:1px solid rgba(126,170,203,.16);border-radius:20px;background:linear-gradient(180deg,rgba(8,22,33,.72),rgba(5,14,24,.72));color:#9fb4c0;font:600 13px/1.4 system-ui,sans-serif;box-sizing:border-box}';(document.head||document.documentElement).appendChild(s)}
function installGuard(){installStyle();const page=document.getElementById('page-payments');if(!page)return;const sync=()=>{const canonical=page.querySelector(CANONICAL_SELECTOR);if(canonical&&canonical.isConnected){page.setAttribute(READY_ATTR,'1');page.dataset.ronaPaymentsVisualOwner='admin-payments-v7-native-v2'}else{page.removeAttribute(READY_ATTR);delete page.dataset.ronaPaymentsVisualOwner}};sync();const observer=new MutationObserver(sync);observer.observe(page,{childList:true,subtree:true});window.__RONA_PAYMENTS_CANONICAL_FIRST_PAINT_OBSERVER_V2__=observer}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGuard,{once:true});else installGuard();
})();`;

export default basePrepaintRuntime + adminTopbarTickerSafeRuntime + paymentsCanonicalFirstPaintGuardRuntime;
