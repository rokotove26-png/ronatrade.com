import c0 from './deals-current-state-chunks/chunk0.js';
import c1 from './deals-current-state-chunks/chunk1.js';
import c2 from './deals-current-state-chunks/chunk2.js';
import c3 from './deals-current-state-chunks/chunk3.js';
import c4 from './deals-current-state-chunks/chunk4.js';

const RAW=[c0,c1,c2,c3,c4].join('');
const SCRIPT=RAW
  .replace(
    "function waitsAction(d){if(!isActive(d))return false;return Number(d&&d.client_remaining_amount||0)>0||String(d&&d.payment_expectation_state||'').toUpperCase()==='ACTIVE'||needsAttention(d)}",
    "function waitsPayment(d){if(!isActive(d))return false;var remaining=Number(d&&d.client_remaining_amount),expected=Number(d&&d.payment_expectation_amount),outstanding=Number.isFinite(remaining)?remaining>0:(Number.isFinite(expected)&&expected>0);if(!outstanding)return false;var expectation=String(d&&d.payment_expectation_state||'').toUpperCase(),finance=String(d&&d.finance_status||'').toUpperCase();return expectation==='ACTIVE'||['PARTIALLY_PAID','PARTIAL','DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT'].includes(finance)}"
  )
  .replaceAll('waitsAction','waitsPayment')
  .replace(
    "kpi('Ожидают оплаты или действий',String(metrics.waiting),'Только текущее состояние действующих сделок','waiting')",
    "kpi('Ожидают оплаты',String(metrics.waiting),'Сделки с подтверждённым непогашенным остатком платежа','waiting')"
  )
  .replace(
    "function basisText(d){return String(d&&d.delivery_basis||'').trim()||'Требует подтверждения'}",
    "function basisText(d){var raw=String(d&&d.delivery_basis||'').trim();if(!raw)return'Требует подтверждения';return raw.replace(/\\s*[,(]?\\s*Incoterms\\s*2020\\s*\\)?/ig,'').replace(/\\s{2,}/g,' ').replace(/\\s*,\\s*$/,'').trim()||'Требует подтверждения'}"
  )
  .replace(
    "dx.forEach(function(x){var item=el('div','rona-current-deal-doc-item'),meta=el('div');meta.append(el('strong','',x.document_kind||'Документ'),el('div','rona-owner-muted',x.authoritative_filename||x.document_id||'—'));item.append(meta,button('Скачать','',function(){downloadDocument('/admin/documents/'+encodeURIComponent(x.document_id)+'/download').catch(showError)}));list.append(item)})",
    "dx.forEach(function(x){var signed=String(x.document_kind||'').toUpperCase()==='SIGNED_ADDENDUM',item=el('div','rona-current-deal-doc-item'),meta=el('div'),kind=signed?'Подписанное дополнительное соглашение':(x.document_kind||'Документ');meta.append(el('strong','',kind),el('div','rona-owner-muted',x.authoritative_filename||x.document_id||'—'));item.append(meta,button(signed?'Скачать подписанное доп. соглашение':'Скачать',signed?'rona-current-deal-primary':'',function(){downloadDocument('/admin/documents/'+encodeURIComponent(x.document_id)+'/download').catch(showError)}));list.append(item)})"
  )
  .replace(
    "function render(){ensureStyle();var root=q('#page-deals');if(!root||!state)return;var host=q(':scope > .rona-owner-page-content',root);if(!host){host=el('div','rona-owner-page-content');host.dataset.ownerPage='deals';root.append(host)}",
    "function isolateDealsPage(root,host){if(!root||!host)return;qa(':scope > *',root).forEach(function(n){if(n===host)return;n.classList.add('rona-owner-original-hidden');n.setAttribute('aria-hidden','true');n.style.setProperty('display','none','important')});host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display');host.dataset.ownerPage='deals';host.dataset.ronaDealsOwner='current-v1.5'}function guardDealsOwner(){if(!state)return;var root=q('#page-deals');if(!root)return;var host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',root)||q(':scope > .rona-owner-page-content',root);if(!host)return;isolateDealsPage(root,host);if(!q(':scope > .rona-current-deals-owned',host))render()}function render(){ensureStyle();var root=q('#page-deals');if(!root||!state)return;var host=q(':scope > .rona-owner-page-content[data-owner-page=\"deals\"]',root)||q(':scope > .rona-owner-page-content',root);if(!host){host=el('div','rona-owner-page-content');host.dataset.ownerPage='deals';root.prepend(host)}isolateDealsPage(root,host);"
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
    "function installDealsLayoutV15(){if(q('#ronaDealsLayoutV15'))return;var s=el('style');s.id='ronaDealsLayoutV15';s.textContent='#page-deals .rona-current-deal-table{min-width:1520px!important}#page-deals .rona-current-deal-table th:nth-child(2),#page-deals .rona-current-deal-table td:nth-child(2){width:310px!important;min-width:285px!important;max-width:340px!important}#page-deals .rona-current-deal-table td:nth-child(2){white-space:normal!important}#page-deals .rona-current-deal-company{display:block!important;width:100%!important;max-width:none!important;overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important;text-align:left!important;margin:0!important;line-height:1.35!important}#page-deals .rona-current-deal-table th:nth-child(5),#page-deals .rona-current-deal-table td:nth-child(5){width:145px!important;min-width:125px!important;max-width:160px!important}#page-deals .rona-current-deal-table td:nth-child(5) .rona-current-deal-main{max-width:150px!important;white-space:normal!important;overflow-wrap:break-word!important}';document.head.append(s)}function start(){ensureStyle();installDealsLayoutV15();bindNavigation();var mounted=false,observer=null;function mount(){if(mounted||!q('#page-deals'))return;mounted=true;if(observer)observer.disconnect();if(state)render();else if(window.__RONA_DEALS_CURRENT_STATE_ERROR__)renderError(new Error(window.__RONA_DEALS_CURRENT_STATE_ERROR__))}observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});mount();var guardQueued=false,guard=new MutationObserver(function(){if(guardQueued)return;guardQueued=true;queueMicrotask(function(){guardQueued=false;guardDealsOwner()})});guard.observe(document.documentElement,{childList:true,subtree:true});refresh(true);setInterval(function(){refresh(false)},15000)}"
  )
  .replace(
    "if(location.pathname==='/portal/admin'){var tries=0;(function wait(){if(window.__RONA_OWNER_ADMIN_READY__===true){start();return}if(++tries<1200)setTimeout(wait,100)})()}",
    "if(location.pathname==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}"
  );

if(/\bwaitsAction\b/.test(SCRIPT))throw new Error('DEALS_LEGACY_WAITS_ACTION_REFERENCE');
if(!SCRIPT.includes("'PARTIALLY_PAID','PARTIAL','DUE'"))throw new Error('DEALS_PARTIAL_PAYMENT_KPI_RULE_MISSING');
if(!SCRIPT.includes('Incoterms\\s*2020'))throw new Error('DEALS_BASIS_DISPLAY_CLEANUP_MISSING');
if(!SCRIPT.includes('Скачать подписанное доп. соглашение'))throw new Error('DEALS_SIGNED_ADDENDUM_ACTION_MISSING');

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-deals-ui':'current-state-v1.6-signed-addendum'}})}
