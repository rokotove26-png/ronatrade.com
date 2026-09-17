export default String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_PAYMENTS_COLOR_RESTORE_V10__)return;
window.__RONA_ADMIN_PAYMENTS_COLOR_RESTORE_V10__=true;
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
function installStyle(){
  document.getElementById('ronaAdminPaymentsColorRestoreV8')?.remove();
  const s=document.createElement('style');
  s.id='ronaAdminPaymentsColorRestoreV8';
  s.textContent='#page-payments .rona-payments-v7{--pay-violet:#86eee6!important}'+
  '#page-payments .rona-payments-v7-board,#page-payments .rona-payments-v7-list,#page-payments .rona-payments-v7-deals{gap:2px!important;row-gap:2px!important;column-gap:2px!important}'+
  '#page-payments .rona-payments-v7-deal{margin:0!important;margin-block:0!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="conditional"]{--pay-tone:#86eee6!important;border-color:rgba(134,238,230,.24)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.16),0 0 20px rgba(94,225,215,.045)!important}'+
  '#page-payments .rona-payments-v7-kpi[data-tone="conditional"] .rona-payments-v7-kpi-value{color:#d9fffb!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone]{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;margin-top:5px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font-size:9.3px!important;line-height:1.15!important;font-weight:880!important;letter-spacing:.085em!important;text-transform:uppercase!important;white-space:nowrap!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone]::before{content:none!important;display:none!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="paid"]{color:#8ff0be!important;text-shadow:0 0 10px rgba(86,221,161,.20)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="conditional"]{color:#86eee6!important;text-shadow:0 0 10px rgba(134,238,230,.22)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="verify"]{color:#ff8a98!important;text-shadow:0 0 10px rgba(255,113,128,.22)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="partial"],#page-payments .rona-payments-v7-status[data-native-status-tone="expected"]{color:#ffd06f!important;text-shadow:0 0 10px rgba(255,200,97,.20)!important}'+
  '#page-payments .rona-payments-v7-status[data-native-status-tone="overdue"]{color:#ff7f8f!important;text-shadow:0 0 10px rgba(255,96,116,.24)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone]{position:relative!important;box-sizing:border-box!important;border:1px solid rgba(126,183,214,.15)!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(8,22,35,.78),rgba(6,17,29,.68))!important;padding:8px 10px!important;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="paid"]{border-color:rgba(86,221,161,.48)!important;background:linear-gradient(180deg,rgba(10,35,31,.58),rgba(6,20,28,.74))!important;box-shadow:inset 3px 0 0 #56dda1,inset 0 0 0 1px rgba(86,221,161,.055),0 0 18px rgba(86,221,161,.10)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="conditional"]{border-color:rgba(134,238,230,.50)!important;background:linear-gradient(180deg,rgba(9,38,42,.56),rgba(6,21,30,.74))!important;box-shadow:inset 3px 0 0 #86eee6,inset 0 0 0 1px rgba(134,238,230,.06),0 0 19px rgba(134,238,230,.11)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="verify"],#page-payments .rona-payments-v7-deal-head[data-first-col-tone="overdue"]{border-color:rgba(255,127,143,.48)!important;background:linear-gradient(180deg,rgba(42,18,29,.50),rgba(17,17,28,.72))!important;box-shadow:inset 3px 0 0 #ff7f8f,inset 0 0 0 1px rgba(255,127,143,.055),0 0 19px rgba(255,113,128,.10)!important}'+
  '#page-payments .rona-payments-v7-deal-head[data-first-col-tone="partial"],#page-payments .rona-payments-v7-deal-head[data-first-col-tone="expected"]{border-color:rgba(255,200,97,.48)!important;background:linear-gradient(180deg,rgba(42,33,15,.43),rgba(18,21,27,.72))!important;box-shadow:inset 3px 0 0 #ffc861,inset 0 0 0 1px rgba(255,200,97,.055),0 0 19px rgba(255,200,97,.09)!important}'+
  '@media(prefers-reduced-motion:reduce){#page-payments .rona-payments-v7-deal-head[data-first-col-tone]{transition:none!important}}';
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
function decorate(){
  const root=document.querySelector(ROOT);if(!root)return false;
  installStyle();
  dedupePaymentsTitle();
  compactDealStack(root);
  root.style.setProperty('--pay-violet','#86eee6','important');
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
  root.dataset.colorRestore='v10-first-column-tight-stack';
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
