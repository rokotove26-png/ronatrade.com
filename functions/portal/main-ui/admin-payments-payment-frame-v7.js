export default `(()=>{'use strict';
if(window.__RONA_ADMIN_PAYMENTS_PAYMENT_FRAME_V7__)return;
window.__RONA_ADMIN_PAYMENTS_PAYMENT_FRAME_V7__=true;
if(location.pathname!=='/portal/admin')return;
const ROOT='#page-payments .rona-payments-v7';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim().toUpperCase();
const parseAmount=text=>{const value=String(text??'').replace(/\u00a0/g,' ').trim();const m=value.match(/-?\d[\d\s]*(?:[.,]\d+)?/);if(!m)return NaN;return Number(m[0].replace(/\s/g,'').replace(',','.'))};
const currencyOf=text=>{const m=norm(text).match(/(?:^|\s)([A-Z]{3})(?:\s|$)/);return m?m[1]:''};
function directLabel(cell){return norm(cell?.querySelector(':scope > span')?.textContent||'')}
function findCell(deal,label){const target=norm(label);return Array.from(deal?.querySelectorAll?.('.rona-payments-v7-deal-cell')||[]).find(cell=>directLabel(cell)===target)||null}
function paymentFact(deal){
  const totalCell=findCell(deal,'Сумма по сделке');
  const receivedCell=findCell(deal,'Получено');
  const totalNode=totalCell?.querySelector(':scope > strong')||totalCell?.querySelector('strong');
  const receivedNode=receivedCell?.querySelector(':scope > strong')||receivedCell?.querySelector('strong');
  const total=parseAmount(totalNode?.textContent),received=parseAmount(receivedNode?.textContent);
  const totalCurrency=currencyOf(totalNode?.textContent),receivedCurrency=currencyOf(receivedNode?.textContent);
  if(!Number.isFinite(total)||!Number.isFinite(received)||total<=0)return'unknown';
  if(totalCurrency&&receivedCurrency&&totalCurrency!==receivedCurrency)return'unknown';
  const epsilon=Math.max(.01,Math.abs(total)*1e-9);
  if(received<=epsilon)return'zero';
  if(received+epsilon>=total)return'paid';
  return'partial';
}
function installStyle(){
  for(const id of ['ronaAdminPaymentsStatusBadgesV1','ronaAdminPaymentsStatusBadgesV2','ronaAdminPaymentsStatusBadgesV3','ronaAdminPaymentsStatusIndicatorsV4','ronaAdminPaymentsStatusIndicatorsV5','ronaAdminPaymentsPaymentFactStatusV6','ronaAdminPaymentsPaymentFrameV7'])document.getElementById(id)?.remove();
  const s=document.createElement('style');s.id='ronaAdminPaymentsPaymentFrameV7';
  s.textContent='#page-payments .rona-payments-v7-deal[data-payment-deal-tone="paid"]{border-color:rgba(86,221,161,.23)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.026),0 5px 18px rgba(0,0,0,.10),0 0 18px rgba(86,221,161,.045)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="paid"]::before{background:linear-gradient(180deg,#56dda1,rgba(86,221,161,.18))!important;box-shadow:0 0 16px rgba(86,221,161,.48)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="partial"]{border-color:rgba(255,200,97,.22)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.026),0 5px 18px rgba(0,0,0,.10),0 0 17px rgba(255,200,97,.04)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="partial"]::before{background:linear-gradient(180deg,#ffc861,rgba(255,200,97,.16))!important;box-shadow:0 0 16px rgba(255,200,97,.40)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="zero"],#page-payments .rona-payments-v7-deal[data-payment-deal-tone="unknown"]{border-color:rgba(126,183,214,.14)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.022),0 5px 18px rgba(0,0,0,.10)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="zero"]::before,#page-payments .rona-payments-v7-deal[data-payment-deal-tone="unknown"]::before{background:linear-gradient(180deg,#7895a9,rgba(120,149,169,.14))!important;box-shadow:0 0 11px rgba(120,149,169,.24)!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>span{font-size:11.5px!important;line-height:1.2!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>strong{font-size:16.9px!important;line-height:1.16!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>small{font-size:11.5px!important;line-height:1.28!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"] .rona-payments-v7-native-spend strong{font-size:16.9px!important;line-height:1.16!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"] .rona-payments-v7-native-note{font-size:11.5px!important;line-height:1.28!important}';
  document.head.appendChild(s)
}
function cleanFirstColumn(deal){
  deal.querySelectorAll('.rona-payments-v6-payment-fact,.rona-payments-v7-payment-fact').forEach(el=>el.remove());
  const status=deal.querySelector('.rona-payments-v7-status');
  if(status){status.hidden=false;delete status.dataset.businessTone;delete status.dataset.paymentStatusTone;delete status.dataset.paymentStatusLocation;status.style.removeProperty('color');status.style.removeProperty('text-shadow')}
}
function decorateDeal(deal){
  cleanFirstColumn(deal);
  const cells=Array.from(deal.querySelectorAll('.rona-payments-v7-deal-cell'));
  cells.forEach((cell,i)=>{cell.dataset.paymentColumn=String(i+2);if(i<4)cell.dataset.paymentFontUp='true';else delete cell.dataset.paymentFontUp});
  deal.dataset.paymentDealTone=paymentFact(deal);
}
function decorate(){
  const root=document.querySelector(ROOT);if(!root)return false;
  installStyle();
  root.querySelectorAll('[data-payment-status-tone],[data-payment-status-location]').forEach(el=>{delete el.dataset.paymentStatusTone;delete el.dataset.paymentStatusLocation;el.style.removeProperty('color');el.style.removeProperty('text-shadow')});
  root.querySelectorAll('.rona-payments-v6-payment-fact,.rona-payments-v7-payment-fact').forEach(el=>el.remove());
  root.querySelectorAll('.rona-payments-v7-deal').forEach(decorateDeal);
  root.dataset.statusBadges='native-single-status-v7';root.dataset.paymentFactSource='received-versus-deal-total';root.dataset.paymentFonts='columns-2-5-plus-25';return true
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:finance-sync',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="payments"],#nav a[data-page="payments"],#nav [role="button"][data-page="payments"]'))[0,60,180,450].forEach(ms=>setTimeout(schedule,ms))},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(()=>{const p=document.getElementById('page-payments');if(p&&getComputedStyle(p).display!=='none')schedule()},1800);
})();`;
