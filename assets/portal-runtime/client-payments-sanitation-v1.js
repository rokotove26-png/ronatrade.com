(()=>{'use strict';
const MARK='20260830-client-payments-sanitation-v1';
if(window.__RONA_CLIENT_PAYMENTS_SANITATION__===MARK)return;
window.__RONA_CLIENT_PAYMENTS_SANITATION__=MARK;
if(location.pathname!=='/portal/client')return;

const OWNER='[data-rona-client-payments-owner="finance-authoritative-v1"]';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const paymentNavText=t=>/Платежи\s+и\s+взаиморасч[её]ты|^Платежи$/iu.test(norm(t));
const legacyExact=/^(?:Плат[её]жный статус|Плат[её]жных данных пока нет\.?|Подтвержд[её]нные поступления)$/iu;
let scheduled=false;

function root(){return document.querySelector('#page-payments')||document.querySelector('#paymentsPage')||document.querySelector('[data-page-panel="payments"]')||document.querySelector('[data-page-id="payments"]')}
function isProtected(node,r){
  if(!node||node===r)return true;
  if(node.matches?.(OWNER)||node.closest?.(OWNER))return true;
  const t=norm(node.textContent);
  if(t.includes('Платежи и взаиморасчёты'))return true;
  if(t.includes('Выбрана компания')||t.includes('КОМПАНИЯ / КОНТРАКТ'))return true;
  return false;
}
function legacyContainer(leaf,r){
  let chosen=leaf,node=leaf;
  while(node.parentElement&&node.parentElement!==r){
    const p=node.parentElement,t=norm(p.textContent);
    if(t.includes('Платежи и взаиморасчёты')||t.includes('Выбрана компания')||t.includes('КОМПАНИЯ / КОНТРАКТ')||t.length>1800)break;
    chosen=p;node=p;
  }
  return chosen;
}
function purge(){
  scheduled=false;
  const r=root();if(!r)return;
  const remove=new Set();
  for(const leaf of r.querySelectorAll('*')){
    if(leaf.closest(OWNER)||leaf.childElementCount!==0)continue;
    if(!legacyExact.test(norm(leaf.textContent)))continue;
    const target=legacyContainer(leaf,r);
    if(!isProtected(target,r))remove.add(target);
  }
  for(const node of remove){if(node.isConnected)node.remove()}
  for(const stale of r.querySelectorAll('[data-rona-payments-legacy-hidden="true"]')){
    if(!stale.closest(OWNER)&&!isProtected(stale,r))stale.remove();
  }
  r.setAttribute('data-rona-payments-sanitation','current-only-v1');
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(purge)}
function enterPayments(){
  document.documentElement.removeAttribute('data-rona-client-payments-ready');
  document.documentElement.dataset.ronaClientPaymentsState='loading';
  schedule();
}
function clickLooksLikePayments(target){
  const el=target?.closest?.('[data-page],[data-page-id],[data-page-target],a,button,[role="button"],li');
  if(!el)return paymentNavText(target?.textContent);
  const tokens=[el.getAttribute('data-page'),el.getAttribute('data-page-id'),el.getAttribute('data-page-target'),el.getAttribute('href'),el.textContent].map(norm).join(' ');
  return /(?:^|\W)payments?(?:\W|$)/iu.test(tokens)||paymentNavText(el.textContent);
}
function start(){
  schedule();
  document.addEventListener('pointerdown',e=>{if(clickLooksLikePayments(e.target))enterPayments()},true);
  document.addEventListener('click',e=>{if(clickLooksLikePayments(e.target))enterPayments()},true);
  window.addEventListener('popstate',()=>{if(root())enterPayments()},{passive:true});
  window.addEventListener('pageshow',()=>{if(root())schedule()},{passive:true});
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();