(()=>{'use strict';
const MARK='20260831-client-section-first-paint-v2-background-preload';
if(window.__RONA_CLIENT_SECTION_FIRST_PAINT__===MARK)return;
window.__RONA_CLIENT_SECTION_FIRST_PAINT__=MARK;
if(location.pathname!=='/portal/client')return;

const DEAL_RE=/\bDEAL-\d{4}-\d{3,}\b/giu;
const PAYMENT_OWNER='[data-rona-client-payments-owner="finance-authoritative-v1"]';
const LEGACY_PAYMENT_EXACT=/^(?:Плат[её]жный статус|Плат[её]жных данных пока нет\.?|Подтвержд[её]нные поступления)$/iu;
const PRELOAD_LOADER_RE=/^__RONA_(?:LOAD|REFRESH)_CLIENT_[A-Z0-9_]+__$/u;
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
let lastActive='',queued=false,preloadTimer=0,preloadUntil=0;
const preloadedFunctions=new WeakSet();

function rootFor(section){
  if(section==='deals')return document.querySelector('#page-deals,#dealsPage,[data-page-panel="deals"],[data-page-id="deals"]');
  if(section==='payments')return document.querySelector('#page-payments,#paymentsPage,[data-page-panel="payments"],[data-page-id="payments"]');
  return null;
}
function rootShown(root){
  if(!root||!root.isConnected)return false;
  const s=getComputedStyle(root);
  if(s.display==='none'||s.visibility==='hidden')return false;
  const p=root.parentElement;
  if(p){const ps=getComputedStyle(p);if(ps.display==='none'||ps.visibility==='hidden')return false}
  return true;
}
function activeSection(){
  for(const section of ['deals','payments'])if(rootShown(rootFor(section)))return section;
  return '';
}
function navSection(target){
  const el=target?.closest?.('[data-page],[data-page-id],[data-page-target],a,button,[role="tab"],[role="menuitem"],[role="button"],li');
  const tokens=[el?.getAttribute?.('data-page'),el?.getAttribute?.('data-page-id'),el?.getAttribute?.('data-page-target'),el?.getAttribute?.('href'),el?.textContent,target?.textContent].map(norm).join(' ');
  if(/(?:^|\W)payments?(?:\W|$)/iu.test(tokens)||/Платежи\s+и\s+взаиморасч[её]ты|^Платежи$/iu.test(norm(el?.textContent||target?.textContent)))return'payments';
  if(/(?:^|\W)deals?(?:\W|$)/iu.test(tokens)||/^Сделки$/iu.test(norm(el?.textContent||target?.textContent)))return'deals';
  return'';
}
function setPending(section){
  const html=document.documentElement;
  if(section==='deals'){
    html.removeAttribute('data-rona-client-deals-paint-ready');
    html.dataset.ronaClientDealsPaintState='loading';
  }else if(section==='payments'){
    html.removeAttribute('data-rona-client-payments-paint-ready');
    html.dataset.ronaClientPaymentsPaintState='loading';
  }
}
function setReady(section){
  const html=document.documentElement;
  if(section==='deals'){
    html.setAttribute('data-rona-client-deals-paint-ready','true');
    html.dataset.ronaClientDealsPaintState='ready';
  }else if(section==='payments'){
    html.setAttribute('data-rona-client-payments-paint-ready','true');
    html.dataset.ronaClientPaymentsPaintState='ready';
  }
}
function setError(section){
  const html=document.documentElement;
  setPending(section);
  if(section==='deals')html.dataset.ronaClientDealsPaintState='error';
  if(section==='payments')html.dataset.ronaClientPaymentsPaintState='error';
}
function dealIds(root){return[...new Set(norm(root?.textContent).match(DEAL_RE)||[])]}
function dealsReady(root){
  const html=document.documentElement;
  if(!root||html.getAttribute('data-rona-client-operations-ready')!=='true')return false;
  if(root.getAttribute('data-rona-deal-authority')!=='admin-client-server-v8')return false;
  const ids=dealIds(root);
  if(!ids.length)return true;
  const cards=[...root.querySelectorAll('.rona-deal-card-v5[data-rona-canonical-deal-id]')];
  if(!cards.length)return false;
  const represented=new Set(cards.map(c=>norm(c.getAttribute('data-rona-canonical-deal-id'))).filter(Boolean));
  if(ids.some(id=>!represented.has(id)))return false;
  return cards.every(card=>card.getAttribute('data-rona-deal-summary-ready')==='true'&&!!card.querySelector('[data-rona-deal-summary="canonical-v8"]'));
}
function hasLegacyPaymentLeaf(root){
  for(const leaf of root.querySelectorAll('*')){
    if(leaf.closest(PAYMENT_OWNER)||leaf.childElementCount!==0)continue;
    if(LEGACY_PAYMENT_EXACT.test(norm(leaf.textContent)))return true;
  }
  return false;
}
function paymentsReady(root){
  const html=document.documentElement;
  if(!root||html.getAttribute('data-rona-client-payments-ready')!=='true')return false;
  if(root.getAttribute('data-rona-payments-sanitation')!=='current-only-v1')return false;
  const owner=root.querySelector(PAYMENT_OWNER);
  if(!owner||!owner.isConnected)return false;
  if(hasLegacyPaymentLeaf(root))return false;
  return true;
}
function evaluate(){
  queued=false;
  const active=activeSection();
  if(active!==lastActive){
    if(active)setPending(active);
    lastActive=active;
  }
  if(!active)return;
  const root=rootFor(active);
  const semanticError=active==='deals'?document.documentElement.dataset.ronaClientOperationsState==='error':document.documentElement.dataset.ronaClientPaymentsState==='error';
  if(semanticError){setError(active);return}
  const ready=active==='deals'?dealsReady(root):paymentsReady(root);
  if(ready)setReady(active);else setPending(active);
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(evaluate)}
function resetFromNavigation(event){const section=navSection(event.target);if(!section)return;setPending(section);if(section!==lastActive)lastActive='';schedule()}

function runBackgroundPreloaders(){
  for(const key of Object.getOwnPropertyNames(window)){
    if(!PRELOAD_LOADER_RE.test(key))continue;
    const loader=window[key];
    if(typeof loader!=='function'||preloadedFunctions.has(loader))continue;
    preloadedFunctions.add(loader);
    Promise.resolve().then(()=>loader()).catch(()=>{});
  }
}
function backgroundPreloadTick(){
  runBackgroundPreloaders();
  if(Date.now()<preloadUntil)preloadTimer=window.setTimeout(backgroundPreloadTick,250);
  else document.documentElement.dataset.ronaClientBackgroundPreload='ready';
}
function startBackgroundPreload(){
  window.clearTimeout(preloadTimer);
  preloadUntil=Date.now()+10000;
  document.documentElement.dataset.ronaClientBackgroundPreload='loading';
  const begin=()=>backgroundPreloadTick();
  if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(begin,{timeout:500});
  else preloadTimer=window.setTimeout(begin,80);
}

function start(){
  document.addEventListener('pointerdown',resetFromNavigation,true);
  document.addEventListener('click',resetFromNavigation,true);
  window.addEventListener('popstate',()=>{lastActive='';setPending('deals');setPending('payments');schedule();startBackgroundPreload()},{passive:true});
  window.addEventListener('hashchange',()=>{lastActive='';setPending('deals');setPending('payments');schedule();startBackgroundPreload()},{passive:true});
  window.addEventListener('pageshow',()=>{lastActive='';schedule();startBackgroundPreload()},{passive:true});
  new MutationObserver(()=>{schedule();runBackgroundPreloaders()}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-rona-deal-authority','data-rona-deal-summary-ready','data-rona-payments-sanitation','data-rona-client-operations-ready','data-rona-client-payments-ready']});
  evaluate();
  startBackgroundPreload();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
