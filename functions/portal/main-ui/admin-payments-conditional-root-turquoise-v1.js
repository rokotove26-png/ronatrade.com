export default `(()=>{'use strict';
if(window.__RONA_ADMIN_PAYMENTS_CONDITIONAL_ROOT_TURQUOISE_V1__)return;
window.__RONA_ADMIN_PAYMENTS_CONDITIONAL_ROOT_TURQUOISE_V1__=true;
if(location.pathname!=='/portal/admin')return;
function install(){
  document.getElementById('ronaAdminPaymentsConditionalRootTurquoiseV1')?.remove();
  const s=document.createElement('style');
  s.id='ronaAdminPaymentsConditionalRootTurquoiseV1';
  s.textContent='#page-payments .rona-payments-v7{--pay-violet:#86eee6!important}#page-payments .rona-payments-v7 [data-state-tone="conditional"]{color:#86eee6!important;border-color:rgba(94,225,215,.46)!important;background:rgba(94,225,215,.12)!important;text-shadow:0 0 12px rgba(94,225,215,.26)!important}#page-payments .rona-payments-v7 [data-state-tone="conditional"]::before{background:#86eee6!important;box-shadow:0 0 10px rgba(134,238,230,.92),0 0 17px rgba(94,225,215,.38)!important}#page-payments .rona-payments-v7 .rona-payments-v7-kpi[data-tone="conditional"]{--pay-tone:#86eee6!important}#page-payments .rona-payments-v7 .rona-payments-v7-kpi[data-tone="conditional"] .rona-payments-v7-kpi-value{color:#bffbf6!important}#page-payments .rona-payments-v7 .rona-payments-v7-deal-cell[data-tone="conditional"]{--cell-tone:#86eee6!important}#page-payments .rona-payments-v7 .rona-payments-v7-deal-cell[data-tone="conditional"]>strong{color:#bffbf6!important}#page-payments .rona-payments-v7 .rona-payments-v7-deal[data-payment-deal-tone="conditional"]::before{background:linear-gradient(180deg,#86eee6,rgba(94,225,215,.18))!important;box-shadow:0 0 17px rgba(94,225,215,.52)!important}#page-payments .rona-payments-v7 [data-payment-status-location="lead"][data-payment-status-tone="conditional"]::before{width:8.5px!important;height:8.5px!important;min-width:8.5px!important;flex:0 0 8.5px!important;background:#86eee6!important;box-shadow:0 0 12px rgba(134,238,230,.96),0 0 20px rgba(94,225,215,.48)!important}';
  document.head.appendChild(s)
}
const apply=()=>{const root=document.querySelector('#page-payments .rona-payments-v7');if(!root)return false;install();root.dataset.conditionalPalette='turquoise-root-v1';return true};
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:finance-sync',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="payments"],#nav a[data-page="payments"],#nav [role="button"][data-page="payments"]'))[0,60,180,450].forEach(ms=>setTimeout(schedule,ms))},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(()=>{const p=document.getElementById('page-payments');if(p&&getComputedStyle(p).display!=='none')schedule()},1800);
})();`;
