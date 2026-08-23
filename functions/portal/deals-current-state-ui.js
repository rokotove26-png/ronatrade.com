import c0 from './deals-current-state-chunks/chunk0.js';
import c1 from './deals-current-state-chunks/chunk1.js';
import c2 from './deals-current-state-chunks/chunk2.js';
import c3 from './deals-current-state-chunks/chunk3.js';
import c4 from './deals-current-state-chunks/chunk4.js';

const RAW=[c0,c1,c2,c3,c4].join('');
const SCRIPT=RAW
  .replace(
    "function waitsAction(d){if(!isActive(d))return false;return Number(d&&d.client_remaining_amount||0)>0||String(d&&d.payment_expectation_state||'').toUpperCase()==='ACTIVE'||needsAttention(d)}",
    "function waitsPayment(d){if(!isActive(d))return false;var remaining=Number(d&&d.client_remaining_amount),expected=Number(d&&d.payment_expectation_amount),outstanding=Number.isFinite(remaining)?remaining>0:(Number.isFinite(expected)&&expected>0);if(!outstanding)return false;var expectation=String(d&&d.payment_expectation_state||'').toUpperCase(),finance=String(d&&d.finance_status||'').toUpperCase();return expectation==='ACTIVE'||['DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT'].includes(finance)}"
  )
  .replaceAll('waitsAction','waitsPayment')
  .replace(
    "kpi('Ожидают оплаты или действий',String(metrics.waiting),'Только текущее состояние действующих сделок','waiting')",
    "kpi('Ожидают оплаты',String(metrics.waiting),'Только сделки с активным ожиданием платежа или наступившей задолженностью','waiting')"
  )
  .replace(
    "function render(){ensureStyle();var root=q('#page-deals');if(!root||!state)return;var host=q(':scope > .rona-owner-page-content',root);if(!host){host=el('div','rona-owner-page-content');host.dataset.ownerPage='deals';root.append(host)}",
    "function isolateDealsPage(root,host){if(!root||!host)return;qa(':scope > *',root).forEach(function(n){if(n===host)return;n.classList.add('rona-owner-original-hidden');n.setAttribute('aria-hidden','true');n.style.setProperty('display','none','important')});host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display');host.dataset.ownerPage='deals';host.dataset.ronaDealsOwner='current-v1.4'}function guardDealsOwner(){if(!state)return;var root=q('#page-deals');if(!root)return;var host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',root)||q(':scope > .rona-owner-page-content',root);if(!host)return;isolateDealsPage(root,host);if(!q(':scope > .rona-current-deals-owned',host))render()}function render(){ensureStyle();var root=q('#page-deals');if(!root||!state)return;var host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',root)||q(':scope > .rona-owner-page-content',root);if(!host){host=el('div','rona-owner-page-content');host.dataset.ownerPage='deals';root.prepend(host)}isolateDealsPage(root,host);"
  )
  .replace(
    "host.replaceChildren(grid,flt,queue);if(sel)host.append(buildDetail(sel));",
    "var owned=el('div','rona-current-deals-owned');owned.append(grid,flt,queue);if(sel)owned.append(buildDetail(sel));host.replaceChildren(owned);"
  )
  .replace(
    "function renderError(e){ensureStyle();var root=q('#page-deals');if(!root)return;var host=q(':scope > .rona-owner-page-content',root);if(!host){host=el('div','rona-owner-page-content');host.dataset.ownerPage='deals';root.append(host)}",
    "function renderError(e){ensureStyle();var root=q('#page-deals');if(!root)return;var host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',root)||q(':scope > .rona-owner-page-content',root);if(!host){host=el('div','rona-owner-page-content');host.dataset.ownerPage='deals';root.prepend(host)}isolateDealsPage(root,host);"
  )
  .replace(
    "function start(){ensureStyle();bindNavigation();refresh(true);setInterval(function(){refresh(false)},15000)}",
    "function start(){ensureStyle();bindNavigation();var mounted=false,observer=null;function mount(){if(mounted||!q('#page-deals'))return;mounted=true;if(observer)observer.disconnect();if(state)render();else if(window.__RONA_DEALS_CURRENT_STATE_ERROR__)renderError(new Error(window.__RONA_DEALS_CURRENT_STATE_ERROR__))}observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});mount();var guardQueued=false,guard=new MutationObserver(function(){if(guardQueued)return;guardQueued=true;queueMicrotask(function(){guardQueued=false;guardDealsOwner()})});guard.observe(document.documentElement,{childList:true,subtree:true});refresh(true);setInterval(function(){refresh(false)},15000)}"
  )
  .replace(
    "if(location.pathname==='/portal/admin'){var tries=0;(function wait(){if(window.__RONA_OWNER_ADMIN_READY__===true){start();return}if(++tries<1200)setTimeout(wait,100)})()}",
    "if(location.pathname==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}"
  );

if(/\bwaitsAction\b/.test(SCRIPT))throw new Error('DEALS_LEGACY_WAITS_ACTION_REFERENCE');

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-deals-ui':'current-state-v1.4'}})}
