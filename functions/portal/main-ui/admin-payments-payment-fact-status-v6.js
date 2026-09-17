export default `(()=>{'use strict';
if(window.__RONA_ADMIN_PAYMENTS_PAYMENT_FACT_STATUS_V6__)return;
window.__RONA_ADMIN_PAYMENTS_PAYMENT_FACT_STATUS_V6__=true;
if(location.pathname!=='/portal/admin')return;
const ROOT='#page-payments .rona-payments-v7';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim().toUpperCase();
const parseAmount=text=>{const value=String(text??'').replace(/\u00a0/g,' ').trim();const m=value.match(/-?\d[\d\s]*(?:[.,]\d+)?/);if(!m)return NaN;return Number(m[0].replace(/\s/g,'').replace(',','.'))};
const currencyOf=text=>{const m=norm(text).match(/(?:^|\s)([A-Z]{3})(?:\s|$)/);return m?m[1]:''};
const parsePercent=text=>{const m=String(text??'').replace(/\u00a0/g,' ').match(/(-?\d+(?:[.,]\d+)?)\s*%/);return m?Number(m[1].replace(',','.')):NaN};
function paymentFact(totalCell,receivedCell){
  const totalNode=totalCell?.querySelector(':scope > strong')||totalCell?.querySelector('strong');
  const receivedNode=receivedCell?.querySelector(':scope > strong')||receivedCell?.querySelector('strong');
  const total=parseAmount(totalNode?.textContent),received=parseAmount(receivedNode?.textContent);
  const totalCurrency=currencyOf(totalNode?.textContent),receivedCurrency=currencyOf(receivedNode?.textContent);
  if(Number.isFinite(total)&&Number.isFinite(received)&&total>0&&(!totalCurrency||!receivedCurrency||totalCurrency===receivedCurrency)){
    const epsilon=Math.max(.01,Math.abs(total)*1e-9);
    if(received<=epsilon)return{tone:'zero',label:'Нет оплаты'};
    if(received+epsilon>=total)return{tone:'paid',label:'Оплачено'};
    return{tone:'partial',label:'Частично оплачено'};
  }
  const percent=parsePercent(receivedCell?.textContent);
  if(Number.isFinite(percent)){
    if(percent<=.0001)return{tone:'zero',label:'Нет оплаты'};
    if(percent>=99.9999)return{tone:'paid',label:'Оплачено'};
    if(percent>0)return{tone:'partial',label:'Частично оплачено'};
  }
  return{tone:'unknown',label:'Нет данных об оплате'};
}
function installStyle(){
  for(const id of ['ronaAdminPaymentsStatusBadgesV1','ronaAdminPaymentsStatusBadgesV2','ronaAdminPaymentsStatusBadgesV3','ronaAdminPaymentsStatusIndicatorsV4','ronaAdminPaymentsStatusIndicatorsV5','ronaAdminPaymentsPaymentFactStatusV6'])document.getElementById(id)?.remove();
  const s=document.createElement('style');s.id='ronaAdminPaymentsPaymentFactStatusV6';
  s.textContent='#page-payments .rona-payments-v7-kpi[data-tone="conditional"]{--pay-tone:#86eee6!important}#page-payments .rona-payments-v7-kpi[data-tone="conditional"] .rona-payments-v7-kpi-value{color:#d9fffb!important}#page-payments .rona-payments-v7-deal-cell[data-tone="conditional"]{--cell-tone:#86eee6!important}#page-payments .rona-payments-v7-deal-cell[data-tone="conditional"]>strong{color:#d9fffb!important}#page-payments .rona-payments-v7 [data-business-tone="conditional"],#page-payments .rona-payments-v7 [data-state-tone="conditional"]{display:inline-flex!important;align-items:center!important;gap:6px!important;width:max-content!important;max-width:100%!important;margin-top:5px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#86eee6!important;font-size:8.8px!important;line-height:1.15!important;font-weight:850!important;letter-spacing:.08em!important;text-transform:uppercase!important;text-shadow:0 0 10px rgba(134,238,230,.22)!important;white-space:nowrap!important}#page-payments .rona-payments-v7 [data-business-tone="conditional"]::before,#page-payments .rona-payments-v7 [data-state-tone="conditional"]::before{content:""!important;display:block!important;width:6px!important;height:6px!important;min-width:6px!important;flex:0 0 6px!important;border-radius:50%!important;background:#86eee6!important;box-shadow:0 0 10px rgba(134,238,230,.9)!important}#page-payments .rona-payments-v6-payment-fact{display:inline-flex!important;align-items:center!important;gap:7px!important;width:max-content!important;max-width:100%!important;min-height:0!important;margin-top:5px!important;margin-right:10px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font-size:9.4px!important;line-height:1.15!important;font-weight:880!important;letter-spacing:.075em!important;text-transform:uppercase!important;white-space:nowrap!important}#page-payments .rona-payments-v6-payment-fact::before{content:""!important;display:block!important;width:8.5px!important;height:8.5px!important;min-width:8.5px!important;flex:0 0 8.5px!important;border-radius:50%!important;background:currentColor!important;box-shadow:0 0 11px currentColor,0 0 18px color-mix(in srgb,currentColor 34%,transparent)!important;animation:ronaPaymentFactPulseV6 2.25s ease-in-out infinite!important}#page-payments .rona-payments-v6-payment-fact[data-payment-fact-tone="paid"]{color:#8ff0be!important}#page-payments .rona-payments-v6-payment-fact[data-payment-fact-tone="partial"]{color:#ffd06f!important}#page-payments .rona-payments-v6-payment-fact[data-payment-fact-tone="zero"]{color:#8ba6b9!important;text-shadow:none!important}#page-payments .rona-payments-v6-payment-fact[data-payment-fact-tone="unknown"]{color:#71899b!important;text-shadow:none!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="paid"]{border-color:rgba(86,221,161,.23)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.026),0 5px 18px rgba(0,0,0,.10),0 0 18px rgba(86,221,161,.045)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="paid"]::before{background:linear-gradient(180deg,#56dda1,rgba(86,221,161,.18))!important;box-shadow:0 0 16px rgba(86,221,161,.48)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="partial"]{border-color:rgba(255,200,97,.22)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.026),0 5px 18px rgba(0,0,0,.10),0 0 17px rgba(255,200,97,.04)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="partial"]::before{background:linear-gradient(180deg,#ffc861,rgba(255,200,97,.16))!important;box-shadow:0 0 16px rgba(255,200,97,.40)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="zero"],#page-payments .rona-payments-v7-deal[data-payment-deal-tone="unknown"]{border-color:rgba(126,183,214,.14)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.022),0 5px 18px rgba(0,0,0,.10)!important}#page-payments .rona-payments-v7-deal[data-payment-deal-tone="zero"]::before,#page-payments .rona-payments-v7-deal[data-payment-deal-tone="unknown"]::before{background:linear-gradient(180deg,#7895a9,rgba(120,149,169,.14))!important;box-shadow:0 0 11px rgba(120,149,169,.24)!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>span{font-size:11.5px!important;line-height:1.2!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>strong{font-size:16.9px!important;line-height:1.16!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"]>small{font-size:11.5px!important;line-height:1.28!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"] .rona-payments-v7-native-spend strong{font-size:16.9px!important;line-height:1.16!important}#page-payments .rona-payments-v7-deal-cell[data-payment-font-up="true"] .rona-payments-v7-native-note{font-size:11.5px!important;line-height:1.28!important}@keyframes ronaPaymentFactPulseV6{0%,100%{opacity:.74;filter:brightness(.94);box-shadow:0 0 8px currentColor,0 0 13px color-mix(in srgb,currentColor 22%,transparent)}50%{opacity:1;filter:brightness(1.1);box-shadow:0 0 14px currentColor,0 0 22px color-mix(in srgb,currentColor 40%,transparent)}}@media(prefers-reduced-motion:reduce){#page-payments .rona-payments-v6-payment-fact::before{animation:none!important}}';
  document.head.appendChild(s)
}
function clearLegacy(root){
  for(const el of root.querySelectorAll('[data-payment-status-tone],[data-payment-status-location]')){delete el.dataset.paymentStatusTone;delete el.dataset.paymentStatusLocation;el.style.removeProperty('color');el.style.removeProperty('text-shadow')}
  root.querySelectorAll('.rona-payments-v5-status-dot').forEach(el=>el.remove());
}
function normalizeKpis(root){
  for(const kpi of root.querySelectorAll('.rona-payments-v7-kpi')){
    const tone=String(kpi.dataset.tone||'').toLowerCase();
    if(tone==='conditional'){
      const label=kpi.querySelector('.rona-payments-v7-kpi-label');
      if(label&&norm(label.textContent)==='CONDITIONAL')label.textContent='Условное';
    }
  }
}
function setBusinessStatus(status,raw){
  if(!status)return;
  delete status.dataset.businessTone;
  status.hidden=false;
  const value=norm(raw||status.textContent);
  if(value==='PAID'||value==='ОПЛАЧЕНО'){
    status.hidden=true;
    return;
  }
  if(value==='CONDITIONAL'||value==='УСЛОВНО'||value==='УСЛОВНОЕ'){
    status.textContent='Условное';status.dataset.businessTone='conditional';
  }
}
function setPaymentFact(deal,fact,status){
  let el=deal.querySelector(':scope .rona-payments-v6-payment-fact');
  if(!el){el=document.createElement('span');el.className='rona-payments-v6-payment-fact';if(status?.parentNode)status.parentNode.insertBefore(el,status);else{const lead=deal.querySelector('.rona-payments-v7-deal-head>div:first-child,.rona-payments-v7-deal-head')||deal;lead.appendChild(el)}}
  el.dataset.paymentFactTone=fact.tone;el.textContent=fact.label;
  deal.dataset.paymentDealTone=fact.tone;
}
function decorateDeal(deal){
  const cells=Array.from(deal.querySelectorAll('.rona-payments-v7-deal-cell'));
  cells.forEach((cell,i)=>{cell.dataset.paymentColumn=String(i+2);if(i<4)cell.dataset.paymentFontUp='true';else delete cell.dataset.paymentFontUp});
  const fact=paymentFact(cells[0],cells[1]);
  const status=deal.querySelector('.rona-payments-v7-status');
  const rawBusiness=deal.dataset.financialStatus||status?.textContent||'';
  setBusinessStatus(status,rawBusiness);
  setPaymentFact(deal,fact,status);
}
function decorate(){
  const root=document.querySelector(ROOT);if(!root)return false;
  installStyle();clearLegacy(root);normalizeKpis(root);
  root.querySelectorAll('.rona-payments-v7-deal').forEach(decorateDeal);
  root.dataset.statusBadges='payment-fact-v6';root.dataset.paymentFactSource='rendered-authoritative-amounts';root.dataset.paymentFonts='columns-2-5-plus-25';return true
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:finance-sync',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="payments"],#nav a[data-page="payments"],#nav [role="button"][data-page="payments"]'))[0,60,180,450].forEach(ms=>setTimeout(schedule,ms))},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(()=>{const p=document.getElementById('page-payments');if(p&&getComputedStyle(p).display!=='none')schedule()},1800);
})();`;
