export default String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_PAYMENTS_COLOR_RESTORE_V14__)return;
window.__RONA_ADMIN_PAYMENTS_COLOR_RESTORE_V14__=true;
if(location.pathname!=='/portal/admin')return;
const ROOT='#page-payments .rona-payments-v7';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim().toUpperCase();
function toneForStatus(v){
  const t=norm(v);
  if(t==='PAID'||t==='ОПЛАЧЕНО')return'paid';
  if(t==='CONDITIONAL'||t==='УСЛОВНО'||t==='УСЛОВНОЕ'||t==='УСЛОВНОЕ ОБЯЗАТЕЛЬСТВО')return'conditional';
  if(t==='TO_VERIFY'||t==='ТРЕБУЕТ ПРОВЕРКИ'||t==='ТРЕБУЕТ УТОЧНЕНИЯ')return'verify';
  if(t==='PARTIAL'||t==='PARTIALLY_PAID'||t==='ЧАСТИЧНО ОПЛАЧЕНО')return'partial';
  if(t==='EXPECTED'||t==='DUE'||t==='OPEN'||t==='ОЖИДАЕТСЯ ОПЛАТА'||t==='К ОПЛАТЕ'||t==='ОТКРЫТА')return'expected';
  if(t==='OVERDUE'||t==='ПРОСРОЧЕНО')return'overdue';
  return'';
}
function kpiTone(v){
  const t=norm(v);
  if(t==='СУММА ПО СДЕЛКЕ')return'total';
  if(t==='ПОЛУЧЕНО')return'received';
  if(t==='ОЖИДАЕТСЯ СЕЙЧАС')return'due';
  if(t==='CONDITIONAL'||t==='УСЛОВНОЕ')return'conditional';
  if(t==='ПОТРАЧЕНО / ОСТАТОК')return'funding';
  return'';
}
function installStyle(){
  document.getElementById('ronaAdminPaymentsColorRestoreV8')?.remove();
  const s=document.createElement('style');
  s.id='ronaAdminPaymentsColorRestoreV8';
  s.textContent='#page-payments .rona-payments-v7{--pay-violet:#5ec8ff!important}'+
  '#page-payments .rona-payments-v7-board,#page-payments .rona-payments-v7-list,#page-payments .rona-payments-v7-deals{gap:2px!important;row-gap:2px!important;column-gap:2px!important}'+
  '#page-payments .rona-payments-v7-deal{margin:0!important;margin-block:0!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone]{transition:border-color .18s ease,box-shadow .18s ease,background .18s ease!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="total"]{--accent:#5ec8ff!important;border-color:rgba(94,200,255,.30)!important;background:linear-gradient(180deg,rgba(8,26,42,.88),rgba(6,18,31,.93))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.16),0 0 20px rgba(94,200,255,.07)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="received"]{--accent:#56dda1!important;border-color:rgba(86,221,161,.30)!important;background:linear-gradient(180deg,rgba(8,31,30,.88),rgba(6,19,27,.93))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.16),0 0 20px rgba(86,221,161,.07)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="due"]{--accent:#ffc861!important;border-color:rgba(255,200,97,.31)!important;background:linear-gradient(180deg,rgba(38,31,15,.70),rgba(18,21,27,.93))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.16),0 0 20px rgba(255,200,97,.07)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="conditional"]{--pay-tone:#86eee6!important;--accent:#86eee6!important;border-color:rgba(134,238,230,.34)!important;background:linear-gradient(180deg,rgba(8,31,43,.88),rgba(6,18,31,.92))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.16),0 0 23px rgba(134,238,230,.10)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="funding"]{--accent:#61d8ff!important;border-color:rgba(97,216,255,.28)!important;background:linear-gradient(180deg,rgba(10,26,39,.88),rgba(7,18,29,.93))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.16),0 0 20px rgba(97,216,255,.06)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="total"]>.rona-payments-v7-kpi-label{color:#79d8ff!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="received"]>.rona-payments-v7-kpi-label{color:#80e8b1!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="due"]>.rona-payments-v7-kpi-label{color:#ffd06f!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="conditional"]>.rona-payments-v7-kpi-label{display:block!important;position:static!important;top:auto!important;transform:none!important;min-height:0!important;margin:0 0 13px!important;padding:0!important;font-size:10px!important;line-height:1.2!important;font-weight:900!important;letter-spacing:.13em!important;text-transform:uppercase!important;color:#86eee6!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="conditional"]>.rona-payments-v7-kpi-label::before{content:none!important;display:none!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="funding"]>.rona-payments-v7-kpi-label{color:#88dcff!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="total"] .rona-payments-v7-kpi-value{color:#dff7ff!important;text-shadow:0 0 18px rgba(94,200,255,.24)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="received"] .rona-payments-v7-kpi-value{color:#b8ffd8!important;text-shadow:0 0 18px rgba(86,221,161,.24)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="due"] .rona-payments-v7-kpi-value{color:#ffe29a!important;text-shadow:0 0 18px rgba(255,200,97,.22)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="conditional"] .rona-payments-v7-kpi-value{color:#c8fffb!important;text-shadow:0 0 19px rgba(134,238,230,.28)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="funding"]>.rona-payments-v7-money-lines>small:nth-of-type(1){color:#ffb77a!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="funding"]>.rona-payments-v7-money-lines>small:nth-of-type(2){color:#8ed8ff!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="funding"]>.rona-payments-v7-money-lines>div:nth-of-type(1) .rona-payments-v7-kpi-value{color:#ffd0aa!important;text-shadow:0 0 16px rgba(255,163,91,.18)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="funding"]>.rona-payments-v7-money-lines>div:nth-of-type(2) .rona-payments-v7-kpi-value{color:#cbeeff!important;text-shadow:0 0 16px rgba(97,216,255,.20)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone]{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;margin-top:5px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font-size:9.3px!important;line-height:1.15!important;font-weight:880!important;letter-spacing:.085em!important;text-transform:uppercase!important;white-space:nowrap!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone]::before{content:none!important;display:none!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="paid"]{color:#8ff0be!important;text-shadow:0 0 10px rgba(86,221,161,.20)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="conditional"]{color:#8ed8ff!important;text-shadow:0 0 11px rgba(94,200,255,.38)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="verify"]{color:#ff8a98!important;text-shadow:0 0 10px rgba(255,113,128,.22)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="partial"],#page-payments .rona-payments-v7-status[data-native-status-tone="expected"]{color:#ffd06f!important;text-shadow:0 0 10px rgba(255,200,97,.20)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="overdue"]{color:#ff7f8f!important;text-shadow:0 0 10px rgba(255,96,116,.24)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone]{position:relative!important;box-sizing:border-box!important;border:1px solid rgba(126,183,214,.15)!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(8,22,35,.78),rgba(6,17,29,.68))!important;padding:8px 10px!important;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="paid"]{border-color:rgba(86,221,161,.48)!important;background:linear-gradient(180deg,rgba(10,35,31,.58),rgba(6,20,28,.74))!important;box-shadow:inset 3px 0 0 #56dda1,inset 0 0 0 1px rgba(86,221,161,.055),0 0 18px rgba(86,221,161,.10)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="conditional"]{border-color:rgba(94,200,255,.62)!important;background:linear-gradient(180deg,rgba(8,31,48,.66),rgba(6,18,31,.76))!important;box-shadow:inset 3px 0 0 #5ec8ff,inset 0 0 0 1px rgba(94,200,255,.08),0 0 22px rgba(94,200,255,.14)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="verify"],#page-payments .rona-payments-v7-deal-head[data-first-col-tone="overdue"]{border-color:rgba(255,127,143,.48)!important;background:linear-gradient(180deg,rgba(42,18,29,.50),rgba(17,17,28,.72))!important;box-shadow:inset 3px 0 0 #ff7f8f,inset 0 0 0 1px rgba(255,127,143,.055),0 0 19px rgba(255,113,128,.10)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="partial"],#page-payments .rona-payments-v7-deal-head[data-first-col-tone="expected"]{border-color:rgba(255,200,97,.48)!important;background:linear-gradient(180deg,rgba(42,33,15,.43),rgba(18,21,27,.72))!important;box-shadow:inset 3px 0 0 #ffc861,inset 0 0 0 1px rgba(255,200,97,.055),0 0 19px rgba(255,200,97,.09)!important}'+
  '@media(prefers-reduced-motion:reduce){#page-payments .rona-payments-v7-deal-head[data-first-col-tone],#page-payments .rona-payments-v7-kpi[data-tone]{transition:none!important}}';
  document.head.appendChild(s);
}
function dedupePaymentsTitle(){
  const page=document.getElementById('page-payments');
  if(!page)return;
  const nodes=[...page.querySelectorAll('*')].filter(n=>{
    if(norm(n.textContent)!=='ПЛАТЕЖИ')return false;
    if(getComputedStyle(n).display==='none'||getComputedStyle(n).visibility==='hidden')return false;
    return ![...n.children].some(c=>norm(c.textContent)==='ПЛАТЕЖИ');
  });
  if(nodes.length<2)return;
  let keep=nodes[0],keepSize=parseFloat(getComputedStyle(keep).fontSize)||0;
  for(const n of nodes.slice(1)){
    const size=parseFloat(getComputedStyle(n).fontSize)||0;
    if(size>keepSize){keep=n;keepSize=size;}
  }
  for(const n of nodes){
    if(n===keep)continue;
    n.dataset.ronaPaymentsDuplicateTitle='hidden';
    n.style.setProperty('display','none','important');
    n.setAttribute('aria-hidden','true');
  }
}
function compactDealStack(root){
  const deals=[...root.querySelectorAll('.rona-payments-v7-deal')];
  if(!deals.length)return;
  const parent=deals[0].parentElement;
  if(parent&&deals.every(d=>d.parentElement===parent)){
    parent.style.setProperty('gap','2px','important');
    parent.style.setProperty('row-gap','2px','important');
    parent.style.setProperty('column-gap','2px','important');
  }
  for(const deal of deals){
    deal.style.setProperty('margin','0','important');
    deal.style.setProperty('margin-block','0','important');
  }
}
function markKpis(root){
  for(const kpi of root.querySelectorAll('.rona-payments-v7-kpi')){
    delete kpi.dataset.tone;
    const label=kpi.querySelector(':scope > .rona-payments-v7-kpi-label')||kpi.querySelector('.rona-payments-v7-kpi-label');
    if(!label)continue;
    const tone=kpiTone(label.textContent);
    if(tone)kpi.dataset.tone=tone;
  }
}
function decorate(){
  const root=document.querySelector(ROOT);if(!root)return false;
  installStyle();
  dedupePaymentsTitle();
  compactDealStack(root);
  markKpis(root);
  root.style.setProperty('--pay-violet','#5ec8ff','important');
  for(const status of root.querySelectorAll('.rona-payments-v7-status')){
    delete status.dataset.nativeStatusTone;
    const tone=toneForStatus(status.textContent);
    if(tone)status.dataset.nativeStatusTone=tone;
  }
  for(const deal of root.querySelectorAll('.rona-payments-v7-deal')){
    const head=deal.querySelector(':scope > .rona-payments-v7-deal-head')||deal.querySelector('.rona-payments-v7-deal-head');
    if(!head)continue;
    delete head.dataset.firstColTone;
    const status=head.querySelector('.rona-payments-v7-status')||deal.querySelector('.rona-payments-v7-status');
    const tone=toneForStatus(status?.textContent||'');
    if(tone)head.dataset.firstColTone=tone;
  }
  root.dataset.colorRestore='v14-semantic-kpi-colors';
  return true;
}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:finance-sync',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="payments"],#nav a[data-page="payments"],#nav [role="button"][data-page="payments"]'))[0,60,180,450].forEach(ms=>setTimeout(schedule,ms))},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(()=>{const p=document.getElementById('page-payments');if(p&&getComputedStyle(p).display!=='none')schedule()},1800);
})();
`;