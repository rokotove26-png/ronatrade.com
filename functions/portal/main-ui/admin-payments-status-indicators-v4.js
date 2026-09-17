export default `(()=>{'use strict';
if(window.__RONA_ADMIN_PAYMENTS_STATUS_INDICATORS_V4__)return;
window.__RONA_ADMIN_PAYMENTS_STATUS_INDICATORS_V4__=true;
if(location.pathname!=='/portal/admin')return;
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toUpperCase();
const toneOf=v=>{const t=norm(v);if(t==='PAID'||t==='ОПЛАЧЕНО')return'paid';if(t==='CONDITIONAL'||t==='УСЛОВНО'||t==='УСЛОВНОЕ')return'conditional';return''};
const labelOf=tone=>tone==='paid'?'Оплачено':tone==='conditional'?'Условное':'';
const colorOf=tone=>tone==='paid'?'#8ff0be':tone==='conditional'?'#86eee6':'';
function installStyle(){
  for(const id of ['ronaAdminPaymentsStatusBadgesV1','ronaAdminPaymentsStatusBadgesV2','ronaAdminPaymentsStatusBadgesV3','ronaAdminPaymentsStatusIndicatorsV4'])document.getElementById(id)?.remove();
  const s=document.createElement('style');s.id='ronaAdminPaymentsStatusIndicatorsV4';
  s.textContent='#page-payments .rona-payments-v7 [data-payment-status-tone]{box-sizing:border-box}#page-payments .rona-payments-v7 [data-payment-status-location="kpi"]{display:flex!important;align-items:center!important;gap:7px!important;width:auto!important;max-width:100%!important;min-height:0!important;margin:0 0 8px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font-size:10.5px!important;line-height:1.2!important;font-weight:760!important;letter-spacing:.075em!important;text-transform:uppercase!important}#page-payments .rona-payments-v7 [data-payment-status-location="kpi"]::before{content:""!important;display:block!important;width:6px!important;height:6px!important;min-width:6px!important;flex:0 0 6px!important;border:0!important;border-radius:50%!important;background:currentColor!important;box-shadow:0 0 10px currentColor!important}#page-payments .rona-payments-v7 [data-payment-status-location="lead"]{display:inline-flex!important;align-items:center!important;gap:7px!important;width:max-content!important;max-width:100%!important;min-height:0!important;margin-top:5px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font-size:9.4px!important;line-height:1.15!important;font-weight:850!important;letter-spacing:.085em!important;text-transform:uppercase!important;white-space:nowrap!important}#page-payments .rona-payments-v7 [data-payment-status-location="lead"]::before{content:""!important;display:block!important;width:8.5px!important;height:8.5px!important;min-width:8.5px!important;flex:0 0 8.5px!important;border:0!important;border-radius:50%!important;background:currentColor!important;box-shadow:0 0 10px currentColor,0 0 16px color-mix(in srgb,currentColor 34%,transparent)!important;animation:ronaPaymentStatusPulseV4 2.2s ease-in-out infinite!important}#page-payments .rona-payments-v7 [data-payment-status-location="cell"]{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;min-height:18px!important;padding:3px 8px!important;border-radius:999px!important;font-size:8.5px!important;line-height:1.15!important;font-weight:850!important;letter-spacing:.085em!important;text-transform:uppercase!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}#page-payments .rona-payments-v7 [data-payment-status-tone="paid"]{color:#8ff0be!important}#page-payments .rona-payments-v7 [data-payment-status-tone="conditional"]{color:#86eee6!important;text-shadow:0 0 10px rgba(134,238,230,.18)!important}#page-payments .rona-payments-v7 [data-payment-status-location="kpi"][data-payment-status-tone="conditional"]::before,#page-payments .rona-payments-v7 [data-payment-status-location="lead"][data-payment-status-tone="conditional"]::before{background:#86eee6!important;box-shadow:0 0 10px rgba(134,238,230,.92),0 0 17px rgba(94,225,215,.38)!important}#page-payments .rona-payments-v7 [data-payment-status-location="cell"][data-payment-status-tone="paid"]{border:1px solid rgba(86,221,161,.38)!important;background:rgba(86,221,161,.10)!important;text-shadow:0 0 12px rgba(86,221,161,.18)!important}#page-payments .rona-payments-v7 [data-payment-status-location="cell"][data-payment-status-tone="conditional"]{color:#86eee6!important;border:1px solid rgba(94,225,215,.46)!important;background:rgba(94,225,215,.12)!important;text-shadow:0 0 12px rgba(94,225,215,.26)!important}#page-payments .rona-payments-v7 .rona-payments-v7-deal[data-payment-deal-tone="paid"]::before{background:linear-gradient(180deg,#56dda1,rgba(86,221,161,.18))!important;box-shadow:0 0 15px rgba(86,221,161,.42)!important}#page-payments .rona-payments-v7 .rona-payments-v7-deal[data-payment-deal-tone="conditional"]::before{background:linear-gradient(180deg,#86eee6,rgba(94,225,215,.18))!important;box-shadow:0 0 17px rgba(94,225,215,.52)!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>span{font-size:11.5px!important;line-height:1.2!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>strong{font-size:16.9px!important;line-height:1.16!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>small{font-size:11.5px!important;line-height:1.28!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"] .rona-payments-v7-native-spend strong{font-size:16.9px!important;line-height:1.16!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"] .rona-payments-v7-native-note{font-size:11.5px!important;line-height:1.28!important}@keyframes ronaPaymentStatusPulseV4{0%,100%{opacity:.78;filter:brightness(.94);box-shadow:0 0 7px currentColor,0 0 12px color-mix(in srgb,currentColor 22%,transparent)}50%{opacity:1;filter:brightness(1.08);box-shadow:0 0 13px currentColor,0 0 20px color-mix(in srgb,currentColor 38%,transparent)}}@media(prefers-reduced-motion:reduce){#page-payments .rona-payments-v7 [data-payment-status-location="lead"]::before{animation:none!important}}';
  document.head.appendChild(s)
}
function markStatus(el,location){
  if(!el||el.children.length)return'';
  const tone=toneOf(el.textContent);if(!tone){if(el.dataset.paymentStatusTone){delete el.dataset.paymentStatusTone;delete el.dataset.paymentStatusLocation;el.style.removeProperty('color');el.style.removeProperty('text-shadow')}return''}
  const label=labelOf(tone),color=colorOf(tone);if(label&&String(el.textContent||'').trim()!==label)el.textContent=label;
  el.dataset.paymentStatusTone=tone;el.dataset.paymentStatusLocation=location;
  if(color)el.style.setProperty('color',color,'important');
  if(tone==='conditional')el.style.setProperty('text-shadow','0 0 10px rgba(134,238,230,.18)','important');
  return tone
}
function decorate(){
  const root=document.querySelector('#page-payments .rona-payments-v7');if(!root)return false;installStyle();
  for(const kpi of root.querySelectorAll('.rona-payments-v7-kpi'))for(const el of kpi.querySelectorAll('span,small,strong,div'))markStatus(el,'kpi');
  for(const deal of root.querySelectorAll('.rona-payments-v7-deal')){
    const cells=Array.from(deal.querySelectorAll('.rona-payments-v7-deal-cell'));
    cells.forEach((cell,i)=>{cell.dataset.paymentColumn=String(i+2);if(i<4)cell.dataset.paymentFontUp='true';else delete cell.dataset.paymentFontUp});
    let dealTone='';
    for(const el of deal.querySelectorAll('span,small,strong,div')){
      if(el.children.length)continue;
      const location=el.closest('.rona-payments-v7-deal-cell')?'cell':'lead';
      const tone=markStatus(el,location);if(tone&&!dealTone)dealTone=tone
    }
    if(dealTone)deal.dataset.paymentDealTone=dealTone;else delete deal.dataset.paymentDealTone
  }
  root.dataset.statusBadges='paid-conditional-v4';root.dataset.paymentFonts='columns-2-5-plus-25';return true
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:finance-sync',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="payments"],#nav a[data-page="payments"],#nav [role="button"][data-page="payments"]'))[0,60,180,450].forEach(ms=>setTimeout(schedule,ms))},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(()=>{const p=document.getElementById('page-payments');if(p&&getComputedStyle(p).display!=='none')schedule()},1800);
})();`;
