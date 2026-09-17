import basePrepaintRuntime from './chunk15-base.js';
import adminTopbarTickerSafeRuntime from '../main-ui/admin-topbar-ticker-safe-v2.js';

const paymentsV8FirstPaintGuardRuntime = `(()=>{'use strict';
if(window.__RONA_PAYMENTS_V8_FIRST_PAINT_GUARD__)return;
window.__RONA_PAYMENTS_V8_FIRST_PAINT_GUARD__=true;
if(document.getElementById('ronaPaymentsV8FirstPaintGuard'))return;
const s=document.createElement('style');
s.id='ronaPaymentsV8FirstPaintGuard';
s.textContent='#page-payments:not(:has(> #ronaPaymentsV8Root)){position:relative;min-height:420px}#page-payments:not(:has(> #ronaPaymentsV8Root))>*{display:none!important}#page-payments:not(:has(> #ronaPaymentsV8Root))::before{content:"Загрузка актуальных платежей…";display:grid;place-items:center;min-height:320px;margin:18px 0;padding:24px;border:1px solid rgba(126,170,203,.16);border-radius:20px;background:linear-gradient(180deg,rgba(8,22,33,.72),rgba(5,14,24,.72));color:#9fb4c0;font:600 13px/1.4 system-ui,sans-serif;box-sizing:border-box}';
(document.head||document.documentElement).appendChild(s);
})();`;

export default basePrepaintRuntime + adminTopbarTickerSafeRuntime + paymentsV8FirstPaintGuardRuntime;
